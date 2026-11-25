import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count: number;
}

type FilterChipsProps<T extends string> = {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Filtros en forma de cápsulas con contador ("Todas · 9", "Revisar · 2"). */
export function FilterChips<T extends string>({ options, value, onChange }: FilterChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Animated.View key={option.value} layout={LinearTransition.duration(200)}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${option.label}: ${option.count}`}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.chip,
                active ? styles.chipActive : styles.chipIdle,
                pressed && !active && styles.chipPressed,
              ]}
            >
              <Text style={[styles.text, active && styles.textActive]}>
                {option.label} · {option.count}
              </Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingRight: 4 },
  chip: {
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 16,
  },
  chipActive: { backgroundColor: colors.institutional, borderColor: colors.institutional },
  chipIdle: { backgroundColor: colors.paper, borderColor: colors.borderStrong },
  chipPressed: { backgroundColor: colors.surfaceMuted },
  text: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 14 },
  textActive: { color: colors.onPrimary },
});
