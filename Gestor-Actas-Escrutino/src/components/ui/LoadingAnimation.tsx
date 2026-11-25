import { ActivityIndicator, StyleSheet, Text } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { LottieAnimation } from "./LottieAnimation";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

/** Carga de pantallas con muchos datos (provincia, recinto): reloj de arena animado. */
export function LoadingAnimation({ message }: { message: string }) {
  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
    >
      <LottieAnimation
        name="loading"
        size={130}
        loop
        fallback={<ActivityIndicator size="large" color={colors.primary} style={styles.fallback} />}
      />
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 6, paddingVertical: 32 },
  fallback: { marginTop: 45 },
  message: { color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 15, textAlign: "center" },
});
