import { useEffect, useState, type Ref } from "react";
import {
  StyleSheet,
  TextInput,
  type ReturnKeyTypeOptions,
} from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type CountInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  accessibilityLabel: string;
  invalid?: boolean;
  /** "lg" ocupa todo el ancho (total de sufragantes); "md" es la casilla de votos. */
  size?: "lg" | "md";
  editable?: boolean;
  inputRef?: Ref<TextInput>;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
};

/** Casilla numérica grande para transcribir cifras del acta. Solo acepta dígitos. */
export function CountInput({
  value,
  onChangeText,
  onBlur,
  accessibilityLabel,
  invalid = false,
  size = "md",
  editable = true,
  inputRef,
  returnKeyType = "next",
  onSubmitEditing,
}: CountInputProps) {
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);
  const error = useSharedValue(invalid ? 1 : 0);

  useEffect(() => {
    error.set(withTiming(invalid ? 1 : 0, { duration: 160 }));
  }, [invalid, error]);

  const boxStyle = useAnimatedStyle(() => {
    const base = interpolateColor(
      focus.get(),
      [0, 1],
      [colors.borderStrong, colors.primary],
    );
    return {
      borderColor: interpolateColor(error.get(), [0, 1], [base, colors.syncErrorText]),
      backgroundColor: interpolateColor(
        error.get(),
        [0, 1],
        [colors.background, colors.syncErrorBg],
      ),
    };
  });

  return (
    <Animated.View
      style={[
        styles.box,
        size === "lg" ? styles.boxLarge : styles.boxMedium,
        focused && styles.boxFocused,
        boxStyle,
      ]}
    >
      <TextInput
        ref={inputRef}
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, "").slice(0, 5))}
        onFocus={() => {
          setFocused(true);
          focus.set(withTiming(1, { duration: 140 }));
        }}
        onBlur={() => {
          setFocused(false);
          focus.set(withTiming(0, { duration: 140 }));
          onBlur?.();
        }}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={5}
        selectTextOnFocus
        editable={editable}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        submitBehavior={returnKeyType === "next" ? "submit" : undefined}
        placeholder="0"
        placeholderTextColor={colors.textAuxiliary}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        style={[styles.input, size === "lg" ? styles.inputLarge : styles.inputMedium]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 14, borderWidth: 1.5, justifyContent: "center" },
  boxMedium: { height: 58, width: 92 },
  boxLarge: { height: 64, width: "100%" },
  boxFocused: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  input: {
    color: colors.text,
    fontFamily: fonts.bold,
    height: "100%",
    paddingHorizontal: 12,
  },
  inputMedium: { fontSize: 24, textAlign: "center" },
  inputLarge: { fontSize: 28 },
});
