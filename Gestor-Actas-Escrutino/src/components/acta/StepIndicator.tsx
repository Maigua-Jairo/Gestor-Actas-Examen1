import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type StepIndicatorProps = {
  steps: readonly string[];
  current: number;
};

/** Barras de avance del asistente, pensadas para ir sobre el degradado azul. */
export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={`Paso ${current + 1} de ${steps.length}: ${steps[current]}`}
    >
      {steps.map((label, index) => (
        <StepBar
          key={label}
          label={label}
          state={index < current ? "done" : index === current ? "current" : "todo"}
        />
      ))}
    </View>
  );
}

function StepBar({
  label,
  state,
}: {
  label: string;
  state: "done" | "current" | "todo";
}) {
  const fill = useSharedValue(state === "todo" ? 0 : 1);

  useEffect(() => {
    fill.set(
      withTiming(state === "todo" ? 0 : 1, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [state, fill]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  return (
    <View style={styles.step}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
      <Text
        style={[styles.label, state === "current" && styles.labelCurrent]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", gap: 8, marginTop: 18 },
  step: { flex: 1, gap: 6 },
  track: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 999,
    height: 5,
    overflow: "hidden",
  },
  fill: { backgroundColor: colors.onPrimary, borderRadius: 999, height: "100%" },
  label: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  labelCurrent: { color: colors.onPrimary, fontFamily: fonts.bold },
});
