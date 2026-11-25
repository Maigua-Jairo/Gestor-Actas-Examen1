import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { LightHeader } from "@/components/LightHeader";
import { ScreenHeader } from "@/components/ScreenHeader";
import { StatusRow } from "@/components/StatusRow";
import { Button, EmptyState, Notice, Pill, ProgressBar, Skeleton } from "@/components/ui";
import type { ResumenVeedora, SiguienteActaVeedora } from "@/domain/veedor.use-cases";
import { useResumenVeedora } from "@/presentation/useResumenVeedora";
import {
  describeMesa,
  dignidadPrioritaria,
  dignityLabel,
  formatSavedAt,
  greetingName,
  mesaStatus,
  openActa,
  veedorEyebrow,
} from "@/presentation/veedor-ui";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export default function VeedorHomeScreen() {
  const { vista } = useLocalSearchParams<{ vista?: string }>();
  const isTablesView = vista === "mesas";
  const { profile, summary, error, loading, refreshing, refresh, retry } =
    useResumenVeedora();

  const queuePill =
    summary && summary.actasEnCola > 0 ? (
      <Animated.View entering={FadeInDown.duration(250)}>
        <Pill
          tone="warning"
          icon="cloud-upload-outline"
          label={`${summary.actasEnCola} en cola`}
        />
      </Animated.View>
    ) : null;

  return (
    <View style={styles.screen}>
      <StatusBar style={isTablesView ? "light" : "dark"} />
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
        {isTablesView ? (
          <ScreenHeader
            eyebrow={veedorEyebrow(summary)}
            title="Mis mesas"
            subtitle="Toque una mesa para registrar o revisar sus actas."
            rightSlot={queuePill}
          />
        ) : (
          <LightHeader
            eyebrow={veedorEyebrow(summary)}
            title={profile ? `Hola, ${greetingName(profile)}` : "Hola"}
            rightSlot={queuePill}
          />
        )}

        <View style={styles.body}>
          {error ? (
            <View style={styles.errorBlock}>
              <Notice tone="error">{error}</Notice>
              <Button variant="secondary" label="Reintentar" onPress={retry} />
            </View>
          ) : null}

          {summary?.guardadoEn ? (
            <Notice tone="warning">
              Sin conexión. Se muestran sus mesas guardadas en el teléfono (
              {formatSavedAt(summary.guardadoEn)}). Puede registrar actas: se
              enviarán solas al recuperar la señal.
            </Notice>
          ) : null}

          {loading ? <LoadingState showHero={!isTablesView} /> : null}

          {summary && !isTablesView ? <TodayCard summary={summary} /> : null}

          {summary ? (
            <View style={styles.section}>
              {!isTablesView ? <Text style={styles.sectionTitle}>MIS MESAS</Text> : null}
              {summary.mesas.length === 0 ? (
                <EmptyState
                  title="Aún no tiene mesas"
                  message="Cuando su coordinador se las asigne, aparecerán aquí."
                />
              ) : (
                <View style={styles.listCard}>
                  {summary.mesas.map((mesa, index) => {
                    const status = mesaStatus[mesa.estado];
                    return (
                      <StatusRow
                        key={mesa.id}
                        title={`JRV ${mesa.numeroJrv}`}
                        subtitle={describeMesa(mesa)}
                        pillLabel={status.label}
                        pillTone={status.tone}
                        barColor={status.bar}
                        accessibilityHint="Abre el acta que falta o necesita atención en esta mesa"
                        onPress={() => openActa(mesa.id, dignidadPrioritaria(mesa))}
                        index={index}
                        last={index === summary.mesas.length - 1}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}

          {isTablesView && summary?.siguiente ? (
            <Button
              label={`${
                summary.siguiente.esCorreccion ? "Corregir acta" : "Registrar acta"
              } · Mesa ${summary.siguiente.numeroJrv}`}
              onPress={() => {
                const next = summary.siguiente;
                if (next) openActa(next.mesaId, next.dignidad);
              }}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function TodayCard({ summary }: { summary: ResumenVeedora }) {
  const { actasRegistradas, actasTotales, siguiente } = summary;
  const progress = actasTotales > 0 ? actasRegistradas / actasTotales : 0;

  return (
    <Animated.View entering={FadeInDown.delay(80).duration(420)}>
      <LinearGradient
        colors={[colors.institutional, colors.primary, colors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.todayCard}
      >
        <View pointerEvents="none" style={styles.todayCircle} />
        <Text style={styles.todayLabel}>
          Hoy · {actasRegistradas} de {actasTotales} actas registradas
        </Text>
        <ProgressBar
          value={progress}
          tone="onDark"
          accessibilityLabel="Avance de actas registradas"
        />
        <NextActa siguiente={siguiente} />
      </LinearGradient>
    </Animated.View>
  );
}

function NextActa({ siguiente }: { siguiente: SiguienteActaVeedora | null }) {
  if (!siguiente) {
    return (
      <View style={styles.doneRow}>
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={22} color={colors.institutional} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.nextTitle}>Todo registrado</Text>
          <Text style={styles.todayLabel}>
            No le quedan actas por registrar en sus mesas.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.nextBlock}>
      <Text style={styles.nextLabel}>
        {siguiente.esCorreccion ? "Acta por corregir" : "Siguiente mesa"}
      </Text>
      <Text style={styles.nextTitle}>
        JRV {siguiente.numeroJrv} · {dignityLabel[siguiente.dignidad]}
      </Text>
      <Button
        variant="secondary"
        label={siguiente.esCorreccion ? "Corregir acta" : "Registrar acta"}
        icon={
          <Ionicons
            name={siguiente.esCorreccion ? "create-outline" : "camera-outline"}
            size={20}
            color={colors.primary}
          />
        }
        onPress={() => openActa(siguiente.mesaId, siguiente.dignidad)}
      />
    </View>
  );
}

function LoadingState({ showHero }: { showHero: boolean }) {
  return (
    <View style={styles.loading} accessibilityLabel="Cargando sus mesas">
      {showHero ? <Skeleton height={190} radius={22} /> : null}
      <Skeleton height={14} width="30%" radius={6} />
      <Skeleton height={68} />
      <Skeleton height={68} />
      <Skeleton height={68} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  flex: { flex: 1 },
  body: {
    alignSelf: "center",
    gap: 18,
    maxWidth: 620,
    paddingHorizontal: 20,
    paddingTop: 18,
    width: "100%",
  },
  errorBlock: { gap: 10 },
  loading: { gap: 12 },
  todayCard: { borderRadius: 22, gap: 14, overflow: "hidden", padding: 20 },
  todayCircle: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    height: 180,
    position: "absolute",
    right: -50,
    top: -70,
    width: 180,
  },
  todayLabel: { color: colors.surfaceMuted, fontFamily: fonts.semiBold, fontSize: 14 },
  nextBlock: { gap: 4 },
  nextLabel: { color: colors.surfaceMuted, fontFamily: fonts.regular, fontSize: 15 },
  nextTitle: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 26,
    marginBottom: 8,
  },
  doneRow: { alignItems: "center", flexDirection: "row", gap: 14 },
  doneIcon: {
    alignItems: "center",
    backgroundColor: colors.onPrimary,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  section: { gap: 10 },
  sectionTitle: {
    color: colors.textAuxiliary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: 1,
  },
  listCard: {
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
});
