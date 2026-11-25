import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { useNetInfo } from "@react-native-community/netinfo";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button, Field, LottieAnimation, Notice } from "@/components/ui";
import { recuperarClaveSchema } from "@/domain/schemas/auth";
import { authUseCases } from "@/presentation/auth";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

declare const process: {
  env: Record<string, string | undefined>;
};

type RecoveryValues = { email: string };

/** Supabase limita el reenvío de correos a un mismo usuario a uno por minuto. */
const RESEND_COOLDOWN_SECONDS = 60;

function goToLogin(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(auth)/login");
  }
}

export default function RecoverPasswordScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { isConnected, isInternetReachable } = useNetInfo();
  const offline = isConnected === false || isInternetReachable === false;

  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  const { control, handleSubmit } = useForm<RecoveryValues>({
    resolver: zodResolver(recuperarClaveSchema),
    mode: "onTouched",
    defaultValues: { email: typeof emailParam === "string" ? emailParam : "" },
  });

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendLink(values: RecoveryValues): Promise<void> {
    setLoading(true);
    setError("");

    try {
      const redirectBase = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL;
      if (!redirectBase) {
        throw new Error("Falta configurar la URL de retorno de autenticación.");
      }

      const redirect = new URL(redirectBase);
      redirect.searchParams.set("flow", "recovery");
      await authUseCases.recuperarClave.execute(values.email, redirect.toString());
      setSentTo(values.email.trim().toLowerCase());
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (recoverError) {
      setError(
        recoverError instanceof Error
          ? recoverError.message
          : "No fue posible enviar el enlace. Inténtelo nuevamente.",
      );
      setShakeKey((value) => value + 1);
    } finally {
      setLoading(false);
    }
  }

  const submit = handleSubmit(sendLink, () => setShakeKey((value) => value + 1));

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
            eyebrow="Acceso"
            title="Recuperar clave"
            subtitle="Le enviaremos un enlace a su correo verificado."
            onBack={goToLogin}
          />

          <SafeAreaView edges={["bottom"]} style={styles.body}>
            {sentTo ? (
              <SentConfirmation
                email={sentTo}
                cooldown={cooldown}
                loading={loading}
                offline={offline}
                error={error}
                onResend={() => void sendLink({ email: sentTo })}
                onChangeEmail={() => {
                  setSentTo(null);
                  setError("");
                }}
              />
            ) : (
              <Animated.View
                entering={FadeInDown.delay(120).duration(420)}
                style={styles.card}
              >
                <Controller
                  control={control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <Field
                      label="Correo electrónico"
                      value={field.value}
                      onChangeText={(value) => {
                        field.onChange(value);
                        setError("");
                      }}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                      hint="Use el mismo correo con el que inicia sesión."
                      placeholder="nombre@correo.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      textContentType="emailAddress"
                      returnKeyType="send"
                      onSubmitEditing={() => void submit()}
                      disabled={loading}
                      shakeKey={shakeKey}
                    />
                  )}
                />

                {offline ? (
                  <Notice tone="warning">
                    Necesita conexión a internet para enviar el enlace.
                  </Notice>
                ) : null}
                {error ? <Notice tone="error">{error}</Notice> : null}

                <Button
                  label={loading ? "Enviando…" : "Enviar enlace"}
                  onPress={() => void submit()}
                  loading={loading}
                  disabled={offline}
                />
              </Animated.View>
            )}

            <Animated.View
              entering={FadeInDown.delay(220).duration(420)}
              style={styles.infoCard}
            >
              <Text style={styles.infoTitle}>SI EL CORREO NO ESTÁ VERIFICADO</Text>
              <Text style={styles.infoText}>
                La recuperación solo está disponible para correos verificados.
                Pida ayuda a su coordinador para verificarlo.
              </Text>
            </Animated.View>

            <View style={styles.spacer} />

            <Button
              variant="ghost"
              label="Volver a iniciar sesión"
              onPress={goToLogin}
            />
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

type SentConfirmationProps = {
  email: string;
  cooldown: number;
  loading: boolean;
  offline: boolean;
  error: string;
  onResend: () => void;
  onChangeEmail: () => void;
};

function SentConfirmation({
  email,
  cooldown,
  loading,
  offline,
  error,
  onResend,
  onChangeEmail,
}: SentConfirmationProps) {
  const ripple = useSharedValue(0);

  useEffect(() => {
    ripple.set(withDelay(300, withRepeat(withTiming(1, { duration: 1600 }), 3, false)));
  }, [ripple]);

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - ripple.get()),
    transform: [{ scale: 1 + ripple.get() * 0.8 }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.card}>
      <View style={styles.sentRow}>
        <LottieAnimation
          name="success"
          size={76}
          fallback={
            <View style={styles.checkWrapper}>
              <Animated.View style={[styles.checkRipple, rippleStyle]} />
              <Animated.View
                entering={ZoomIn.springify().damping(12)}
                style={styles.checkCircle}
              >
                <Ionicons name="checkmark" size={26} color={colors.onPrimary} />
              </Animated.View>
            </View>
          }
        />
        <View style={styles.flex}>
          <Text style={styles.sentTitle} accessibilityRole="header">
            Enlace enviado
          </Text>
          <Text style={styles.sentText}>
            Si <Text style={styles.sentEmail}>{email}</Text> corresponde a una
            cuenta verificada, recibirá un enlace. Vence en 1 hora y solo sirve
            una vez.
          </Text>
        </View>
      </View>

      <Notice tone="info">
        Revise también la carpeta de correo no deseado (spam).
      </Notice>
      {error ? <Notice tone="error">{error}</Notice> : null}

      <Button
        variant="secondary"
        label={
          cooldown > 0 ? `Reenviar enlace en ${cooldown} s` : "Reenviar enlace"
        }
        onPress={onResend}
        loading={loading}
        disabled={cooldown > 0 || offline}
      />
      <Button variant="ghost" label="Usar otro correo" onPress={onChangeEmail} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  body: {
    alignSelf: "center",
    flexGrow: 1,
    gap: 14,
    maxWidth: 560,
    paddingBottom: 16,
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
  infoCard: {
    backgroundColor: colors.paper,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    padding: 18,
  },
  infoTitle: {
    color: colors.textAuxiliary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: 1,
  },
  infoText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
  },
  spacer: { flexGrow: 1 },
  sentRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
  },
  checkWrapper: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  checkRipple: {
    backgroundColor: colors.syncOkText,
    borderRadius: 24,
    height: 48,
    position: "absolute",
    width: 48,
  },
  checkCircle: {
    alignItems: "center",
    backgroundColor: colors.syncOkText,
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  sentTitle: {
    color: colors.navy,
    fontFamily: fonts.bold,
    fontSize: 19,
  },
  sentText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 4,
  },
  sentEmail: { color: colors.text, fontFamily: fonts.semiBold },
});
