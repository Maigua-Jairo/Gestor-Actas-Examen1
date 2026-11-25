import { useCallback, useEffect, useRef, useState } from "react";
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
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { BrandHero } from "@/components/BrandHero";
import { Button, ConnectionStatus, Field, LottieAnimation, Notice } from "@/components/ui";
import {
  clearRememberedAccountEmail,
  getRememberedAccountEmail,
  saveRememberedAccountEmail,
} from "@/data/remembered-account.storage";
import { inicioSesionSchema } from "@/domain/schemas/auth";
import { authUseCases } from "@/presentation/auth";
import { rutaInicioPorRol } from "@/presentation/navigation";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type LoginValues = {
  email: string;
  password: string;
};

function getLoginErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No fue posible iniciar sesión. Inténtelo nuevamente.";
}

export default function LoginScreen() {
  const { confirmado } = useLocalSearchParams<{ confirmado?: string }>();
  const passwordRef = useRef<TextInput>(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [preferenceError, setPreferenceError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [welcome, setWelcome] = useState<{ route: Href; nombre: string | null } | null>(null);

  const { control, handleSubmit, setValue, getValues } = useForm<LoginValues>({
    resolver: zodResolver(inicioSesionSchema),
    // Valida al salir de cada campo: no muestra errores mientras la persona escribe.
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    let active = true;
    getRememberedAccountEmail()
      .then((savedEmail) => {
        if (active && savedEmail) {
          setValue("email", savedEmail);
          setRememberAccount(true);
        }
      })
      .catch(() => {
        if (active) {
          setPreferenceError(
            "No se pudo recuperar el correo guardado. Puede ingresarlo manualmente.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [setValue]);

  async function updateRememberedEmail(emailValue: string): Promise<void> {
    try {
      if (rememberAccount) {
        await saveRememberedAccountEmail(emailValue);
      } else {
        await clearRememberedAccountEmail();
      }
    } catch {
      // Recordar el correo es una comodidad: un fallo aquí no debe impedir el ingreso.
    }
  }

  async function handleLogin(values: LoginValues): Promise<void> {
    setLoading(true);
    setAuthError("");
    try {
      const user = await authUseCases.iniciarSesion.execute(
        values.email,
        values.password,
      );
      await updateRememberedEmail(values.email.trim().toLowerCase());

      if (user.debeCambiarClave) {
        setWelcome({ route: "/(auth)/cambiar-clave", nombre: null });
        return;
      }

      const profile = await authUseCases.obtenerPerfil.execute(user.id);
      setWelcome({
        route: rutaInicioPorRol(profile?.rol),
        nombre: profile ? profile.nombres.trim().split(/\s+/)[0] : null,
      });
    } catch (error) {
      setAuthError(getLoginErrorMessage(error));
      setShakeKey((value) => value + 1);
    } finally {
      setLoading(false);
    }
  }

  const submit = handleSubmit(handleLogin, () => {
    setShakeKey((value) => value + 1);
  });

  if (welcome) {
    return <WelcomeOverlay nombre={welcome.nombre} route={welcome.route} />;
  }

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
          <BrandHero
            title="Control Electoral"
            subtitle="Escrutinio de su organización"
          />

          <SafeAreaView edges={["bottom"]} style={styles.body}>
            <Animated.Text
              entering={FadeInDown.delay(220).duration(380)}
              style={styles.sectionTitle}
              accessibilityRole="header"
            >
              Ingresar
            </Animated.Text>

            {confirmado ? (
              <Notice tone="success">
                Correo verificado. Ya puede iniciar sesión.
              </Notice>
            ) : null}

            <Animated.View
              entering={FadeInDown.delay(300).duration(420)}
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
                      setAuthError("");
                    }}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    placeholder="nombre@correo.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    disabled={loading}
                    shakeKey={shakeKey}
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field, fieldState }) => (
                  <Field
                    inputRef={passwordRef}
                    label="Clave"
                    value={field.value}
                    onChangeText={(value) => {
                      field.onChange(value);
                      setAuthError("");
                    }}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    placeholder="Ingrese su clave"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={() => void submit()}
                    disabled={loading}
                    shakeKey={shakeKey}
                    rightAccessory={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          showPassword ? "Ocultar clave" : "Mostrar clave"
                        }
                        hitSlop={8}
                        onPress={() => setShowPassword((visible) => !visible)}
                        style={styles.eyeButton}
                      >
                        <Ionicons
                          name={showPassword ? "eye-off-outline" : "eye-outline"}
                          size={22}
                          color={colors.textAuxiliary}
                        />
                      </Pressable>
                    }
                  />
                )}
              />

              <View style={styles.optionsRow}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberAccount, disabled: loading }}
                  disabled={loading}
                  hitSlop={6}
                  onPress={() => setRememberAccount((value) => !value)}
                  style={styles.rememberPress}
                >
                  <View
                    style={[
                      styles.checkbox,
                      rememberAccount && styles.checkboxChecked,
                    ]}
                  >
                    {rememberAccount ? (
                      <Animated.View entering={ZoomIn.duration(160)}>
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={colors.onPrimary}
                        />
                      </Animated.View>
                    ) : null}
                  </View>
                  <Text style={styles.rememberText}>Recordar correo</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="link"
                  hitSlop={8}
                  onPress={() =>
                    router.push({
                      pathname: "/(auth)/recuperar-clave",
                      params: { email: getValues("email").trim() },
                    })
                  }
                >
                  {({ pressed }) => (
                    <Text style={[styles.link, pressed && styles.linkPressed]}>
                      ¿Olvidó su clave?
                    </Text>
                  )}
                </Pressable>
              </View>

              {authError ? <Notice tone="error">{authError}</Notice> : null}
              {preferenceError ? (
                <Notice tone="warning">{preferenceError}</Notice>
              ) : null}

              <Button
                label={loading ? "Ingresando…" : "Ingresar"}
                onPress={() => void submit()}
                loading={loading}
              />
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(400).duration(420)}
              style={styles.footer}
            >
              <ConnectionStatus />
              <Notice tone="info">
                Su cuenta la crea su coordinador. Si es su primer ingreso, se le
                pedirá cambiar la clave.
              </Notice>
            </Animated.View>
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** La animación "Sign In" dura 6,5 s: se acelera para no hacer esperar. */
const WELCOME_SPEED = 2.5;
/** Tope por si la animación no avisa que terminó. */
const WELCOME_MAX_MS = 4000;

/** Bienvenida tras un ingreso correcto; al terminar la animación entra a la app. */
function WelcomeOverlay({ nombre, route }: { nombre: string | null; route: Href }) {
  const navigated = useRef(false);

  const enter = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    router.replace(route);
  }, [route]);

  useEffect(() => {
    const timer = setTimeout(enter, WELCOME_MAX_MS);
    return () => clearTimeout(timer);
  }, [enter]);

  return (
    <View style={styles.welcome} accessibilityLiveRegion="polite">
      <StatusBar style="dark" />
      <LottieAnimation
        name="signIn"
        size={240}
        speed={WELCOME_SPEED}
        onFinish={enter}
        fallback={
          <View style={styles.welcomeFallback}>
            <Ionicons name="checkmark" size={56} color={colors.onPrimary} />
          </View>
        }
      />
      <Animated.Text entering={FadeInDown.delay(200).duration(400)} style={styles.welcomeTitle}>
        {nombre ? `¡Bienvenido, ${nombre}!` : "¡Ingreso correcto!"}
      </Animated.Text>
      <Animated.Text entering={FadeInDown.delay(320).duration(400)} style={styles.welcomeText}>
        Preparando su espacio…
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  welcome: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  welcomeFallback: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.syncOkText,
    borderRadius: 60,
    height: 120,
    justifyContent: "center",
    marginTop: 60,
    width: 120,
  },
  welcomeTitle: { color: colors.navy, fontFamily: fonts.bold, fontSize: 26, textAlign: "center" },
  welcomeText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 16 },
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
  sectionTitle: {
    color: colors.navy,
    fontFamily: fonts.bold,
    fontSize: 24,
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
  optionsRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    marginTop: -4,
  },
  rememberPress: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
  },
  checkbox: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: 6,
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rememberText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  link: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
    paddingVertical: 10,
  },
  linkPressed: { opacity: 0.6 },
  footer: { gap: 14, marginTop: 4 },
});
