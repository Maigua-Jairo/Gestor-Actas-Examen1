import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeIn } from "react-native-reanimated";

import { LottieAnimation } from "./LottieAnimation";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export type EmptyStateProps = {
  title: string;
  message: string;
  /** Botón u otra acción opcional bajo el texto. */
  action?: ReactNode;
};

/** Pantalla o sección sin datos todavía, con la animación "No data found". */
export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(350)}
      style={styles.container}
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${message}`}
    >
      <LottieAnimation
        name="noData"
        size={170}
        loop
        fallback={
          <View style={styles.fallback}>
            <Ionicons name="file-tray-outline" size={36} color={colors.primary} />
          </View>
        }
      />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  fallback: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 40,
    height: 80,
    justifyContent: "center",
    marginTop: 45,
    width: 80,
  },
  title: { color: colors.navy, fontFamily: fonts.bold, fontSize: 20, textAlign: "center" },
  message: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  action: { alignSelf: "stretch", marginTop: 8 },
});
