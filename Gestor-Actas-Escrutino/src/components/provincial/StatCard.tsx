import { StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type StatCardProps = {
  value: number | string;
  label: string;
  color?: string;
};

/** Tarjeta con una cifra grande y su etiqueta. La cifra rebota al cambiar. */
export function StatCard({ value, label, color = colors.navy }: StatCardProps) {
  return (
    <View style={styles.card} accessibilityLabel={`${label}: ${value}`}>
      <Animated.Text
        key={String(value)}
        entering={ZoomIn.springify().damping(13)}
        style={[styles.value, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Animated.Text>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minHeight: 92,
    padding: 14,
  },
  value: { fontFamily: fonts.bold, fontSize: 28 },
  label: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
});
