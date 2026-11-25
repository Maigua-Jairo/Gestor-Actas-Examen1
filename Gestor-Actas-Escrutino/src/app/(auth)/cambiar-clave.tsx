import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { useNetInfo } from "@react-native-community/netinfo";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PasswordChecklist } from "@/components/PasswordChecklist";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button, Field, LottieAnimation, Notice } from "@/components/ui";
import { cambiarClaveSchema } from "@/domain/schemas/auth";
import { authUseCases } from "@/presentation/auth";
import { rutaInicioPorRol } from "@/presentation/navigation";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type ChangePasswordValues = {
  password: string;
  confirmation: string;
};

/** Tiempo que se muestra la confirmación antes de entrar a la app. */
const SUCCESS_DELAY_MS = 1400;

export default function ChangePasswordScreen() {
  const { flujo } = useLocalSearchParams<{ flujo?: string }>();
  const isRecovery = flujo === "recuperacion";
  // Cambio voluntario desde el perfil: se puede cancelar y vuelve al perfil.
  const isProfile = flujo === "perfil";
  const { isConnected, isInternetReachable } = useNetInfo();
  const offline = isConnected === false || isInternetReachable === false;

  const confirmationRef = useRef<TextInput>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [showPasswords, setShowPasswords] = useState(false);

  const { control, handleSubmit } = useForm<ChangePasswordValues>({
    resolver: zodResolver(cambiarClaveSchema),
    mode: "onTouched",
    defaultValues: { password: "", confirmation: "" },
  });
  const [password, confirmation] = useWatch({
    control,
    name: ["password", "confirmation"],
  });

  useEffect(() => {
    if (!saved) {
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      if (isProfile) {
        router.back();
        return;
      }
      void (async () => {
        try {
          const user = await authUseCases.obtenerSesion.execute();
          const profile = user
            ? await authUseCases.obtenerPerfil.execute(user.id)
            : null;
          if (active) {
            router.replace(rutaInicioPorRol(profile?.rol));
          }
        } catch {
          if (active) {
            router.replace("/");
          }
        }
      })();
    }, SUCCESS_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [saved, isProfile]);

  async function savePassword(values: ChangePasswordValues): Promise<void> {
    setLoading(true);
    setError("");
    try {
      await authUseCases.cambiarClave.execute(values.password, values.confirmation);
      setSaved(true);
    } catch (changeError) {
      setError(
        changeError instanceof Error
          ? changeError.message
          : "No fue posible guardar la clave. Inténtelo nuevamente.",
      );
      setShakeKey((value) => value + 1);
    } finally {
      setLoading(false);
    }
  }

  const submit = handleSubmit(savePassword, () => {
    setAttempted(true);
    setShakeKey((value) => value + 1);
  });

  async function signOut(): Promise<void> {
    try {
      await authUseCases.cerrarSesion.execute();
    } finally {
      router.replace("/(auth)/login");
    }
  }

  const eyeToggle = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={showPasswords ? "Ocultar claves" : "Mostrar claves"}
      hitSlop={8}
      onPress={() => setShowPasswords((visible) => !visible)}
      style={styles.eyeButton}
    >
      <Ionicons
        name={showPasswords ? "eye-off-outline" : "eye-outline"}
        size={22}
        color={colors.textAuxiliary}
      />
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader
            eyebrow={isProfile ? "Perfil" : isRecovery ? "Recuperación" : "Primer ingreso"}
            title={
              isProfile ? "Cambiar clave" : isRecovery ? "Cree una nueva clave" : "Cree su clave"
            }
            subtitle={
              isProfile
                ? "Elija una clave nueva. La anterior dejará de funcionar."
                : isRecovery
                  ? "Elija una clave que no haya usado antes."
                  : "Solo usted conocerá esta clave. Ya no la necesitará el coordinador."
            }
            onBack={isProfile && !saved ? () => router.back() : undefined}
          />

          <View style={styles.body}>
            {saved ? (
              <SavedConfirmation returnsToProfile={isProfile} />
            ) : (
              <>
                <Animated.View
                  entering={FadeInDown.delay(120).duration(420)}
                  style={styles.card}
                >
                  <Controller
                    control={control}
                    name="password"
                    render={({ field, fieldState }) => (
                      <Field
                        label="Nueva clave"
                        value={field.value}
                        onChangeText={(value) => {
                          field.onChange(value);
                          setError("");
                        }}
                        onBlur={field.onBlur}
                        error={fieldState.error?.message}
                        secureTextEntry={!showPasswords}
                        autoCapitalize="none"
                        autoComplete="new-password"
                        textContentType="newPassword"
                        returnKeyType="next"
                        onSubmitEditing={() => confirmationRef.current?.focus()}
                        disabled={loading}
                        shakeKey={shakeKey}
                        rightAccessory={eyeToggle}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="confirmation"
                    render={({ field, fieldState }) => (
                      <Field
                        inputRef={confirmationRef}
                        label="Repita la nueva clave"
                        value={field.value}
                        onChangeText={(value) => {
                          field.onChange(value);
                          setError("");
                        }}
                        onBlur={field.onBlur}
                        error={fieldState.error?.message}
                        secureTextEntry={!showPasswords}
                        autoCapitalize="none"
                        autoComplete="new-password"
                        textContentType="newPassword"
                        returnKeyType="done"
                        onSubmitEditing={() => void submit()}
                        disabled={loading}
                        shakeKey={shakeKey}
                      />
                    )}
                  />
                </Animated.View>

                <Animated.View
                  entering={FadeInDown.delay(220).duration(420)}
                  style={styles.card}
                >
                  <PasswordChecklist
                    password={password}
                    confirmation={confirmation}
                    showErrors={attempted}
                  />
                </Animated.View>

                {offline ? (
                  <Notice tone="warning">
                    Necesita conexión a internet para guardar la clave.
                  </Notice>
                ) : null}
                {error ? <Notice tone="error">{error}</Notice> : null}
              </>
            )}
          </View>
        </ScrollView>

        {saved ? null : (
          <SafeAreaView edges={["bottom"]} style={styles.footer}>
            <Button
              label={
                loading
                  ? "Guardando…"
                  : isRecovery || isProfile
                    ? "Guardar clave"
                    : "Guardar y entrar"
              }
              onPress={() => void submit()}
              loading={loading}
              disabled={offline}
            />
            {isProfile ? (
              <Button
                variant="ghost"
                label="Cancelar"
                onPress={() => router.back()}
                disabled={loading}
              />
            ) : (
              <Button
                variant="ghost"
                label="Cerrar sesión"
                onPress={() => void signOut()}
                disabled={loading}
              />
            )}
          </SafeAreaView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function SavedConfirmation({ returnsToProfile }: { returnsToProfile: boolean }) {
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.card, styles.savedCard]}
      accessibilityLiveRegion="polite"
    >
      <LottieAnimation
        name="success"
        size={140}
        fallback={
          <Animated.View entering={ZoomIn.springify().damping(11)} style={styles.savedIcon}>
            <Ionicons name="checkmark" size={40} color={colors.onPrimary} />
          </Animated.View>
        }
      />
      <Text style={styles.savedTitle} accessibilityRole="header">
        Clave guardada
      </Text>
      <Text style={styles.savedText}>
        {returnsToProfile
          ? "Desde ahora ingrese con su nueva clave. Volviendo a su perfil…"
          : "Desde ahora ingrese con su nueva clave. Entrando a la aplicación…"}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  body: {
    alignSelf: "center",
    gap: 14,
    maxWidth: 560,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    width: "100%",
  },
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 2,
    gap: 16,
    padding: 20,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  eyeButton: {
    alignItems: "center",
    height: 52,
    justifyContent: "center",
    width: 48,
  },
  footer: {
    backgroundColor: colors.paper,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 4,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  savedCard: { alignItems: "center", paddingVertical: 32 },
  savedIcon: {
    alignItems: "center",
    backgroundColor: colors.syncOkText,
    borderRadius: 36,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  savedTitle: {
    color: colors.navy,
    fontFamily: fonts.bold,
    fontSize: 22,
  },
  savedText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
});
