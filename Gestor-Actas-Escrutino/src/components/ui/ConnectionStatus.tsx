import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export type ConnectionStatusProps = {
  /** "inline": punto y texto simples. "pill": cápsula con fondo, para cabeceras. */
  variant?: "inline" | "pill";
};

export function ConnectionStatus({ variant = "inline" }: ConnectionStatusProps) {
  const { isConnected, isInternetReachable } = useNetInfo();
  // Mientras NetInfo no responde (null) no se asume que no hay conexión.
  const checking = isConnected === null;
  const online = isConnected === true && isInternetReachable !== false;

  const halo = useSharedValue(0);

  useEffect(() => {
    if (online) {
      halo.set(withRepeat(withTiming(1, { duration: 1400 }), -1, false));
    } else {
      cancelAnimation(halo);
      halo.set(0);
    }
  }, [online, halo]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - halo.get()),
    transform: [{ scale: 1 + halo.get() * 1.6 }],
  }));

  const dotColor = checking
    ? colors.textAuxiliary
    : online
      ? colors.syncOkText
      : colors.syncPendingText;
  const label = checking
    ? "Verificando conexión"
    : online
      ? "En línea"
      : "Sin conexión";

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Estado de conexión: ${label}`}
      style={[
        styles.row,
        variant === "pill" && styles.pill,
        variant === "pill" && {
          backgroundColor: online ? colors.syncOkBg : colors.syncPendingBg,
          borderColor: online ? colors.syncOkBorder : colors.syncPendingBorder,
        },
      ]}
    >
      <View style={styles.dotWrapper}>
        <Animated.View
          style={[styles.halo, { backgroundColor: dotColor }, haloStyle]}
        />
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
      </View>
      <Text
        style={[
          styles.label,
          variant === "pill" && {
            color: online ? colors.syncOkText : colors.syncPendingText,
            fontFamily: fonts.semiBold,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 30,
    paddingHorizontal: 12,
  },
  dotWrapper: {
    alignItems: "center",
    height: 10,
    justifyContent: "center",
    width: 10,
  },
  halo: {
    borderRadius: 5,
    height: 10,
    position: "absolute",
    width: 10,
  },
  dot: { borderRadius: 4, height: 8, width: 8 },
  label: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
});
