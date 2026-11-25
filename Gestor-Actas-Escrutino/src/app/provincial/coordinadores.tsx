import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button, EmptyState, Notice, Pill, Skeleton } from "@/components/ui";
import type { PerfilUsuario } from "@/data/auth.repository";
import { authUseCases } from "@/presentation/auth";
import { iniciales } from "@/presentation/format";
import { useTableroProvincial } from "@/presentation/useTableroProvincial";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export default function ProvincialCoordinadoresScreen() {
  const { profile, tablero } = useTableroProvincial();
  const [cuentas, setCuentas] = useState<PerfilUsuario[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      // RLS: el coordinador provincial solo ve las cuentas de su provincia.
      const todas = await authUseCases.listarCuentas.execute();
      setCuentas(todas.filter((cuenta) => cuenta.rol === "recinto"));
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible consultar los coordinadores.",
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const recintos = tablero?.recintos ?? [];
  const nombreRecinto = (id: string | null) =>
    recintos.find((recinto) => recinto.id === id)?.nombre ?? "Recinto sin nombre";
  const conCoordinador = new Set((cuentas ?? []).map((cuenta) => cuenta.recintoId));
  const sinCoordinador = recintos.filter((recinto) => !conCoordinador.has(recinto.id));
  const ordenadas = [...(cuentas ?? [])].sort((a, b) =>
    nombreRecinto(a.recintoId).localeCompare(nombreRecinto(b.recintoId), "es"),
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
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <ScreenHeader
          eyebrow={profile?.provincia ?? "Coordinador provincial"}
          title="Coordinadores"
          subtitle="Un coordinador por recinto."
        />

        <View style={styles.body}>
          {error ? (
            <View style={styles.block}>
              <Notice tone="error">{error}</Notice>
              <Button variant="secondary" label="Reintentar" onPress={() => void load()} />
            </View>
          ) : null}

          {!cuentas && !error ? (
            <View style={styles.block}>
              <Skeleton height={76} />
              <Skeleton height={76} />
              <Skeleton height={76} />
            </View>
          ) : null}

          {cuentas && cuentas.length === 0 ? (
            <EmptyState
              title="Aún no hay coordinadores"
              message="Cree el coordinador de cada recinto; le llegará un correo para confirmar su cuenta."
            />
          ) : null}

          {ordenadas.length > 0 ? (
            <View style={styles.listCard}>
              {ordenadas.map((cuenta, index) => (
                <Animated.View
                  key={cuenta.id}
                  entering={FadeInDown.delay(80 + index * 50).duration(340)}
                  style={[styles.row, index < ordenadas.length - 1 && styles.divider]}
                  accessibilityLabel={`${cuenta.nombres} ${cuenta.apellidos}, coordinador de ${nombreRecinto(cuenta.recintoId)}`}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {iniciales(cuenta.nombres, cuenta.apellidos)}
                    </Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.name} numberOfLines={1}>
                      {cuenta.nombres} {cuenta.apellidos}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {nombreRecinto(cuenta.recintoId)}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {cuenta.telefono} · {cuenta.email}
                    </Text>
                  </View>
                  {cuenta.debeCambiarClave ? (
                    <Pill label="Sin primer ingreso" tone="warning" />
                  ) : (
                    <Pill label="Activo" tone="success" />
                  )}
                </Animated.View>
              ))}
            </View>
          ) : null}

          {cuentas && sinCoordinador.length > 0 ? (
            <Notice tone="warning">
              {sinCoordinador.length === 1
                ? `${sinCoordinador[0].nombre} no tiene coordinador.`
                : `${sinCoordinador.length} recintos sin coordinador: ${sinCoordinador
                    .map((recinto) => recinto.nombre)
                    .join(", ")}.`}
            </Notice>
          ) : null}

          <Button
            label="Nuevo coordinador"
            icon={<Ionicons name="person-add-outline" size={20} color={colors.onPrimary} />}
            onPress={() => router.push("/cuentas/nueva")}
          />
        </View>
      </ScrollView>
    </View>
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
  row: { alignItems: "center", flexDirection: "row", gap: 12, padding: 14 },
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
  meta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, marginTop: 1 },
});
