import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { StatusRow } from "@/components/StatusRow";
import { MesaSheet } from "@/components/recinto/MesaSheet";
import { Button, EmptyState, FilterChips, Notice, type PillTone, Skeleton } from "@/components/ui";
import {
  DISTANCIA_REVISION_M,
  listarActasRecinto,
  type ActaRecibida,
  type EstadoActaRecibida,
} from "@/domain/recinto.use-cases";
import { haceCuanto } from "@/presentation/format";
import { nombreCorto } from "@/presentation/recinto-ui";
import { useTableroRecinto } from "@/presentation/useTableroRecinto";
import { dignityLabel, formatSavedAt, openActa } from "@/presentation/veedor-ui";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type Filtro = "todas" | EstadoActaRecibida;

const visual: Record<EstadoActaRecibida, { label: string; tone: PillTone; bar: string }> = {
  revisar: { label: "Revisar", tone: "danger", bar: colors.syncErrorText },
  confirmada: { label: "Confirmada", tone: "success", bar: colors.syncOkText },
  faltante: { label: "Por recibir", tone: "neutral", bar: colors.borderStrong },
};

function describe(item: ActaRecibida): string {
  const veedor = item.mesa.veedor ? nombreCorto(item.mesa.veedor) : "Sin veedor";
  if (!item.acta) {
    return item.mesa.veedor ? `${veedor} · aún no la envía` : "Sin veedor asignado";
  }
  if (item.estado === "revisar" && item.acta.distanciaM !== null) {
    return `${veedor} · tomada a ${Math.round(item.acta.distanciaM)} m del recinto`;
  }
  const corregida = item.acta.version > 1 ? ` · corregida (v${item.acta.version})` : "";
  return `${veedor} · recibida ${haceCuanto(item.acta.actualizadaEn)}${corregida}`;
}

export default function RecintoActasScreen() {
  const { tablero, error, loading, refreshing, refresh, reload } = useTableroRecinto();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [mesaId, setMesaId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");

  const actas = useMemo(() => (tablero ? listarActasRecinto(tablero) : []), [tablero]);
  const contar = (estado: EstadoActaRecibida) =>
    actas.filter((item) => item.estado === estado).length;
  const recibidas = actas.filter((item) => item.estado !== "faltante");
  const visibles =
    filtro === "todas" ? recibidas : actas.filter((item) => item.estado === filtro);
  const selectedMesa = tablero?.mesas.find((mesa) => mesa.id === mesaId) ?? null;

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
          eyebrow={tablero?.recintoNombre ?? "Coordinador de recinto"}
          title="Actas recibidas"
          subtitle="Toque un acta para revisarla o corregirla."
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

          {loading ? (
            <View style={styles.block}>
              <Skeleton height={40} width="80%" radius={999} />
              <Skeleton height={72} />
              <Skeleton height={72} />
              <Skeleton height={72} />
            </View>
          ) : null}

          {tablero ? (
            <>
              <Animated.View entering={FadeInDown.duration(360)}>
                <FilterChips<Filtro>
                  value={filtro}
                  onChange={setFiltro}
                  options={[
                    { value: "todas", label: "Todas", count: recibidas.length },
                    { value: "revisar", label: "Revisar", count: contar("revisar") },
                    { value: "confirmada", label: "Confirmadas", count: contar("confirmada") },
                    { value: "faltante", label: "Por recibir", count: contar("faltante") },
                  ]}
                />
              </Animated.View>

              {visibles.length === 0 ? (
                filtro === "todas" || filtro === "confirmada" ? (
                  <EmptyState
                    title="Aún no llegan actas"
                    message="Las actas que envíen los veedores aparecerán aquí en cuanto lleguen."
                  />
                ) : (
                  <Animated.View entering={FadeIn.duration(300)}>
                    <Notice tone="success">
                      {filtro === "revisar"
                        ? "Ninguna acta necesita revisión."
                        : "Ya llegaron todas las actas del recinto."}
                    </Notice>
                  </Animated.View>
                )
              ) : (
                // La clave cambia con el filtro para que las filas vuelvan a entrar animadas.
                <View key={filtro} style={styles.listCard}>
                  {visibles.map((item, index) => {
                    const style = visual[item.estado];
                    return (
                      <StatusRow
                        key={`${item.mesa.id}-${item.dignidad}`}
                        title={`Mesa ${item.mesa.numeroJrv} · ${dignityLabel[item.dignidad]}`}
                        subtitle={describe(item)}
                        pillLabel={style.label}
                        pillTone={style.tone}
                        barColor={style.bar}
                        accessibilityHint={
                          item.acta
                            ? "Abre el acta para revisarla o corregirla"
                            : "Abre la mesa para ver o cambiar su veedor"
                        }
                        onPress={() =>
                          item.acta
                            ? openActa(item.mesa.id, item.dignidad)
                            : setMesaId(item.mesa.id)
                        }
                        index={index}
                        last={index === visibles.length - 1}
                      />
                    );
                  })}
                </View>
              )}

              {filtro === "revisar" && visibles.length > 0 ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoText}>
                    Se marcan para revisar las actas fotografiadas a más de{" "}
                    {DISTANCIA_REVISION_M} m del recinto. Confirme con el veedor que la
                    foto corresponde a la mesa; si los números están mal, corríjalos.
                  </Text>
                </View>
              ) : null}
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

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  body: {
    alignSelf: "center",
    gap: 14,
    maxWidth: 620,
    paddingHorizontal: 20,
    paddingTop: 18,
    width: "100%",
  },
  block: { gap: 12 },
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
});
