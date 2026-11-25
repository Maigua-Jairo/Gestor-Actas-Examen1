import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { LightHeader } from "@/components/LightHeader";
import { MesaGrid } from "@/components/recinto/MesaGrid";
import { MesaSheet } from "@/components/recinto/MesaSheet";
import { VotesBreakdown } from "@/components/recinto/VotesBreakdown";
import { Button, EmptyState, LoadingAnimation, Notice, ProgressBar } from "@/components/ui";
import type { TableroRecinto } from "@/domain/recinto.use-cases";
import { listaConY } from "@/presentation/format";
import { useTableroRecinto } from "@/presentation/useTableroRecinto";
import { formatSavedAt } from "@/presentation/veedor-ui";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export default function RecintoHomeScreen() {
  const { tablero, error, loading, refreshing, refresh, reload } = useTableroRecinto();
  const [mesaId, setMesaId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const selectedMesa = tablero?.mesas.find((mesa) => mesa.id === mesaId) ?? null;

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
          eyebrow="COORDINADOR DE RECINTO"
          title={tablero?.recintoNombre ?? "Mi recinto"}
        />

        <View style={styles.body}>
          {error ? (
            <View style={styles.block}>
              <Notice tone="error">{error}</Notice>
              <Button variant="secondary" label="Reintentar" onPress={() => void reload()} />
            </View>
          ) : null}
          {success ? <Notice tone="success">{success}</Notice> : null}
          {tablero?.guardadoEn ? (
            <Notice tone="warning">
              Sin conexión. Datos guardados en el teléfono ({formatSavedAt(tablero.guardadoEn)}).
            </Notice>
          ) : null}

          {loading ? <LoadingAnimation message="Cargando las mesas y actas del recinto…" /> : null}

          {tablero ? (
            <>
              <ProgressCard tablero={tablero} />
              <Alerts tablero={tablero} />

              <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.section}>
                <Text style={styles.sectionTitle}>ESTADO DE MESAS</Text>
                {tablero.mesas.length === 0 ? (
                  <EmptyState
                    title="Aún no hay mesas"
                    message="Este recinto todavía no tiene mesas cargadas. Avise al coordinador provincial."
                  />
                ) : (
                  <MesaGrid mesas={tablero.mesas} onPressMesa={(mesa) => setMesaId(mesa.id)} />
                )}
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(240).duration(400)}>
                <VotesBreakdown conteo={tablero.conteo} />
              </Animated.View>

              <View style={styles.actionsRow}>
                <View style={styles.flex}>
                  <Button
                    variant="secondary"
                    label="Veedores"
                    icon={<Ionicons name="people-outline" size={18} color={colors.primary} />}
                    onPress={() => router.navigate("/recinto/veedores")}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    label="Ver mesas"
                    icon={<Ionicons name="grid-outline" size={18} color={colors.onPrimary} />}
                    onPress={() => router.navigate("/recinto/mesas")}
                  />
                </View>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      <MesaSheet
        mesa={selectedMesa}
        veedores={tablero?.veedores ?? []}
        asignacionesDisponibles={tablero?.asignacionesDisponibles ?? false}
        onClose={() => setMesaId(null)}
        onAssigned={(message) => {
          setMesaId(null);
          setSuccess(message);
          void reload();
        }}
        onCreateWatcher={() =>
          router.push({
            pathname: "/cuentas/nueva",
            params: selectedMesa ? { mesas: selectedMesa.id } : {},
          })
        }
      />
    </View>
  );
}

function ProgressCard({ tablero }: { tablero: TableroRecinto }) {
  const progress = tablero.totalMesas > 0 ? tablero.mesasReportadas / tablero.totalMesas : 0;
  return (
    <Animated.View entering={FadeInDown.duration(420)}>
      <LinearGradient
        colors={[colors.institutional, colors.primary, colors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.progressCard}
      >
        <View pointerEvents="none" style={styles.circle} />
        <View style={styles.progressRow}>
          <View style={styles.flex}>
            <Text style={styles.progressLabel}>Mesas reportadas</Text>
            <Text style={styles.progressValue}>
              {tablero.mesasReportadas}
              <Text style={styles.progressTotal}> / {tablero.totalMesas}</Text>
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{tablero.actasRecibidas}</Text>
            <Text style={styles.statLabel}>Actas recibidas</Text>
          </View>
        </View>
        <ProgressBar value={progress} tone="onDark" accessibilityLabel="Mesas reportadas" />
      </LinearGradient>
    </Animated.View>
  );
}

function Alerts({ tablero }: { tablero: TableroRecinto }) {
  const revisar = tablero.porRevisar;
  const sinVeedor = tablero.mesasSinVeedor;
  const goToMesas = () => router.navigate("/recinto/mesas");

  return (
    <>
      {revisar.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(80).duration(380)}>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Abre la lista de mesas"
            onPress={goToMesas}
            style={({ pressed }) => [styles.alert, styles.alertDanger, pressed && styles.pressed]}
          >
            <View style={[styles.alertIcon, { backgroundColor: colors.syncErrorText }]}>
              <Text style={styles.alertIconText}>!</Text>
            </View>
            <View style={styles.flex}>
              <Text style={[styles.alertTitle, { color: colors.syncErrorText }]}>
                {revisar.length} {revisar.length === 1 ? "acta necesita" : "actas necesitan"} revisión
              </Text>
              <Text style={[styles.alertText, { color: colors.syncErrorText }]}>
                Tomadas lejos del recinto ·{" "}
                {listaConY([...new Set(revisar.map((item) => `Mesa ${item.numeroJrv}`))])}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.syncErrorText} />
          </Pressable>
        </Animated.View>
      ) : null}

      {sinVeedor.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(120).duration(380)}>
          <Pressable
            accessibilityRole="button"
            onPress={goToMesas}
            style={({ pressed }) => [styles.alert, styles.alertWarning, pressed && styles.pressed]}
          >
            <Ionicons name="person-add-outline" size={22} color={colors.syncPendingText} />
            <Text style={[styles.alertText, styles.flex, { color: colors.syncPendingText }]}>
              {sinVeedor.length === 1
                ? `La mesa ${sinVeedor[0].numeroJrv} no tiene veedor asignado.`
                : `Mesas sin veedor: ${listaConY(sinVeedor.map((mesa) => String(mesa.numeroJrv)))}.`}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.syncPendingText} />
          </Pressable>
        </Animated.View>
      ) : null}
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
  section: { gap: 10 },
  sectionTitle: {
    color: colors.textAuxiliary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: 1,
  },
  progressCard: { borderRadius: 22, gap: 16, overflow: "hidden", padding: 20 },
  circle: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    height: 170,
    position: "absolute",
    right: -50,
    top: -70,
    width: 170,
  },
  progressRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  progressLabel: { color: colors.surfaceMuted, fontFamily: fonts.semiBold, fontSize: 14 },
  progressValue: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 40 },
  progressTotal: { color: colors.surfaceMuted, fontFamily: fonts.semiBold, fontSize: 22 },
  statBox: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 16,
    minWidth: 110,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statValue: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 26 },
  statLabel: { color: colors.surfaceMuted, fontFamily: fonts.regular, fontSize: 13 },
  alert: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  alertDanger: { backgroundColor: colors.syncErrorBg, borderColor: colors.syncErrorBorder },
  alertWarning: { backgroundColor: colors.syncPendingBg, borderColor: colors.syncPendingBorder },
  alertIcon: {
    alignItems: "center",
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  alertIconText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 18 },
  alertTitle: { fontFamily: fonts.bold, fontSize: 16 },
  alertText: { fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  pressed: { opacity: 0.75 },
  actionsRow: { flexDirection: "row", gap: 10 },
});
