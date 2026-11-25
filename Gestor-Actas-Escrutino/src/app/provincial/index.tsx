import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

import { LightHeader } from "@/components/LightHeader";
import { CandidateBars } from "@/components/provincial/CandidateBars";
import { LiveBadge } from "@/components/provincial/LiveBadge";
import { RecintoRow } from "@/components/provincial/RecintoRow";
import { StatCard } from "@/components/provincial/StatCard";
import { Button, EmptyState, LoadingAnimation, Notice, ProgressBar } from "@/components/ui";
import { estadoDeRecinto, type TableroProvincial } from "@/domain/schemas/seguimiento";
import { porcentaje, saludoProvincial } from "@/presentation/provincial-ui";
import { useTableroProvincial } from "@/presentation/useTableroProvincial";
import { formatSavedAt } from "@/presentation/veedor-ui";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

/** Orden de atención: incidencias, en curso, sin iniciar, completos. */
const prioridad = { atencion: 0, en_curso: 1, sin_iniciar: 2, completo: 3 } as const;

export default function ProvincialHomeScreen() {
  const { profile, tablero, actualizadoEn, error, loading, refreshing, refresh, reload } =
    useTableroProvincial();

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <LightHeader
          eyebrow={
            profile?.provincia
              ? `COORDINADOR PROVINCIAL · ${profile.provincia.toUpperCase()}`
              : "COORDINADOR PROVINCIAL"
          }
          title={profile ? `Hola, ${saludoProvincial(profile.nombres, profile.apellidos)}` : "Hola"}
          rightSlot={<LiveBadge actualizadoEn={actualizadoEn} />}
        />

        <View style={styles.body}>
          {error ? (
            <View style={styles.block}>
              <Notice tone="error">{error}</Notice>
              <Button variant="secondary" label="Reintentar" onPress={() => void reload()} />
            </View>
          ) : null}
          {tablero?.guardadoEn ? (
            <Notice tone="warning">
              Sin conexión. Datos guardados en el teléfono ({formatSavedAt(tablero.guardadoEn)}).
            </Notice>
          ) : null}

          {loading ? <LoadingAnimation message="Cargando los datos de la provincia…" /> : null}

          {tablero ? <Dashboard tablero={tablero} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Dashboard({ tablero }: { tablero: TableroProvincial }) {
  const { resumen } = tablero;
  const pct = porcentaje(resumen.mesasCompletas, resumen.totalMesas);
  const destacados = [...tablero.recintos]
    .sort(
      (a, b) =>
        prioridad[estadoDeRecinto(a)] - prioridad[estadoDeRecinto(b)] ||
        a.nombre.localeCompare(b.nombre, "es"),
    )
    .slice(0, 4);

  return (
    <>
      <Animated.View entering={FadeInDown.duration(420)}>
        <LinearGradient
          colors={[colors.institutional, colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View pointerEvents="none" style={styles.circle} />
          <Text style={styles.heroLabel}>Mesas reportadas</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroValue}>
              {resumen.mesasCompletas}
              <Text style={styles.heroTotal}> / {resumen.totalMesas}</Text>
            </Text>
            <Text style={styles.heroPct}>{pct}%</Text>
          </View>
          <ProgressBar
            value={resumen.totalMesas > 0 ? resumen.mesasCompletas / resumen.totalMesas : 0}
            tone="onDark"
            accessibilityLabel="Avance provincial"
          />
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.statsRow}>
        <StatCard value={resumen.actasGuardadas} label="Actas registradas" />
        <StatCard
          value={resumen.mesasPendientes + resumen.mesasParciales}
          label="Mesas por completar"
          color={colors.syncPendingText}
        />
        <StatCard
          value={resumen.actasConIncidencia}
          label="Incidencias"
          color={colors.syncErrorText}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(160).duration(400)}>
        <CandidateBars
          conteo={tablero.conteoCandidatos}
          blancosYNulos={resumen.blancosYNulosPorDignidad}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).duration(400)} style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>RECINTOS</Text>
          <Pressable
            accessibilityRole="link"
            hitSlop={10}
            onPress={() => router.navigate("/provincial/recintos")}
          >
            <Text style={styles.link}>Ver todos</Text>
          </Pressable>
        </View>
        {destacados.length === 0 ? (
          <EmptyState
            title="Aún no hay recintos"
            message="Regístrelos en la pestaña Recintos para empezar a seguir el escrutinio."
          />
        ) : (
          <View style={styles.listCard}>
            {destacados.map((recinto, index) => (
              <RecintoRow
                key={recinto.id}
                recinto={recinto}
                index={index}
                last={index === destacados.length - 1}
                onPress={() => router.navigate("/provincial/recintos")}
              />
            ))}
          </View>
        )}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  body: {
    alignSelf: "center",
    gap: 16,
    maxWidth: 620,
    paddingHorizontal: 20,
    paddingTop: 18,
    width: "100%",
  },
  block: { gap: 12 },
  hero: { borderRadius: 22, gap: 8, overflow: "hidden", padding: 20 },
  circle: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    height: 170,
    position: "absolute",
    right: -50,
    top: -70,
    width: 170,
  },
  heroLabel: { color: colors.surfaceMuted, fontFamily: fonts.semiBold, fontSize: 14 },
  heroRow: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between" },
  heroValue: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 42 },
  heroTotal: { color: colors.surfaceMuted, fontFamily: fonts.semiBold, fontSize: 22 },
  heroPct: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 26, marginBottom: 6 },
  statsRow: { flexDirection: "row", gap: 10, justifyContent: "space-between" },
  section: { gap: 10 },
  sectionRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionTitle: { color: colors.textAuxiliary, fontFamily: fonts.semiBold, fontSize: 12, letterSpacing: 1 },
  link: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 15 },
  listCard: {
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
});
