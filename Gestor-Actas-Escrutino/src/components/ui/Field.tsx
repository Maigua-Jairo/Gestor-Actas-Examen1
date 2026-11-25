import { useEffect, useState, type ReactNode, type Ref } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type TextInputProps,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  textContentType?: TextInputProps["textContentType"];
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  secureTextEntry?: boolean;
  error?: string;
  hint?: string;
  /** Confirmación en verde cuando el valor es correcto (por ejemplo "Cédula válida"). */
  success?: string;
  maxLength?: number;
  disabled?: boolean;
  /** Elemento a la derecha del campo, por ejemplo el botón de mostrar clave. */
  rightAccessory?: ReactNode;
  inputRef?: Ref<TextInput>;
  /** Al cambiar este número, el campo se sacude si tiene error (intento de envío fallido). */
  shakeKey?: number;
};

export function Field({
  label,
  value,
  onChangeText,
  onBlur,
  onFocus,
  placeholder,
  keyboardType,
  autoCapitalize = "sentences",
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  secureTextEntry = false,
  error,
  hint,
  success,
  maxLength,
  disabled = false,
  rightAccessory,
  inputRef,
  shakeKey = 0,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);
  const hasError = useSharedValue(error ? 1 : 0);
  const offsetX = useSharedValue(0);

  useEffect(() => {
    hasError.set(withTiming(error ? 1 : 0, { duration: 160 }));
  }, [error, hasError]);

  useEffect(() => {
    if (shakeKey > 0 && error) {
      offsetX.set(
        withSequence(
          withTiming(-6, { duration: 50 }),
          withTiming(6, { duration: 50 }),
          withTiming(-4, { duration: 50 }),
          withTiming(4, { duration: 50 }),
          withTiming(0, { duration: 50 }),
        ),
      );
    }
    // Solo reacciona a nuevos intentos de envío, no a cada cambio del error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shakeKey]);

  const boxStyle = useAnimatedStyle(() => {
    const focusColor = interpolateColor(
      focus.get(),
      [0, 1],
      [colors.borderStrong, colors.primary],
    );
    return {
      borderColor: interpolateColor(
        hasError.get(),
        [0, 1],
        [focusColor, colors.syncErrorText],
      ),
      transform: [{ translateX: offsetX.get() }],
    };
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View
        style={[
          styles.box,
          focused && styles.boxFocused,
          disabled && styles.boxDisabled,
          boxStyle,
        ]}
      >
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          accessibilityHint={error}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => {
            setFocused(true);
            focus.set(withTiming(1, { duration: 160 }));
            onFocus?.();
          }}
          onBlur={() => {
            setFocused(false);
            focus.set(withTiming(0, { duration: 160 }));
            onBlur?.();
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textAuxiliary}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          submitBehavior={returnKeyType === "next" ? "submit" : undefined}
          secureTextEntry={secureTextEntry}
          maxLength={maxLength}
          editable={!disabled}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          underlineColorAndroid="transparent"
        />
        {rightAccessory}
      </Animated.View>
      {error ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={styles.messageRow}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Ionicons name="alert-circle" size={16} color={colors.syncErrorText} />
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      ) : success ? (
        <Animated.View entering={FadeIn.duration(160)} style={styles.messageRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.syncOkText} />
          <Text style={styles.successText}>{success}</Text>
        </Animated.View>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  box: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    minHeight: 54,
  },
  boxFocused: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  boxDisabled: { opacity: 0.55 },
  input: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  messageRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 6,
  },
  errorText: {
    color: colors.syncErrorText,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
  },
  successText: {
    color: colors.syncOkText,
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  hintText: {
    color: colors.textAuxiliary,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
});
