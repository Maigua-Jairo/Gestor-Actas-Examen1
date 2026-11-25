import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import {
  ReplaceWatcherSheet,
  type VeedorConMesas,
} from "@/components/recinto/ReplaceWatcherSheet";
import { Button, EmptyState, Notice, Skeleton } from "@/components/ui";
import type { MesaRecinto } from "@/domain/recinto.use-cases";
import { iniciales, listaConY } from "@/presentation/format";
import { useTableroRecinto } from "@/presentation/useTableroRecinto";
import { formatSavedAt } from "@/presentation/veedor-ui";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

function openNewWatcher(mesas: MesaRecinto[] = [], reemplazaA?: string): void {
  router.push({
    pathname: "/cuentas/nueva",
    params: {
      ...(mesas.length > 0 ? { mesas: mesas.map((mesa) => mesa.id).join(",") } : {}),
      ...(reemplazaA ? { reemplaza: reemplazaA } : {}),
    },
  });
}

export default function RecintoVeedoresScreen() {
  const { tablero, error, loading, refreshing, refresh, reload } = useTableroRecinto();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [transferError, setTransferError] = useState("");

  const veedores: VeedorConMesas[] = useMemo(
    () =>
      (tablero?.veedores ?? [])
        .map((veedor) => ({
          veedor,
          mesas: (tablero?.mesas ?? []).filter((mesa) => mesa.veedor?.id === veedor.id),
        }))
        .sort((a, b) => a.veedor.apellidos.localeCompare(b.veedor.apellidos, "es")),
    [tablero],
  );
  const target = veedores.find((item) => item.veedor.id === targetId) ?? null;
  const sinVeedor = tablero?.mesasSinVeedor ?? [];
  const offline = Boolean(tablero?.guardadoEn) || tablero?.asignacionesDisponibles === false;

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
          title="Veedores"
          subtitle="Asigne, reemplace o cree los veedores de su recinto."
        />

        <View style={styles.body}>
          {error ? (
            <View style={styles.block}>
              <Notice tone="error">{error}</Notice>
              <Button variant="secondary" label="Reintentar" onPress={() => void reload()} />
            </View>
          ) : null}
          {success ? <Notice tone="success">{success}</Notice> : null}
          {transferError ? <Notice tone="error">{transferError}</Notice> : null}
          {tablero?.guardadoEn ? (
            <Notice tone="warning">
              Sin conexión ({formatSavedAt(tablero.guardadoEn)}). Puede consultar, pero para
              crear o reemplazar veedores necesita señal.
            </Notice>
          ) : null}

          {loading ? (
            <View style={styles.block}>
              <Skeleton height={78} radius={18} />
              <Skeleton height={78} radius={18} />
              <Skeleton height={78} radius={18} />
            </View>
          ) : null}

          {tablero && veedores.length === 0 ? (
            <EmptyState
              title="Aún no hay veedores"
              message="Cree el primer veedor y elija las mesas que cubrirá."
            />
          ) : null}

          {veedores.length > 0 ? (
            <View style={styles.listCard}>
              {veedores.map((item, index) => (
                <WatcherRow
                  key={item.veedor.id}
                  item={item}
                  index={index}
                  last={index === veedores.length - 1}
                  disabled={offline}
                  onReplace={() => {
                    setSuccess("");
                    setTransferError("");
                    setTargetId(item.veedor.id);
                  }}
                />
              ))}
            </View>
          ) : null}

          {sinVeedor.map((mesa) => (
            <Animated.View key={mesa.id} entering={FadeInDown.duration(320)}>
              <Notice tone="warning">Mesa {mesa.numeroJrv} no tiene veedor asignado.</Notice>
            </Animated.View>
          ))}

          {tablero ? (
            <>
              <Button
                label="Crear nuevo veedor"
                icon={<Ionicons name="add" size={22} color={colors.onPrimary} />}
                disabled={offline}
                onPress={() => openNewWatcher(sinVeedor)}
              />
              <Text style={styles.footnote}>
                El reemplazo traslada las mesas del veedor anterior de inmediato.
              </Text>
            </>
          ) : null}
        </View>
      </ScrollView>

      <ReplaceWatcherSheet
        target={target}
        others={veedores.filter((item) => item.veedor.id !== targetId)}
        onClose={() => setTargetId(null)}
        onDone={(message, failure) => {
          setTargetId(null);
          setSuccess(message);
          setTransferError(failure ?? "");
          void reload();
        }}
        onCreateSubstitute={(mesas) =>
          openNewWatcher(
            mesas,
            target ? `${target.veedor.nombres} ${target.veedor.apellidos}` : undefined,
          )
        }
      />
    </View>
  );
}

function WatcherRow({
  item,
  index,
  last,
  disabled,
  onReplace,
}: {
  item: VeedorConMesas;
  index: number;
  last: boolean;
  disabled: boolean;
  onReplace: () => void;
}) {
  const numeros = item.mesas.map((mesa) => String(mesa.numeroJrv));
  return (
    <Animated.View
      entering={FadeInDown.delay(80 + index * 50).duration(360)}
      layout={LinearTransition.duration(250)}
      style={[styles.row, !last && styles.divider]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {iniciales(item.veedor.nombres, item.veedor.apellidos)}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={1}>
          {item.veedor.nombres} {item.veedor.apellidos}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {numeros.length === 0
            ? "Sin mesas asignadas"
            : `${numeros.length === 1 ? "Mesa" : "Mesas"} ${listaConY(numeros)}`}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reemplazar a ${item.veedor.nombres} ${item.veedor.apellidos}`}
        disabled={disabled}
        onPress={onReplace}
        style={({ pressed }) => [
          styles.replace,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <Text style={styles.replaceText}>Reemplazar</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  flex: { flex: 1 },
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
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 78,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  divider: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.institutional,
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  avatarText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 16 },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  meta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  replace: {
    alignItems: "center",
    borderColor: colors.primary,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12,
  },
  replaceText: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 14 },
  pressed: { backgroundColor: colors.surfaceMuted },
  disabled: { opacity: 0.45 },
  footnote: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlign: "center",
  },
});
