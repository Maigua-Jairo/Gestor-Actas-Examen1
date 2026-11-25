import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { ZoomIn } from "react-native-reanimated";

import { reglasClave } from "@/domain/schemas/auth";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type RuleState = "pending" | "ok" | "error";

type PasswordChecklistProps = {
  password: string;
  confirmation: string;
  /** Tras un intento de envío, las reglas incumplidas se marcan en rojo. */
  showErrors: boolean;
};

/** Requisitos de la clave que se marcan a medida que la persona escribe. */
export function PasswordChecklist({
  password,
  confirmation,
  showErrors,
}: PasswordChecklistProps) {
  const rules: { label: string; state: RuleState }[] = reglasClave.map(
    (regla) => ({
      label: regla.descripcion,
      state: regla.cumple(password) ? "ok" : showErrors ? "error" : "pending",
    }),
  );

  const matches = confirmation.length > 0 && confirmation === password;
  const mismatch =
    (confirmation.length > 0 && confirmation !== password) ||
    (showErrors && !matches);
  rules.push({
    label: "Las dos claves deben coincidir",
    state: matches ? "ok" : mismatch ? "error" : "pending",
  });

  return (
    <View style={styles.container} accessibilityRole="summary">
      <Text style={styles.title}>LA CLAVE DEBE TENER</Text>
      {rules.map((rule) => (
        <RuleRow key={rule.label} label={rule.label} state={rule.state} />
      ))}
    </View>
  );
}

function RuleRow({ label, state }: { label: string; state: RuleState }) {
  const textColor =
    state === "ok"
      ? colors.syncOkText
      : state === "error"
        ? colors.syncErrorText
        : colors.textMuted;

  return (
    <View
      style={styles.row}
      accessibilityLabel={`${label}: ${
        state === "ok" ? "cumple" : state === "error" ? "no cumple" : "pendiente"
      }`}
    >
      <View style={styles.iconSlot}>
        {state === "ok" ? (
          <Animated.View
            key="ok"
            entering={ZoomIn.springify().damping(12)}
            style={[styles.badge, styles.badgeOk]}
          >
            <Ionicons name="checkmark" size={14} color={colors.syncOkText} />
          </Animated.View>
        ) : state === "error" ? (
          <Animated.View
            key="error"
            entering={ZoomIn.duration(160)}
            style={[styles.badge, styles.badgeError]}
          >
            <Text style={styles.badgeErrorText}>!</Text>
          </Animated.View>
        ) : (
          <View style={[styles.badge, styles.badgePending]} />
        )}
      </View>
      <Text
        style={[
          styles.label,
          { color: textColor },
          state !== "pending" && styles.labelStrong,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  title: {
    color: colors.textAuxiliary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 2,
  },
  row: { alignItems: "center", flexDirection: "row", gap: 10 },
  iconSlot: { alignItems: "center", height: 22, justifyContent: "center", width: 22 },
  badge: {
    alignItems: "center",
    borderRadius: 11,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  badgeOk: { backgroundColor: colors.syncOkBg },
  badgeError: { backgroundColor: colors.syncErrorBg },
  badgeErrorText: {
    color: colors.syncErrorText,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  badgePending: {
    borderColor: colors.borderStrong,
    borderWidth: 1.5,
  },
  label: { fontFamily: fonts.regular, fontSize: 15 },
  labelStrong: { fontFamily: fonts.semiBold },
});
