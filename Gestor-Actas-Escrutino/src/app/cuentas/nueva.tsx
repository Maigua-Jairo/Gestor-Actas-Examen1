import { useEffect, useMemo, useRef, useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button, Field, LottieAnimation, Notice, Pill, Skeleton } from "@/components/ui";
import type { PerfilUsuario, Recinto } from "@/data/auth.repository";
import type { MesaRecinto } from "@/domain/recinto.use-cases";
import { cedulaSchema, usuarioNuevoSchema } from "@/domain/schemas/usuario";
import { authUseCases } from "@/presentation/auth";
import { listaConY } from "@/presentation/format";
import { rutaInicioPorRol } from "@/presentation/navigation";
import { recintoUseCases } from "@/presentation/recinto";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type FormInput = z.input<typeof usuarioNuevoSchema>;
type FormOutput = z.output<typeof usuarioNuevoSchema>;

interface RecintoOpcion extends Recinto {
  /** true si ya tiene coordinador: la base de datos solo admite uno (RF-07). */
  ocupado: boolean;
}

interface CuentaCreada {
  nombre: string;
  email: string;
  temporaryPassword: string;
  rol: "recinto" | "veedor";
  mesasAsignadas: string[];
  mesasFallidas: string[];
}

const emptyForm: FormInput = {
  cedula: "",
  nombres: "",
  apellidos: "",
  telefono: "",
  email: "",
  rol: "veedor",
};

export default function NuevaCuentaScreen() {
  const params = useLocalSearchParams<{ mesas?: string; reemplaza?: string }>();
  const preselected = useMemo(
    () => (typeof params.mesas === "string" && params.mesas ? params.mesas.split(",") : []),
    [params.mesas],
  );
  const reemplaza = typeof params.reemplaza === "string" ? params.reemplaza : null;

  const [profile, setProfile] = useState<PerfilUsuario | null>(null);
  const [recintos, setRecintos] = useState<RecintoOpcion[]>([]);
  const [mesas, setMesas] = useState<MesaRecinto[]>([]);
  const [recintoNombre, setRecintoNombre] = useState<string | null>(null);
  const [selectedRecinto, setSelectedRecinto] = useState("");
  const [selectedMesas, setSelectedMesas] = useState<string[]>(preselected);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [created, setCreated] = useState<CuentaCreada | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const inputs = useRef<Record<string, TextInput | null>>({});

  const { control, handleSubmit, reset } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(usuarioNuevoSchema),
    mode: "onTouched",
    defaultValues: emptyForm,
  });
  const cedula = useWatch({ control, name: "cedula" });
  const cedulaValida = cedulaSchema.safeParse(cedula ?? "").success;

  const isProvincial = profile?.rol === "provincial";
  const rolNuevo: "recinto" | "veedor" = isProvincial ? "recinto" : "veedor";

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const user = await authUseCases.obtenerSesion.execute();
        if (!user) {
          router.replace("/(auth)/login");
          return;
        }
        const current = await authUseCases.obtenerPerfil.execute(user.id);
        if (!current || (current.rol !== "provincial" && current.rol !== "recinto")) {
          router.replace(rutaInicioPorRol(current?.rol));
          return;
        }
        if (current.rol === "provincial") {
          const [lista, cuentas] = await Promise.all([
            authUseCases.listarRecintos.execute(),
            authUseCases.listarCuentas.execute(),
          ]);
          const ocupados = new Set(
            cuentas.filter((c) => c.rol === "recinto" && c.recintoId).map((c) => c.recintoId),
          );
          const opciones = lista.map((r) => ({ ...r, ocupado: ocupados.has(r.id) }));
          if (!active) return;
          setRecintos(opciones);
          const libres = opciones.filter((r) => !r.ocupado);
          if (libres.length === 1) setSelectedRecinto(libres[0].id);
        } else if (current.recintoId) {
          const tablero = await recintoUseCases.obtenerTablero.execute(current.recintoId);
          if (!active) return;
          setMesas(tablero.mesas);
          setRecintoNombre(tablero.recintoNombre);
        }
        if (active) setProfile(current);
      } catch (contextError) {
        if (active) {
          setLoadError(
            contextError instanceof Error
              ? contextError.message
              : "No fue posible preparar el formulario.",
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function toggleMesa(id: string): void {
    setSelectedMesas((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function create(values: FormOutput): Promise<void> {
    if (!profile) return;
    if (isProvincial && !selectedRecinto) {
      setError("Seleccione el recinto que coordinará.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await authUseCases.crearCuenta.execute(profile.rol, {
        ...values,
        rol: rolNuevo,
        ...(isProvincial ? { recintoId: selectedRecinto } : {}),
      });

      let asignadas: string[] = [];
      let fallidas: string[] = [];
      if (!isProvincial && selectedMesas.length > 0) {
        const traslado = await recintoUseCases.trasladarMesas.execute(selectedMesas, result.id);
        const numero = (id: string) =>
          String(mesas.find((mesa) => mesa.id === id)?.numeroJrv ?? "?");
        asignadas = traslado.asignadas.map(numero);
        fallidas = traslado.fallidas.map((item) => numero(item.mesaId));
      }

      setCreated({
        nombre: `${values.nombres} ${values.apellidos}`,
        email: result.email,
        temporaryPassword: result.temporaryPassword,
        rol: result.rol,
        mesasAsignadas: asignadas,
        mesasFallidas: fallidas,
      });
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "No fue posible crear la cuenta.",
      );
      setShakeKey((value) => value + 1);
      scrollRef.current?.scrollToEnd({ animated: true });
    } finally {
      setSaving(false);
    }
  }

  // Se arma al pulsar (no durante el render) porque lee la referencia del ScrollView.
  function submit(): Promise<void> {
    return handleSubmit(create, () => {
      setShakeKey((value) => value + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    })();
  }

  if (created) {
    return (
      <AccountCreated
        cuenta={created}
        onCreateAnother={() => {
          reset(emptyForm);
          setSelectedMesas([]);
          setCreated(null);
        }}
      />
    );
  }

  const roleTitle = isProvincial ? "Nuevo coordinador" : "Nuevo veedor";
  const subtitle = reemplaza
    ? `Sustituto de ${reemplaza}: recibirá sus mesas.`
    : isProvincial
      ? "Lo crea usted y entrega la clave por un canal distinto al correo."
      : [recintoNombre, "Coordinador de recinto"].filter(Boolean).join(" · ");

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader
            eyebrow={isProvincial ? "Coordinadores" : "Veedores"}
            title={profile ? roleTitle : "Nueva cuenta"}
            subtitle={profile ? subtitle : undefined}
            onBack={() => router.back()}
          />

          <View style={styles.body}>
            {loadError ? <Notice tone="error">{loadError}</Notice> : null}
            {!profile && !loadError ? (
              <View style={styles.block}>
                <Skeleton height={320} radius={20} />
                <Skeleton height={120} radius={20} />
              </View>
            ) : null}

            {profile ? (
              <>
                <Animated.View entering={FadeInDown.duration(380)} style={styles.card}>
                  <Text style={styles.section}>DATOS PERSONALES</Text>
                  <Controller
                    control={control}
                    name="cedula"
                    render={({ field, fieldState }) => (
                      <Field
                        label="Cédula"
                        value={field.value}
                        onChangeText={field.onChange}
                        onBlur={field.onBlur}
                        error={fieldState.error?.message}
                        success={cedulaValida ? "Cédula válida" : undefined}
                        keyboardType="number-pad"
                        maxLength={10}
                        autoCapitalize="none"
                        returnKeyType="next"
                        onSubmitEditing={() => inputs.current.nombres?.focus()}
                        shakeKey={shakeKey}
                        disabled={saving}
                      />
                    )}
                  />
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <Controller
                        control={control}
                        name="nombres"
                        render={({ field, fieldState }) => (
                          <Field
                            inputRef={(ref) => {
                              inputs.current.nombres = ref;
                            }}
                            label="Nombres"
                            value={field.value}
                            onChangeText={field.onChange}
                            onBlur={field.onBlur}
                            error={fieldState.error?.message}
                            autoCapitalize="words"
                            autoComplete="name-given"
                            returnKeyType="next"
                            onSubmitEditing={() => inputs.current.apellidos?.focus()}
                            shakeKey={shakeKey}
                            disabled={saving}
                          />
                        )}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Controller
                        control={control}
                        name="apellidos"
                        render={({ field, fieldState }) => (
                          <Field
                            inputRef={(ref) => {
                              inputs.current.apellidos = ref;
                            }}
                            label="Apellidos"
                            value={field.value}
                            onChangeText={field.onChange}
                            onBlur={field.onBlur}
                            error={fieldState.error?.message}
                            autoCapitalize="words"
                            autoComplete="name-family"
                            returnKeyType="next"
                            onSubmitEditing={() => inputs.current.telefono?.focus()}
                            shakeKey={shakeKey}
                            disabled={saving}
                          />
                        )}
                      />
                    </View>
                  </View>
                  <Controller
                    control={control}
                    name="telefono"
                    render={({ field, fieldState }) => (
                      <Field
                        inputRef={(ref) => {
                          inputs.current.telefono = ref;
                        }}
                        label="Teléfono"
                        value={field.value}
                        onChangeText={field.onChange}
                        onBlur={field.onBlur}
                        error={fieldState.error?.message}
                        keyboardType="phone-pad"
                        maxLength={10}
                        autoComplete="tel"
                        returnKeyType="next"
                        onSubmitEditing={() => inputs.current.email?.focus()}
                        shakeKey={shakeKey}
                        disabled={saving}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="email"
                    render={({ field, fieldState }) => (
                      <Field
                        inputRef={(ref) => {
                          inputs.current.email = ref;
                        }}
                        label="Correo electrónico"
                        value={field.value}
                        onChangeText={field.onChange}
                        onBlur={field.onBlur}
                        error={fieldState.error?.message}
                        hint="Recibirá un enlace para confirmarlo."
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        returnKeyType="done"
                        shakeKey={shakeKey}
                        disabled={saving}
                      />
                    )}
                  />
                </Animated.View>

                {isProvincial ? (
                  <RecintoPicker
                    recintos={recintos}
                    selected={selectedRecinto}
                    onSelect={setSelectedRecinto}
                  />
                ) : (
                  <MesaPicker mesas={mesas} selected={selectedMesas} onToggle={toggleMesa} />
                )}

                {error ? <Notice tone="error">{error}</Notice> : null}
              </>
            ) : null}
          </View>
        </ScrollView>

        {profile ? (
          <SafeAreaView edges={["bottom"]} style={styles.footer}>
            <View style={styles.footerRow}>
              <View style={styles.cancel}>
                <Button
                  variant="secondary"
                  label="Cancelar"
                  onPress={() => router.back()}
                  disabled={saving}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label={saving ? "Creando…" : isProvincial ? "Crear coordinador" : "Crear veedor"}
                  loading={saving}
                  onPress={() => void submit()}
                />
              </View>
            </View>
          </SafeAreaView>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

function MesaPicker({
  mesas,
  selected,
  onToggle,
}: {
  mesas: MesaRecinto[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const conOtroVeedor = mesas.filter((mesa) => selected.includes(mesa.id) && mesa.veedor);
  return (
    <Animated.View entering={FadeInDown.delay(80).duration(380)} style={styles.card}>
      <View style={styles.sectionRow}>
        <Text style={styles.section}>MESAS A CARGO</Text>
        <Text style={styles.sectionCount}>
          {selected.length === 0
            ? "Opcional"
            : `${selected.length} ${selected.length === 1 ? "seleccionada" : "seleccionadas"}`}
        </Text>
      </View>
      {mesas.length === 0 ? (
        <Text style={styles.hint}>Este recinto aún no tiene mesas cargadas.</Text>
      ) : (
        <View style={styles.chips}>
          {mesas.map((mesa) => {
            const isSelected = selected.includes(mesa.id);
            return (
              <Pressable
                key={mesa.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`Mesa ${mesa.numeroJrv}${mesa.veedor ? ", ya tiene veedor" : ""}`}
                onPress={() => onToggle(mesa.id)}
                style={[styles.chip, isSelected && styles.chipSelected]}
              >
                {isSelected ? (
                  <Animated.View entering={ZoomIn.duration(160)}>
                    <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                  </Animated.View>
                ) : null}
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {mesa.numeroJrv}
                </Text>
                {!isSelected && !mesa.veedor ? <View style={styles.chipDot} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
      <Text style={styles.hint}>
        El punto ámbar marca las mesas sin veedor. Puede asignar más mesas después.
      </Text>
      {conOtroVeedor.length > 0 ? (
        <Notice tone="warning">
          {conOtroVeedor.length === 1 ? "La mesa" : "Las mesas"}{" "}
          {listaConY(conOtroVeedor.map((mesa) => String(mesa.numeroJrv)))}{" "}
          {conOtroVeedor.length === 1 ? "ya tiene veedor y pasará" : "ya tienen veedor y pasarán"} a
          esta cuenta.
        </Notice>
      ) : null}
    </Animated.View>
  );
}

function RecintoPicker({
  recintos,
  selected,
  onSelect,
}: {
  recintos: RecintoOpcion[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(80).duration(380)} style={styles.card}>
      <Text style={styles.section}>RECINTO QUE COORDINARÁ</Text>
      {recintos.length === 0 ? (
        <Notice tone="info">No hay recintos cargados. Regístrelos primero en la pestaña Recintos.</Notice>
      ) : (
        recintos.map((recinto) => {
          const isSelected = selected === recinto.id;
          return (
            <Pressable
              key={recinto.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, disabled: recinto.ocupado }}
              disabled={recinto.ocupado}
              onPress={() => onSelect(recinto.id)}
              style={[
                styles.option,
                isSelected && styles.optionSelected,
                recinto.ocupado && styles.optionDisabled,
              ]}
            >
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected ? <View style={styles.radioDot} /> : null}
              </View>
              <View style={styles.flex}>
                <Text style={styles.optionName}>{recinto.nombre}</Text>
                <Text style={styles.optionMeta}>{recinto.canton}</Text>
              </View>
              {recinto.ocupado ? <Pill label="Con coordinador" tone="neutral" /> : null}
            </Pressable>
          );
        })
      )}
    </Animated.View>
  );
}

function AccountCreated({
  cuenta,
  onCreateAnother,
}: {
  cuenta: CuentaCreada;
  onCreateAnother: () => void;
}) {
  const insets = useSafeAreaInsets();
  const roleLabel = cuenta.rol === "recinto" ? "Coordinador de recinto" : "Veedor";

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[colors.institutional, colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.createdHeader, { paddingTop: insets.top + 28 }]}
        >
          <LottieAnimation
            name="success"
            size={130}
            fallback={
              <Animated.View entering={ZoomIn.springify().damping(11)} style={styles.createdIcon}>
                <Ionicons name="checkmark" size={40} color={colors.onPrimary} />
              </Animated.View>
            }
          />
          <Animated.Text
            entering={FadeInDown.delay(120).duration(380)}
            style={styles.createdTitle}
            accessibilityRole="header"
          >
            Cuenta creada
          </Animated.Text>
          <Text style={styles.createdSubtitle}>
            {cuenta.nombre} · {roleLabel}
          </Text>
        </LinearGradient>

        <View style={styles.body}>
          <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.card}>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>CLAVE TEMPORAL</Text>
              <Pill label="Solo una vez" tone="warning" />
            </View>
            <Text
              selectable
              style={styles.password}
              accessibilityLabel={`Clave temporal: ${cuenta.temporaryPassword.split("").join(" ")}`}
            >
              {cuenta.temporaryPassword}
            </Text>
            <Text style={styles.hint}>Mantenga presionada la clave para copiarla.</Text>
            <Notice tone="warning">
              Entregue esta clave por un medio distinto al correo. Ya no podrá volver a verla.
            </Notice>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(260).duration(400)} style={styles.card}>
            <Text style={styles.section}>SIGUIENTES PASOS</Text>
            <Step done text="Cuenta creada en el sistema" />
            <Step index={2} text={`Correo de confirmación enviado a ${cuenta.email}`} />
            <Step index={3} text="Al entrar por primera vez, cambiará la clave" />
            {cuenta.mesasAsignadas.length > 0 ? (
              <Step
                done
                text={`${cuenta.mesasAsignadas.length === 1 ? "Mesa asignada" : "Mesas asignadas"}: ${listaConY(cuenta.mesasAsignadas)}`}
              />
            ) : null}
          </Animated.View>

          {cuenta.mesasFallidas.length > 0 ? (
            <Notice tone="error">
              No se pudo asignar {cuenta.mesasFallidas.length === 1 ? "la mesa" : "las mesas"}{" "}
              {listaConY(cuenta.mesasFallidas)}. Asígnelas desde la pestaña Mesas.
            </Notice>
          ) : null}
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <View style={styles.footerColumn}>
          <Button label="Crear otra cuenta" onPress={onCreateAnother} />
          <Button variant="ghost" label="Volver" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function Step({ text, done = false, index }: { text: string; done?: boolean; index?: number }) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.step}>
      <View style={[styles.stepBadge, done ? styles.stepDone : styles.stepTodo]}>
        {done ? (
          <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
        ) : (
          <Text style={styles.stepNumber}>{index}</Text>
        )}
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  body: {
    alignSelf: "center",
    gap: 14,
    maxWidth: 620,
    paddingHorizontal: 20,
    paddingTop: 18,
    width: "100%",
  },
  block: { gap: 12 },
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  row: { flexDirection: "row", gap: 10 },
  section: {
    color: colors.textAuxiliary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: 1,
  },
  sectionRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionCount: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 14 },
  hint: { color: colors.textAuxiliary, fontFamily: fonts.regular, fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    minHeight: 46,
    minWidth: 58,
    paddingHorizontal: 10,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  chipTextSelected: { color: colors.onPrimary },
  chipDot: {
    backgroundColor: colors.syncPendingText,
    borderRadius: 4,
    height: 8,
    position: "absolute",
    right: 5,
    top: 5,
    width: 8,
  },
  option: {
    alignItems: "center",
    borderColor: colors.borderSoftBlue,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  optionSelected: { borderColor: colors.primary, borderWidth: 2 },
  optionDisabled: { opacity: 0.55 },
  radio: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: { backgroundColor: colors.primary, borderRadius: 6, height: 12, width: 12 },
  optionName: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 16 },
  optionMeta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  footer: {
    backgroundColor: colors.paper,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  footerRow: { flexDirection: "row", gap: 10, paddingBottom: 8 },
  footerColumn: { gap: 4, paddingBottom: 4 },
  cancel: { width: 120 },
  createdHeader: {
    alignItems: "center",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    gap: 8,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  createdIcon: {
    alignItems: "center",
    backgroundColor: colors.syncOkText,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 40,
    borderWidth: 3,
    height: 80,
    justifyContent: "center",
    marginBottom: 6,
    width: 80,
  },
  createdTitle: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 28 },
  createdSubtitle: {
    color: colors.surfaceMuted,
    fontFamily: fonts.regular,
    fontSize: 15,
    textAlign: "center",
  },
  password: {
    backgroundColor: colors.background,
    borderRadius: 14,
    color: colors.navy,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 22,
    letterSpacing: 2,
    paddingHorizontal: 14,
    paddingVertical: 16,
    textAlign: "center",
  },
  step: { alignItems: "center", flexDirection: "row", gap: 12 },
  stepBadge: {
    alignItems: "center",
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  stepDone: { backgroundColor: colors.syncOkText },
  stepTodo: { backgroundColor: colors.surfaceMuted },
  stepNumber: { color: colors.primary, fontFamily: fonts.bold, fontSize: 13 },
  stepText: { color: colors.text, flex: 1, fontFamily: fonts.regular, fontSize: 15 },
});
