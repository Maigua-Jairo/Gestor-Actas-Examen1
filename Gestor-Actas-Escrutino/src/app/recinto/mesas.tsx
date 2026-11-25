import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { StatusRow } from "@/components/StatusRow";
import { MesaGrid } from "@/components/recinto/MesaGrid";
import { MesaSheet } from "@/components/recinto/MesaSheet";
import { Button, EmptyState, Notice, Skeleton } from "@/components/ui";
import { mesasPorAtender } from "@/domain/recinto.use-cases";
import { describeMesaRecinto, estadoMesaRecinto } from "@/presentation/recinto-ui";
import { useTableroRecinto } from "@/presentation/useTableroRecinto";
import { formatSavedAt } from "@/presentation/veedor-ui";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export default function RecintoMesasScreen() {
  const { tablero, error, loading, refreshing, refresh, reload } = useTableroRecinto();
  const [mesaId, setMesaId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");

  const selectedMesa = tablero?.mesas.find((mesa) => mesa.id === mesaId) ?? null;
  const pendientes = tablero ? mesasPorAtender(tablero) : [];
  const primeraSinVeedor = tablero?.mesasSinVeedor[0] ?? null;

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
          title="Mesas"
          subtitle="Toque una mesa para ver sus actas o asignar su veedor."
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
              No se pueden cambiar asignaciones hasta recuperar la señal.
            </Notice>
          ) : null}

          {loading ? (
            <View style={styles.block}>
              <Skeleton height={140} radius={18} />
              <Skeleton height={72} />
              <Skeleton height={72} />
            </View>
          ) : null}

          {tablero ? (
            <>
              <Animated.View entering={FadeInDown.duration(380)} style={styles.card}>
                {tablero.mesas.length === 0 ? (
                  <EmptyState
                    title="Aún no hay mesas"
                    message="Este recinto todavía no tiene mesas cargadas. Avise al coordinador provincial."
                  />
                ) : (
                  <MesaGrid
                    mesas={tablero.mesas}
                    showLabels
                    onPressMesa={(mesa) => setMesaId(mesa.id)}
                  />
                )}
              </Animated.View>

              {pendientes.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>POR ATENDER</Text>
                  <View style={styles.listCard}>
                    {pendientes.map((mesa, index) => {
                      const visual = estadoMesaRecinto[mesa.estado];
                      const sinVeedor = !mesa.veedor && tablero.asignacionesDisponibles;
                      return (
                        <StatusRow
                          key={mesa.id}
                          title={`Mesa ${mesa.numeroJrv}`}
                          subtitle={describeMesaRecinto(mesa)}
                          pillLabel={sinVeedor && mesa.estado === "sin_registro" ? "Asignar" : visual.label}
                          pillTone={sinVeedor && mesa.estado === "sin_registro" ? "info" : visual.tone}
                          barColor={visual.color}
                          accessibilityHint="Abre el detalle de la mesa"
                          onPress={() => setMesaId(mesa.id)}
                          index={index}
                          last={index === pendientes.length - 1}
                        />
                      );
                    })}
                  </View>
                </View>
              ) : tablero.mesas.length > 0 ? (
                <Notice tone="success">
                  Todas las mesas tienen veedor y sus dos actas recibidas.
                </Notice>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>

      {primeraSinVeedor ? (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.footer}>
          <Button
            label={`Asignar veedor a mesa ${primeraSinVeedor.numeroJrv}`}
            icon={<Ionicons name="person-add-outline" size={20} color={colors.onPrimary} />}
            onPress={() => setMesaId(primeraSinVeedor.id)}
          />
        </Animated.View>
      ) : null}

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
    gap: 16,
    maxWidth: 620,
    paddingHorizontal: 20,
    paddingTop: 18,
    width: "100%",
  },
  block: { gap: 12 },
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
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
  footer: {
    backgroundColor: colors.paper,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
});
