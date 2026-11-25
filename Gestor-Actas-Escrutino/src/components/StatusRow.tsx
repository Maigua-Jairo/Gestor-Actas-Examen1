import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Pill, type PillTone } from "@/components/ui/Pill";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type StatusRowProps = {
  title: string;
  subtitle: string;
  pillLabel: string;
  pillTone: PillTone;
  /** Color de la barra lateral que resume el estado. */
  barColor: string;
  onPress: () => void;
  accessibilityHint?: string;
  /** Posición en la lista: escalona la animación de entrada. */
  index: number;
  last: boolean;
};

/** Fila de lista con barra de estado a la izquierda y etiqueta a la derecha. */
export function StatusRow({
  title,
  subtitle,
  pillLabel,
  pillTone,
  barColor,
  onPress,
  accessibilityHint,
  index,
  last,
}: StatusRowProps) {
  return (
    <Animated.View entering={FadeInDown.delay(120 + index * 50).duration(360)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${pillLabel}. ${subtitle}`}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
      >
        {({ pressed }) => (
          <View style={[styles.row, !last && styles.divider, pressed && styles.pressed]}>
            <View style={[styles.bar, { backgroundColor: barColor }]} />
            <View style={styles.texts}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            </View>
            <Pill label={pillLabel} tone={pillTone} />
            <Ionicons name="chevron-forward" size={18} color={colors.textAuxiliary} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    backgroundColor: colors.paper,
    flexDirection: "row",
    gap: 12,
    minHeight: 72,
    paddingRight: 12,
  },
  divider: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  pressed: { backgroundColor: colors.background },
  bar: { alignSelf: "stretch", borderRadius: 2, marginLeft: 14, marginVertical: 14, width: 4 },
  texts: { flex: 1 },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
});
