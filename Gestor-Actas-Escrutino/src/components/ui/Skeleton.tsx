import { useEffect } from "react";
import { type DimensionValue, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/theme/colors";

export type SkeletonProps = {
  height: number;
  width?: DimensionValue;
  radius?: number;
};

/** Bloque gris que "respira" mientras se cargan los datos. */
export function Skeleton({ height, width = "100%", radius = 12 }: SkeletonProps) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
  }, [pulse]);

  const style = useAnimatedStyle(() => ({ opacity: 0.45 + pulse.get() * 0.4 }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.block, { borderRadius: radius, height, width }, style]}
    />
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceMuted },
});
