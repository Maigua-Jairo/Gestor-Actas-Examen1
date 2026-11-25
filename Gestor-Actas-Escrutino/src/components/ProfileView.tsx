import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";

import { LightHeader } from "@/components/LightHeader";
import { Button, Notice, Skeleton } from "@/components/ui";
import type { PerfilUsuario } from "@/data/auth.repository";
import { cedulaOculta, haceCuanto, iniciales } from "@/presentation/format";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export interface FilaPerfil {
  label: string;
  value: string;
}

type ProfileViewProps = {
  profile: PerfilUsuario | null;
  roleLabel: string;
  /** Línea bajo el rol: provincia, recinto, mesas a cargo… */
  contextLine: string | null;
  /** Datos propios del rol (mesas, veedores, recintos a cargo). */
  extraRows: FilaPerfil[];
  queueCount: number;
  lastSync: string | null;
  error: string;
  signingOut: boolean;
  onSignOut: () => void;
};

/** Perfil común a los tres roles (páginas 23, 24 y 25 del diseño). */
export function ProfileView({
  profile,
  roleLabel,
  contextLine,
  extraRows,
  queueCount,
  lastSync,
  error,
  signingOut,
  onSignOut,
}: ProfileViewProps) {
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? "—";

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LightHeader eyebrow="PERFIL" />

        <View style={styles.body}>
          {error ? <Notice tone="error">{error}</Notice> : null}

          {!profile && !error ? (
            <View style={styles.loading}>
              <Skeleton height={110} radius={22} />
              <Skeleton height={190} radius={20} />
              <Skeleton height={140} radius={20} />
            </View>
          ) : null}

          {profile ? (
            <>
              <Animated.View entering={FadeInDown.duration(400)}>
                <LinearGradient
                  colors={[colors.institutional, colors.primary, colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.identity}
                >
                  <View pointerEvents="none" style={styles.identityCircle} />
                  <Animated.View
                    entering={ZoomIn.delay(120).springify().damping(12)}
                    style={styles.avatar}
                  >
                    <Text style={styles.avatarText}>
                      {iniciales(profile.nombres, profile.apellidos)}
                    </Text>
                  </Animated.View>
                  <View style={styles.identityTexts}>
                    <Text style={styles.name} accessibilityRole="header">
                      {profile.nombres} {profile.apellidos}
                    </Text>
                    <Text style={styles.role}>{roleLabel}</Text>
                    {contextLine ? (
                      <Text style={styles.context} numberOfLines={2}>
                        {contextLine}
                      </Text>
                    ) : null}
                  </View>
                </LinearGradient>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.card}>
                <Row label="Correo" value={profile.email} />
                <Row label="Teléfono" value={profile.telefono || "No registrado"} />
                <Row label="Cédula" value={cedulaOculta(profile.cedula)} />
                {extraRows.map((row) => (
                  <Row key={row.label} label={row.label} value={row.value} />
                ))}
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.card}>
                <Row
                  label="Última sincronización"
                  value={lastSync ? haceCuanto(lastSync) : "Aún no"}
                />
                <Row
                  label="Actas en cola"
                  value={String(queueCount)}
                  highlight={queueCount > 0 ? colors.syncPendingText : undefined}
                />
                <Row label="Versión de la app" value={appVersion} />
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(260).duration(400)} style={styles.actions}>
                {confirmingSignOut ? (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.confirm}>
                    <Notice tone="warning">
                      {queueCount > 0
                        ? `Tiene ${queueCount} ${queueCount === 1 ? "acta" : "actas"} sin enviar. Se conservan en el teléfono, pero solo se enviarán cuando vuelva a ingresar con esta cuenta.`
                        : "¿Desea cerrar la sesión en este teléfono?"}
                    </Notice>
                    <View style={styles.confirmRow}>
                      <View style={styles.flex}>
                        <Button
                          variant="secondary"
                          label="Cancelar"
                          onPress={() => setConfirmingSignOut(false)}
                          disabled={signingOut}
                        />
                      </View>
                      <View style={styles.flex}>
                        <Button
                          variant="danger"
                          label="Cerrar sesión"
                          loading={signingOut}
                          onPress={onSignOut}
                        />
                      </View>
                    </View>
                  </Animated.View>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      label="Cambiar clave"
                      icon={<Ionicons name="key-outline" size={20} color={colors.primary} />}
                      onPress={() =>
                        router.push({
                          pathname: "/(auth)/cambiar-clave",
                          params: { flujo: "perfil" },
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      label="Cerrar sesión"
                      onPress={() => setConfirmingSignOut(true)}
                    />
                  </>
                )}
              </Animated.View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <View style={styles.row} accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, highlight ? { color: highlight } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {value}
      </Text>
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
    paddingTop: 6,
    width: "100%",
  },
  loading: { gap: 12 },
  identity: {
    alignItems: "center",
    borderRadius: 22,
    flexDirection: "row",
    gap: 16,
    overflow: "hidden",
    padding: 20,
  },
  identityCircle: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    height: 160,
    position: "absolute",
    right: -40,
    top: -60,
    width: 160,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 18,
    borderWidth: 1.5,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  avatarText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 22 },
  identityTexts: { flex: 1, gap: 2 },
  name: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 20 },
  role: { color: colors.surfaceMuted, fontFamily: fonts.semiBold, fontSize: 15 },
  context: { color: colors.surfaceMuted, fontFamily: fonts.regular, fontSize: 14 },
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 50,
  },
  rowLabel: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15 },
  rowValue: {
    color: colors.text,
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: "right",
  },
  actions: { gap: 4 },
  confirm: { gap: 10 },
  confirmRow: { flexDirection: "row", gap: 10 },
});
