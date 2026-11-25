import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type BrandHeroProps = {
  title: string;
  subtitle?: string;
};

/** Cabecera de marca para las pantallas de acceso: franja tricolor, degradado y logo. */
export function BrandHero({ title, subtitle }: BrandHeroProps) {
  const insets = useSafeAreaInsets();
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.set(
      withRepeat(
        withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [drift]);

  const bigCircleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drift.get() * 10 }],
  }));
  const smallCircleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drift.get() * -8 }],
  }));

  return (
    <View>
      <View style={[styles.flag, { paddingTop: insets.top }]}>
        <View style={[styles.flagStripe, styles.flagYellow]} />
        <View style={[styles.flagStripe, styles.flagBlue]} />
        <View style={[styles.flagStripe, styles.flagRed]} />
      </View>
      <LinearGradient
        colors={[colors.institutional, colors.primary, colors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.circle, styles.circleBig, bigCircleStyle]}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.circle, styles.circleSmall, smallCircleStyle]}
        />

        <Animated.View
          entering={ZoomIn.springify().damping(14)}
          style={styles.logo}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={36}
            color={colors.onPrimary}
          />
        </Animated.View>
        <Animated.Text
          entering={FadeInDown.delay(120).duration(380)}
          style={styles.title}
          accessibilityRole="header"
        >
          {title}
        </Animated.Text>
        {subtitle ? (
          <Animated.View entering={FadeInDown.delay(200).duration(380)}>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </Animated.View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  flag: {
    backgroundColor: colors.institutional,
    flexDirection: "row",
  },
  flagStripe: { height: 4 },
  flagYellow: { backgroundColor: colors.flagYellow, flex: 2 },
  flagBlue: { backgroundColor: colors.navyDeep, flex: 1 },
  flagRed: { backgroundColor: colors.flagRed, flex: 1 },
  hero: {
    alignItems: "center",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
    paddingBottom: 36,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  circle: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    position: "absolute",
  },
  circleBig: { height: 220, right: -70, top: -80, width: 220 },
  circleSmall: { bottom: -50, height: 140, left: -50, width: 140 },
  logo: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: 22,
    borderWidth: 1.5,
    height: 76,
    justifyContent: "center",
    marginBottom: 16,
    width: 76,
  },
  title: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 28,
    textAlign: "center",
  },
  subtitle: {
    color: colors.surfaceMuted,
    fontFamily: fonts.regular,
    fontSize: 15,
    marginTop: 6,
    textAlign: "center",
  },
});
