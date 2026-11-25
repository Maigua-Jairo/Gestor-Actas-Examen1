import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { ScreenHeader } from "@/components/ScreenHeader";
import { StatusRow } from "@/components/StatusRow";
import { Button, EmptyState, Notice, Skeleton } from "@/components/ui";
import type {
  ActaDeMesaVeedora,
  EstadoActaVeedora,
  MesaAsignadaVeedora,
} from "@/domain/veedor.use-cases";
import { useResumenVeedora } from "@/presentation/useResumenVeedora";
import {
  actaStatus,
  dignityLabel,
  formatSavedAt,
  openActa,
  veedorEyebrow,
} from "@/presentation/veedor-ui";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

/** Primero lo que necesita atención. */
const prioridad: Record<EstadoActaVeedora, number> = {
  fallada: 0,
  pendiente: 1,
  guardada: 2,
  sin_registro: 3,
};

function describeActa(acta: ActaDeMesaVeedora): string {
  switch (acta.estado) {
    case "guardada":
      return "Enviada al recinto";
    case "pendiente":
      return "Guardada en el teléfono · pendiente de envío";
    case "fallada":
      return acta.detalle ?? "No se pudo enviar · toque para corregir";
    default:
      return "Sin registrar";
  }
}

export default function MisActasScreen() {
  const { summary, error, loading, refreshing, refresh, retry } = useResumenVeedora();

  // Una fila por acta ya registrada (mesa + dignidad).
  const actas = (summary?.mesas ?? [])
    .flatMap((mesa: MesaAsignadaVeedora) =>
      mesa.actas
        .filter((acta) => acta.estado !== "sin_registro")
        .map((acta) => ({ mesa, acta })),
    )
    .sort(
      (a, b) =>
        prioridad[a.acta.estado] - prioridad[b.acta.estado] ||
        a.mesa.numeroJrv - b.mesa.numeroJrv,
    );

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
          eyebrow={veedorEyebrow(summary)}
          title="Mis actas"
          subtitle="Toque un acta para revisarla o corregirla."
        />

        <View style={styles.body}>
          {error ? (
            <View style={styles.errorBlock}>
              <Notice tone="error">{error}</Notice>
              <Button variant="secondary" label="Reintentar" onPress={retry} />
            </View>
          ) : null}

          {summary?.guardadoEn ? (
            <Notice tone="warning">
              Sin conexión. Datos guardados en el teléfono ({formatSavedAt(summary.guardadoEn)}).
            </Notice>
          ) : null}

          {loading ? (
            <View style={styles.loading}>
              <Skeleton height={72} />
              <Skeleton height={72} />
              <Skeleton height={72} />
            </View>
          ) : null}

          {summary && actas.length === 0 ? (
            <EmptyState
              title="Aún no registra actas"
              message="Cuando registre el acta de una de sus mesas, aparecerá aquí con su estado de envío."
            />
          ) : null}

          {actas.length > 0 ? (
            <View style={styles.listCard}>
              {actas.map(({ mesa, acta }, index) => {
                const status = actaStatus[acta.estado];
                return (
                  <StatusRow
                    key={`${mesa.id}-${acta.dignidad}`}
                    title={`Mesa ${mesa.numeroJrv} · ${dignityLabel[acta.dignidad]}`}
                    subtitle={describeActa(acta)}
                    pillLabel={status.label}
                    pillTone={status.tone}
                    barColor={status.bar}
                    accessibilityHint="Abre el acta para revisarla o corregirla"
                    onPress={() => openActa(mesa.id, acta.dignidad)}
                    index={index}
                    last={index === actas.length - 1}
                  />
                );
              })}
            </View>
          ) : null}

          {actas.length > 0 ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                Toque un acta para revisarla o corregirla. Las que tienen{" "}
                <Text style={styles.infoStrong}>Error</Text> no llegaron al recinto:
                corríjalas y vuelva a confirmarlas.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
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
  errorBlock: { gap: 10 },
  loading: { gap: 10 },
  listCard: {
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  infoCard: {
    backgroundColor: colors.paper,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  infoText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  infoStrong: { color: colors.syncErrorText, fontFamily: fonts.semiBold },
});
