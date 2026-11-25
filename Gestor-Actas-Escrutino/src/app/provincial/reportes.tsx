import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { CantonChart } from "@/components/provincial/CantonChart";
import { StatCard } from "@/components/provincial/StatCard";
import { Button, LoadingAnimation, Notice, ProgressBar } from "@/components/ui";
import { DISTANCIA_REVISION_M } from "@/domain/recinto.use-cases";
import {
  avancePorCanton,
  type DignidadConteo,
  type TableroProvincial,
} from "@/domain/schemas/seguimiento";
import { haceCuanto } from "@/presentation/format";
import { porcentaje } from "@/presentation/provincial-ui";
import { useTableroProvincial } from "@/presentation/useTableroProvincial";
import { dignityLabel, formatSavedAt } from "@/presentation/veedor-ui";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export default function ProvincialReportesScreen() {
  const { profile, tablero, error, loading, refreshing, refresh, reload } =
    useTableroProvincial();

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
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
        <ScreenHeader
          eyebrow={profile?.provincia ? `${profile.provincia} · Elecciones` : "Elecciones"}
          title="Reportes"
          subtitle="Avance del escrutinio en su provincia, en vivo."
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

          {loading ? <LoadingAnimation message="Preparando los reportes de la provincia…" /> : null}

          {tablero ? <Report tablero={tablero} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Report({ tablero }: { tablero: TableroProvincial }) {
  const { resumen } = tablero;
  const pct = porcentaje(resumen.mesasCompletas, resumen.totalMesas);
  const incidencias = tablero.ubicacionesActas
    .filter((ubicacion) => ubicacion.requiereRevision)
    .sort((a, b) => (b.distanciaM ?? 0) - (a.distanciaM ?? 0));

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
          <Text style={styles.heroLabel}>Avance provincial</Text>
          <Text style={styles.heroValue}>
            {pct}
            <Text style={styles.heroUnit}> %</Text>
          </Text>
          <Text style={styles.heroDetail}>
            {resumen.mesasCompletas} de {resumen.totalMesas} mesas reportadas ·{" "}
            {resumen.totalRecintos} recintos
          </Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.grid}>
        <View style={styles.gridRow}>
          <StatCard value={resumen.actasGuardadas} label="Actas registradas" />
          <StatCard
            value={resumen.mesasPendientes}
            label="Mesas sin ninguna acta"
            color={colors.syncPendingText}
          />
        </View>
        <View style={styles.gridRow}>
          <StatCard
            value={resumen.actasConIncidencia}
            label="Actas con incidencias"
            color={colors.syncErrorText}
          />
          <StatCard
            value={resumen.mesasParciales}
            label="Mesas con una sola acta"
            color={colors.primary}
          />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(160).duration(400)}>
        <CantonChart cantones={avancePorCanton(tablero.recintos)} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).duration(400)} style={styles.card}>
        <Text style={styles.cardTitle}>RESUMEN POR CARGO</Text>
        {(["ALCALDIA", "PREFECTURA"] as DignidadConteo[]).map((dignidad) => (
          <View key={dignidad} style={styles.cargo}>
            <View style={styles.cargoRow}>
              <Text style={styles.cargoName}>{dignityLabel[dignidad]}</Text>
              <Text style={styles.cargoValue}>
                {resumen.actasPorDignidad[dignidad]} / {resumen.totalMesas}
              </Text>
            </View>
            <ProgressBar
              value={
                resumen.totalMesas > 0 ? resumen.actasPorDignidad[dignidad] / resumen.totalMesas : 0
              }
              accessibilityLabel={`Actas de ${dignityLabel[dignidad]} recibidas`}
            />
            <Text style={styles.cargoMeta}>
              {resumen.blancosYNulosPorDignidad[dignidad]} votos blancos y nulos
            </Text>
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(280).duration(400)} style={styles.card}>
        <Text style={styles.cardTitle}>UBICACIONES A REVISAR</Text>
        <Text style={styles.cardHint}>
          Actas fotografiadas a más de {DISTANCIA_REVISION_M} m de su recinto.
        </Text>
        {incidencias.length === 0 ? (
          <Notice tone="success">Todas las actas se registraron cerca de su recinto.</Notice>
        ) : (
          incidencias.map((ubicacion) => (
            <View key={ubicacion.actaId} style={styles.incident}>
              <Ionicons name="location" size={20} color={colors.syncErrorText} />
              <View style={styles.flex}>
                <Text style={styles.incidentTitle}>
                  {ubicacion.recintoNombre} · Mesa {ubicacion.numeroJrv} ·{" "}
                  {dignityLabel[ubicacion.dignidad]}
                </Text>
                <Text style={styles.incidentText}>
                  A {Math.round(ubicacion.distanciaM ?? 0)} m del recinto ·{" "}
                  {ubicacion.latitud.toFixed(5)}, {ubicacion.longitud.toFixed(5)} ·{" "}
                  {haceCuanto(ubicacion.actualizadaEn)}
                </Text>
              </View>
            </View>
          ))
        )}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  flex: { flex: 1 },
  body: {
    alignSelf: "center",
    gap: 16,
    maxWidth: 620,
    paddingHorizontal: 20,
    paddingTop: 18,
    width: "100%",
  },
  block: { gap: 12 },
  hero: { borderRadius: 22, gap: 4, overflow: "hidden", padding: 20 },
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
  heroValue: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 46 },
  heroUnit: { color: colors.surfaceMuted, fontFamily: fonts.semiBold, fontSize: 24 },
  heroDetail: { color: colors.surfaceMuted, fontFamily: fonts.regular, fontSize: 14 },
  grid: { gap: 10 },
  gridRow: { flexDirection: "row", gap: 10 },
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  cardTitle: { color: colors.textAuxiliary, fontFamily: fonts.semiBold, fontSize: 12, letterSpacing: 1 },
  cardHint: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, marginTop: -6 },
  cargo: { gap: 6 },
  cargoRow: { flexDirection: "row", justifyContent: "space-between" },
  cargoName: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 16 },
  cargoValue: { color: colors.navy, fontFamily: fonts.bold, fontSize: 16 },
  cargoMeta: { color: colors.textAuxiliary, fontFamily: fonts.regular, fontSize: 13 },
  incident: {
    alignItems: "flex-start",
    backgroundColor: colors.syncErrorBg,
    borderColor: colors.syncErrorBorder,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  incidentTitle: { color: colors.syncErrorText, fontFamily: fonts.semiBold, fontSize: 14 },
  incidentText: { color: colors.syncErrorText, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
});
