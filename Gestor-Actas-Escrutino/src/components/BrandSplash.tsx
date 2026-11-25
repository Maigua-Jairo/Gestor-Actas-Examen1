import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type BrandSplashProps = {
  /** Mensaje bajo el logo ("Preparando su espacio…"). */
  message: string;
  /** Si hay contenido (error y botones), se muestra en una tarjeta y el logo deja de latir. */
  children?: ReactNode;
};

/** Pantalla de paso con la marca: carga inicial y verificación de enlaces. */
export function BrandSplash({ message, children }: BrandSplashProps) {
  const insets = useSafeAreaInsets();
  const pulse = useSharedValue(0);
  const busy = !children;

  useEffect(() => {
    pulse.set(
      busy
        ? withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true)
        : withTiming(0, { duration: 200 }),
    );
  }, [busy, pulse]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.get() * 0.06 }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulse.get()),
    transform: [{ scale: 1 + pulse.get() * 0.5 }],
  }));

  return (
    <LinearGradient
      colors={[colors.institutional, colors.primary, colors.accent]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screen}
    >
      <StatusBar style="light" />
      <View style={[styles.flag, { marginTop: insets.top }]}>
        <View style={[styles.stripe, styles.yellow]} />
        <View style={[styles.stripe, styles.blue]} />
        <View style={[styles.stripe, styles.red]} />
      </View>
      <View pointerEvents="none" style={[styles.circle, styles.circleTop]} />
      <View pointerEvents="none" style={[styles.circle, styles.circleBottom]} />

      <View style={styles.center}>
        <View style={styles.logoWrapper}>
          {busy ? <Animated.View style={[styles.halo, haloStyle]} /> : null}
          <Animated.View style={[styles.logo, logoStyle]}>
            <Ionicons name="shield-checkmark-outline" size={40} color={colors.onPrimary} />
          </Animated.View>
        </View>
        <Animated.Text entering={FadeInDown.duration(400)} style={styles.title}>
          Control Electoral
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.delay(100).duration(400)}
          style={styles.message}
          accessibilityLiveRegion="polite"
        >
          {message}
        </Animated.Text>
      </View>

      {children ? (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.card, { marginBottom: insets.bottom + 20 }]}
        >
          {children}
        </Animated.View>
      ) : null}
    </LinearGradient>
  );
}

/** Texto de apoyo dentro de la tarjeta de BrandSplash. */
export function BrandSplashText({ children }: { children: ReactNode }) {
  return <Text style={styles.cardText}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flag: { flexDirection: "row" },
  stripe: { height: 4 },
  yellow: { backgroundColor: colors.flagYellow, flex: 2 },
  blue: { backgroundColor: colors.navyDeep, flex: 1 },
  red: { backgroundColor: colors.flagRed, flex: 1 },
  circle: { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 999, position: "absolute" },
  circleTop: { height: 280, right: -90, top: -60, width: 280 },
  circleBottom: { bottom: -80, height: 220, left: -80, width: 220 },
  center: { alignItems: "center", flex: 1, gap: 10, justifyContent: "center", paddingHorizontal: 32 },
  logoWrapper: { alignItems: "center", height: 96, justifyContent: "center", marginBottom: 8, width: 96 },
  halo: {
    backgroundColor: colors.onPrimary,
    borderRadius: 28,
    height: 84,
    position: "absolute",
    width: 84,
  },
  logo: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: 26,
    borderWidth: 1.5,
    height: 84,
    justifyContent: "center",
    width: 84,
  },
  title: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 28 },
  message: { color: colors.surfaceMuted, fontFamily: fonts.regular, fontSize: 16, textAlign: "center" },
  card: {
    alignSelf: "center",
    backgroundColor: colors.background,
    borderRadius: 24,
    gap: 10,
    marginHorizontal: 20,
    maxWidth: 560,
    padding: 20,
    width: "90%",
  },
  cardText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
});
