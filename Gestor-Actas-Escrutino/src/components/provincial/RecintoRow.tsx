import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Pill, ProgressBar } from "@/components/ui";
import { estadoDeRecinto, type AvanceRecinto } from "@/domain/schemas/seguimiento";
import { estadoRecintoVisual } from "@/presentation/provincial-ui";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type RecintoRowProps = {
  recinto: AvanceRecinto;
  index: number;
  last: boolean;
  onPress?: () => void;
};

/** Fila de recinto con avance de mesas y estado (páginas 13 y 16). */
export function RecintoRow({ recinto, index, last, onPress }: RecintoRowProps) {
  const estado = estadoDeRecinto(recinto);
  const visual = estadoRecintoVisual[estado];
  const detalle = [
    recinto.canton,
    `${recinto.completas} de ${recinto.totalMesas} mesas`,
    recinto.incidencias > 0
      ? `${recinto.incidencias} ${recinto.incidencias === 1 ? "incidencia" : "incidencias"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 45).duration(340)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${recinto.nombre}. ${visual.label}. ${detalle}`}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [styles.row, !last && styles.divider, pressed && styles.pressed]}
      >
        <View style={styles.top}>
          <View style={styles.texts}>
            <Text style={styles.name} numberOfLines={1}>
              {recinto.nombre}
            </Text>
            <Text style={styles.detail} numberOfLines={1}>
              {detalle}
            </Text>
          </View>
          <Pill label={visual.label} tone={visual.tone} />
        </View>
        <ProgressBar
          value={recinto.totalMesas > 0 ? recinto.completas / recinto.totalMesas : 0}
          accessibilityLabel={`Avance de ${recinto.nombre}`}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.paper, gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  divider: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  pressed: { backgroundColor: colors.background },
  top: { alignItems: "center", flexDirection: "row", gap: 10 },
  texts: { flex: 1 },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  detail: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
});
