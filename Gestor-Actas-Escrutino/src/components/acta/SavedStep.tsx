import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

import { Button, LottieAnimation } from "@/components/ui";
import type { DignidadActa } from "@/domain/schemas/acta";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type SavedStepProps = {
  /** "enviada": confirmada por el servidor. "en_cola": guardada en el teléfono. */
  resultado: "enviada" | "en_cola";
  numeroJrv: number;
  dignidad: DignidadActa;
  siguienteDignidad: DignidadActa | null;
  onContinue: () => void;
  onFinish: () => void;
};

const label = (dignidad: DignidadActa) =>
  dignidad === "ALCALDIA" ? "Alcaldía" : "Prefectura";

export function SavedStep({
  resultado,
  numeroJrv,
  dignidad,
  siguienteDignidad,
  onContinue,
  onFinish,
}: SavedStepProps) {
  const sent = resultado === "enviada";
  const tint = sent ? colors.syncOkText : colors.syncPendingText;
  const ripple = useSharedValue(0);

  useEffect(() => {
    ripple.set(withDelay(250, withRepeat(withTiming(1, { duration: 1500 }), 3, false)));
  }, [ripple]);

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - ripple.get()),
    transform: [{ scale: 1 + ripple.get() * 0.9 }],
  }));

  // Ícono animado con Reanimated: para "en cola" y como respaldo si Lottie no está.
  const icon = (
    <View style={styles.iconWrapper}>
      <Animated.View style={[styles.ripple, { backgroundColor: tint }, rippleStyle]} />
      <Animated.View
        entering={ZoomIn.springify().damping(11)}
        style={[styles.icon, { backgroundColor: tint }]}
      >
        <Ionicons
          name={sent ? "checkmark" : "phone-portrait-outline"}
          size={sent ? 46 : 38}
          color={colors.onPrimary}
        />
      </Animated.View>
    </View>
  );

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      {sent ? (
        <LottieAnimation name="success" size={150} fallback={icon} />
      ) : (
        icon
      )}

      <Animated.Text
        entering={FadeInDown.delay(150).duration(380)}
        style={styles.title}
        accessibilityRole="header"
      >
        {sent ? "Acta enviada" : "Acta guardada en el teléfono"}
      </Animated.Text>
      <Animated.View entering={FadeInDown.delay(220).duration(380)}>
        <Text style={styles.text}>
          {sent
            ? `El acta de ${label(dignidad).toLowerCase()} de la JRV ${numeroJrv} llegó al recinto.`
            : `Se enviará sola cuando el teléfono recupere la señal. Puede verla en "Pendientes".`}
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(380)} style={styles.actions}>
        {siguienteDignidad ? (
          <Button
            label={`Continuar con ${label(siguienteDignidad)} · JRV ${numeroJrv}`}
            onPress={onContinue}
          />
        ) : null}
        <Button
          variant={siguienteDignidad ? "secondary" : "primary"}
          label="Volver al inicio"
          onPress={onFinish}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 14, paddingTop: 24 },
  iconWrapper: {
    alignItems: "center",
    height: 96,
    justifyContent: "center",
    marginBottom: 8,
    width: 96,
  },
  ripple: { borderRadius: 48, height: 96, position: "absolute", width: 96 },
  icon: {
    alignItems: "center",
    borderRadius: 48,
    height: 96,
    justifyContent: "center",
    width: 96,
  },
  title: {
    color: colors.navy,
    fontFamily: fonts.bold,
    fontSize: 24,
    textAlign: "center",
  },
  text: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
  actions: { alignSelf: "stretch", gap: 10, marginTop: 12 },
});
