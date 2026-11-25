import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/theme/colors";

export type ProgressBarProps = {
  /** Avance entre 0 y 1. */
  value: number;
  /** "light" para fondos claros, "onDark" para usar sobre degradados azules. */
  tone?: "light" | "onDark";
  accessibilityLabel?: string;
};

export function ProgressBar({
  value,
  tone = "light",
  accessibilityLabel,
}: ProgressBarProps) {
  const normalized = Math.min(1, Math.max(0, value));
  const [trackWidth, setTrackWidth] = useState(0);
  const width = useSharedValue(0);

  useEffect(() => {
    width.set(
      withTiming(normalized * trackWidth, {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [normalized, trackWidth, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: width.get() }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(normalized * 100) }}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      style={[styles.track, tone === "onDark" ? styles.trackDark : styles.trackLight]}
    >
      <Animated.View
        style={[
          styles.fill,
          tone === "onDark" ? styles.fillDark : styles.fillLight,
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: 999, height: 8, overflow: "hidden" },
  trackLight: { backgroundColor: colors.surfaceMuted },
  trackDark: { backgroundColor: "rgba(255,255,255,0.25)" },
  fill: { borderRadius: 999, height: "100%" },
  fillLight: { backgroundColor: colors.primary },
  fillDark: { backgroundColor: colors.onPrimary },
});
