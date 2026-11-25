import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Texto pequeño en mayúsculas sobre el título, por ejemplo "ACCESO" o "MESA JRV 7". */
  eyebrow?: string;
  /** Si se define, muestra el botón para volver. */
  onBack?: () => void;
  /** Oculta el indicador de conexión (por defecto se muestra). */
  hideConnection?: boolean;
  /** Contenido extra al pie de la cabecera, por ejemplo los pasos de un formulario. */
  children?: ReactNode;
  /** Sin botón de volver: elemento a la derecha de la conexión (por ejemplo "2 en cola"). */
  rightSlot?: ReactNode;
};

/** Cabecera con degradado para pantallas internas, según el diseño de referencia. */
export function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  onBack,
  hideConnection = false,
  children,
  rightSlot,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[colors.institutional, colors.primary, colors.accent]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + 12 }]}
    >
      <View pointerEvents="none" style={styles.circle} />

      {onBack ? (
        // Pantalla interna: volver · etiqueta centrada · conexión.
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.onPrimary} />
          </Pressable>
          {eyebrow ? (
            <Text style={styles.eyebrow} numberOfLines={1}>
              {eyebrow.toUpperCase()}
            </Text>
          ) : (
            <View style={styles.flex} />
          )}
          {hideConnection ? (
            <View style={styles.backPlaceholder} />
          ) : (
            <ConnectionStatus variant="pill" />
          )}
        </View>
      ) : (
        // Pestaña principal: conexión a la izquierda y etiqueta sobre el título.
        <>
          <View style={[styles.topRow, styles.tabTopRow]}>
            {hideConnection ? <View /> : <ConnectionStatus variant="pill" />}
            {rightSlot ?? null}
          </View>
          {eyebrow ? (
            <Text style={styles.eyebrowLeft} numberOfLines={1}>
              {eyebrow.toUpperCase()}
            </Text>
          ) : null}
        </>
      )}

      <Animated.Text
        entering={FadeInDown.duration(360)}
        accessibilityRole="header"
        style={styles.title}
      >
        {title}
      </Animated.Text>
      {subtitle ? (
        <Animated.View entering={FadeInDown.delay(80).duration(360)}>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </Animated.View>
      ) : null}
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  circle: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 999,
    height: 200,
    position: "absolute",
    right: -60,
    top: -70,
    width: 200,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
    minHeight: 44,
  },
  flex: { flex: 1 },
  tabTopRow: { justifyContent: "space-between", marginBottom: 12 },
  eyebrowLeft: {
    color: colors.surfaceMuted,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  backButtonPressed: { backgroundColor: "rgba(255,255,255,0.28)" },
  backPlaceholder: { width: 44 },
  eyebrow: {
    color: colors.surfaceMuted,
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  title: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    color: colors.surfaceMuted,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 6,
  },
});
