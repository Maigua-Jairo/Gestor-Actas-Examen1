import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import type { AvanceCanton } from "@/domain/schemas/seguimiento";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

const CHART_HEIGHT = 130;

/** Barras verticales de mesas reportadas por cantón (página 17 del diseño). */
export function CantonChart({ cantones }: { cantones: AvanceCanton[] }) {
  const visibles = cantones.slice(0, 5);
  const max = Math.max(1, ...visibles.map((canton) => canton.mesasReportadas));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>MESAS REPORTADAS POR CANTÓN</Text>
      {visibles.length === 0 ? (
        <Text style={styles.empty}>Aún no hay recintos en la provincia.</Text>
      ) : (
        <View style={styles.chart}>
          {visibles.map((canton, index) => (
            <View
              key={canton.canton}
              style={styles.column}
              accessibilityLabel={`${canton.canton}: ${canton.mesasReportadas} de ${canton.totalMesas} mesas reportadas`}
            >
              <Text style={styles.value}>{canton.mesasReportadas}</Text>
              <Column
                fraction={canton.mesasReportadas / max}
                delay={index * 80}
                strong={index % 2 === 0}
              />
              <Text style={styles.label} numberOfLines={1}>
                {canton.canton}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Column({ fraction, delay, strong }: { fraction: number; delay: number; strong: boolean }) {
  const height = useSharedValue(0);

  useEffect(() => {
    height.set(
      withDelay(delay, withTiming(fraction, { duration: 700, easing: Easing.out(Easing.cubic) })),
    );
  }, [fraction, delay, height]);

  const style = useAnimatedStyle(() => ({
    height: Math.max(4, height.get() * CHART_HEIGHT),
  }));

  return (
    <View style={styles.slot}>
      <Animated.View
        style={[
          styles.bar,
          { backgroundColor: strong ? colors.institutional : colors.chart[3] },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  title: { color: colors.textAuxiliary, fontFamily: fonts.semiBold, fontSize: 12, letterSpacing: 1 },
  empty: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15 },
  chart: { alignItems: "flex-end", flexDirection: "row", gap: 10 },
  column: { alignItems: "center", flex: 1, gap: 6 },
  slot: { height: CHART_HEIGHT, justifyContent: "flex-end", width: "100%" },
  bar: { borderTopLeftRadius: 10, borderTopRightRadius: 10, width: "100%" },
  value: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  label: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
});
