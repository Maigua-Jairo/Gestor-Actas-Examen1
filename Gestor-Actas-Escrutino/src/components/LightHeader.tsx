import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type LightHeaderProps = {
  eyebrow: string;
  /** Opcional: el perfil, por ejemplo, muestra el nombre en una tarjeta. */
  title?: string;
  /** Contenido a la derecha del indicador de conexión (por ejemplo "2 en cola"). */
  rightSlot?: ReactNode;
};

/** Cabecera clara de las pestañas principales de cada rol (inicio, mesas, actas…). */
export function LightHeader({ eyebrow, title, rightSlot }: LightHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[colors.surfaceMuted, colors.background]}
      style={[styles.header, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.pills}>
        <ConnectionStatus variant="pill" />
        {rightSlot}
      </View>
      <Text style={styles.eyebrow} numberOfLines={1}>
        {eyebrow}
      </Text>
      {title ? (
        <Animated.Text
          entering={FadeInDown.duration(380)}
          style={styles.title}
          accessibilityRole="header"
        >
          {title}
        </Animated.Text>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6, paddingBottom: 8, paddingHorizontal: 20 },
  pills: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  eyebrow: {
    color: colors.textAuxiliary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: 1,
  },
  title: { color: colors.navy, fontFamily: fonts.bold, fontSize: 28, lineHeight: 34 },
});
