import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export type PillTone = "success" | "info" | "warning" | "danger" | "neutral";

export type PillProps = {
  label: string;
  tone: PillTone;
  icon?: ComponentProps<typeof Ionicons>["name"];
};

const tones: Record<PillTone, { bg: string; border: string; text: string }> = {
  success: { bg: colors.syncOkBg, border: colors.syncOkBorder, text: colors.syncOkText },
  info: { bg: colors.surfaceMuted, border: colors.borderSoftBlue, text: colors.primary },
  warning: {
    bg: colors.syncPendingBg,
    border: colors.syncPendingBorder,
    text: colors.syncPendingText,
  },
  danger: { bg: colors.syncErrorBg, border: colors.syncErrorBorder, text: colors.syncErrorText },
  neutral: { bg: colors.paper, border: colors.borderStrong, text: colors.textMuted },
};

/** Etiqueta de estado en forma de cápsula (Guardado, Pendiente, Falló…). */
export function Pill({ label, tone, icon }: PillProps) {
  const palette = tones[tone];
  return (
    <View
      style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      {icon ? <Ionicons name={icon} size={13} color={palette.text} /> : null}
      <Text style={[styles.label, { color: palette.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    minHeight: 28,
    paddingHorizontal: 11,
  },
  label: { fontFamily: fonts.semiBold, fontSize: 13 },
});
