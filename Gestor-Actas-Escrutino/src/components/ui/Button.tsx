import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "ghostDanger";

export type ButtonProps = {
  variant?: ButtonVariant;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  accessibilityHint?: string;
};

/**
 * Botón de la app. Al presionarlo cambia de tono (sin movimiento), para dar
 * respuesta clara sin animaciones que distraigan.
 */
export function Button({
  variant = "primary",
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  accessibilityHint,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const labelColor =
    variant === "secondary" || variant === "ghost"
      ? colors.primary
      : variant === "ghostDanger"
        ? colors.syncErrorText
        : colors.onPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.base,
            (variant === "ghost" || variant === "ghostDanger") && styles.ghost,
            variant === "secondary" && styles.secondary,
            variant === "danger" && styles.danger,
            pressed && variant === "secondary" && styles.secondaryPressed,
            pressed && (variant === "ghost" || variant === "ghostDanger") && styles.ghostPressed,
            pressed && (variant === "primary" || variant === "danger") && styles.pressed,
            disabled && styles.disabled,
          ]}
        >
          {variant === "primary" ? (
            <LinearGradient
              colors={
                pressed
                  ? [colors.primaryPressed, colors.primaryPressed]
                  : [colors.institutional, colors.primary]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={styles.content}>
            {loading ? <ActivityIndicator color={labelColor} /> : icon}
            <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 54,
    overflow: "hidden",
    paddingHorizontal: 18,
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 17,
    textAlign: "center",
  },
  secondary: {
    backgroundColor: colors.paper,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  secondaryPressed: { backgroundColor: colors.surfaceMuted },
  danger: { backgroundColor: colors.syncErrorText },
  ghost: { backgroundColor: "transparent", minHeight: 44 },
  ghostPressed: { backgroundColor: colors.surfaceMuted },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.5 },
});
