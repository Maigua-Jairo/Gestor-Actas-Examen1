import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { useNetInfo } from "@react-native-community/netinfo";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as Sentry from "@sentry/react-native";
import Animated, { FadeIn, FadeInRight } from "react-native-reanimated";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PhotoStep } from "@/components/acta/PhotoStep";
import { ReviewStep } from "@/components/acta/ReviewStep";
import { SavedStep } from "@/components/acta/SavedStep";
import { StepIndicator } from "@/components/acta/StepIndicator";
import { useBestLocation, type UbicacionCapturada } from "@/components/acta/useBestLocation";
import { VotesStep } from "@/components/acta/VotesStep";
import type { EstadoCalidadFoto } from "@/components/acta/EvidenceChips";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button, Notice, Skeleton } from "@/components/ui";
import type { PerfilUsuario } from "@/data/auth.repository";
import { distanciaEntreCoordenadasM } from "@/domain/acta.use-cases";
import {
  actaFormSchema,
  dignidadesActa,
  type ActaFormInput,
  type ActaFormValues,
  type CandidatoActa,
  type DignidadActa,
  type MesaActa,
} from "@/domain/schemas/acta";
import { actaUseCases } from "@/presentation/actas";
import { authUseCases } from "@/presentation/auth";
import { imageQualityUseCase } from "@/presentation/image-quality";
import { rutaInicioPorRol } from "@/presentation/navigation";
import { offlineUseCases } from "@/presentation/offline";
import { veedorUseCases } from "@/presentation/veedor";
import { colors } from "@/theme/colors";

const STEPS = ["Votos", "Foto", "Revisar"] as const;
type Step = 0 | 1 | 2 | 3; // 3 = acta guardada

interface FotoNueva {
  uri: string;
  width: number;
  height: number;
  fileSize: number | null;
}

/** Datos que se preparan al abrir la pantalla. */
interface Contexto {
  profile: PerfilUsuario;
  mesa: MesaActa;
  candidatos: CandidatoActa[];
  recintoNombre: string | null;
  actaId: string | null;
  version: number | null;
  existingPhotoPath: string | null;
  pendingPhotoUri: string | null;
  initialLocation: UbicacionCapturada;
  defaults: ActaFormInput;
  /** La otra dignidad de la mesa, si aún no se registró. */
  siguienteDignidad: DignidadActa | null;
}

interface PayloadCola {
  mesaId: string;
  dignidad: DignidadActa;
  actaId: string | null;
  version: number | null;
  totalSufragantes: number;
  votosBlancos: number;
  votosNulos: number;
  votos: { candidatoId: string; cantidad: number }[];
  latitud: number;
  longitud: number;
  fotoPathExistente: string | null;
}

const dignityTitle: Record<DignidadActa, string> = {
  ALCALDIA: "alcaldía",
  PREFECTURA: "prefectura",
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function firstName(profile: PerfilUsuario): string {
  const initial = profile.nombres.trim().charAt(0);
  const surname = profile.apellidos.trim().split(/\s+/)[0] ?? "";
  return initial ? `${initial}. ${surname}` : surname;
}

function collectErrors(errors: FieldErrors<ActaFormInput>): string[] {
  const messages = [
    errors.totalSufragantes?.message,
    errors.votosBlancos?.message,
    errors.votosNulos?.message,
    errors.votos?.message,
    errors.votos?.root?.message,
    ...(Array.isArray(errors.votos)
      ? errors.votos.map((vote) => vote?.cantidad?.message)
      : []),
  ];
  return [...new Set(messages.filter((message): message is string => Boolean(message)))];
}

async function loadContext(
  mesaId: string,
  dignidad: DignidadActa,
): Promise<Contexto | { redirect: true }> {
  const user = await authUseCases.obtenerSesion.execute();
  if (!user) {
    router.replace("/(auth)/login");
    return { redirect: true };
  }
  if (user.debeCambiarClave) {
    router.replace("/(auth)/cambiar-clave");
    return { redirect: true };
  }
  const profile = await authUseCases.obtenerPerfil.execute(user.id);
  if (!profile || (profile.rol !== "veedor" && profile.rol !== "recinto")) {
    router.replace(rutaInicioPorRol(profile?.rol));
    return { redirect: true };
  }

  const [workspace, operations, recintoNombre] = await Promise.all([
    actaUseCases.obtenerEspacio.execute(),
    offlineUseCases.consultarOperaciones.execute(),
    profile.recintoId
      ? veedorUseCases.obtenerNombreRecinto.execute(profile.recintoId)
      : Promise.resolve(null),
  ]);

  const mesa = workspace.mesas.find((item) => item.id === mesaId);
  if (!mesa) {
    throw new Error("Esta mesa no está asignada a su cuenta.");
  }
  const candidatos = workspace.candidatos.filter(
    (candidate) => candidate.dignidad === dignidad,
  );
  if (candidatos.length === 0) {
    throw new Error("No hay candidatos activos para esta dignidad.");
  }

  const acta = mesa.actas.find((item) => item.dignidad === dignidad) ?? null;
  if (!acta && profile.rol !== "veedor") {
    throw new Error("Solo el veedor asignado puede registrar esta acta por primera vez.");
  }

  // Versión guardada en el teléfono y aún no enviada: tiene prioridad.
  const pendingOps = operations
    .filter((op) => op.estado === "pendiente" || op.estado === "fallado")
    .map((op) => {
      try {
        return { op, payload: JSON.parse(op.payload) as PayloadCola };
      } catch {
        return null;
      }
    })
    .filter(
      (item): item is { op: (typeof operations)[number]; payload: PayloadCola } =>
        item !== null &&
        item.payload.mesaId === mesaId &&
        item.payload.dignidad === dignidad,
    )
    .sort((a, b) => b.op.createdAt.localeCompare(a.op.createdAt));
  const pending = pendingOps[0] ?? null;

  const votesFrom = (votos: { candidatoId: string; cantidad: number }[]) => {
    const byId = new Map(votos.map((vote) => [vote.candidatoId, vote.cantidad]));
    return candidatos.map((candidate) => ({
      candidatoId: candidate.id,
      cantidad: String(byId.get(candidate.id) ?? 0),
    }));
  };

  const source = pending?.payload ?? acta;
  const defaults: ActaFormInput = source
    ? {
        totalSufragantes: String(source.totalSufragantes),
        votosBlancos: String(source.votosBlancos),
        votosNulos: String(source.votosNulos),
        votos: votesFrom(source.votos),
      }
    : {
        totalSufragantes: "",
        votosBlancos: "0",
        votosNulos: "0",
        votos: votesFrom([]),
      };

  const coords = pending
    ? { latitud: pending.payload.latitud, longitud: pending.payload.longitud }
    : acta
      ? { latitud: acta.latitud, longitud: acta.longitud }
      : null;

  const otherDignity = dignidadesActa.find((item) => item !== dignidad) ?? null;
  const otherDone =
    otherDignity !== null &&
    (mesa.actas.some((item) => item.dignidad === otherDignity) ||
      operations.some((op) => {
        try {
          const payload = JSON.parse(op.payload) as PayloadCola;
          return payload.mesaId === mesaId && payload.dignidad === otherDignity;
        } catch {
          return false;
        }
      }));

  return {
    profile,
    mesa,
    candidatos,
    recintoNombre,
    actaId: pending?.payload.actaId ?? acta?.id ?? null,
    version: pending?.payload.version ?? acta?.version ?? null,
    existingPhotoPath: pending?.payload.fotoPathExistente ?? acta?.fotoPath ?? null,
    pendingPhotoUri: pending?.op.fotoUri ?? null,
    initialLocation: coords
      ? { estado: "listo", ubicacion: coords, precisionM: null, error: "" }
      : { estado: "inactivo", ubicacion: null, precisionM: null, error: "" },
    defaults,
    siguienteDignidad: profile.rol === "veedor" && !otherDone ? otherDignity : null,
  };
}

export default function RegistroActaScreen() {
  const params = useLocalSearchParams<{ mesaId?: string; dignidad?: string }>();
  const mesaId = typeof params.mesaId === "string" ? params.mesaId : "";
  const dignidad: DignidadActa =
    params.dignidad === "PREFECTURA" ? "PREFECTURA" : "ALCALDIA";

  const [context, setContext] = useState<Contexto | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    loadContext(mesaId, dignidad)
      .then((result) => {
        if (active && !("redirect" in result)) setContext(result);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(errorMessage(error, "No fue posible abrir el acta."));
      });
    return () => {
      active = false;
    };
  }, [mesaId, dignidad]);

  if (!context) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <ScreenHeader
          eyebrow="Registro de acta"
          title={`Acta de ${dignityTitle[dignidad]}`}
          onBack={() => router.back()}
        >
          <StepIndicator steps={STEPS} current={0} />
        </ScreenHeader>
        <View style={styles.body}>
          {loadError ? (
            <>
              <Notice tone="error">{loadError}</Notice>
              <Button variant="secondary" label="Volver" onPress={() => router.back()} />
            </>
          ) : (
            <>
              <Skeleton height={110} radius={18} />
              <Skeleton height={84} radius={18} />
              <Skeleton height={84} radius={18} />
            </>
          )}
        </View>
      </View>
    );
  }

  return <ActaWizard context={context} dignidad={dignidad} />;
}

function ActaWizard({ context, dignidad }: { context: Contexto; dignidad: DignidadActa }) {
  const { profile, mesa, candidatos } = context;
  const { isConnected, isInternetReachable } = useNetInfo();
  const offline = isConnected === false || isInternetReachable === false;
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState<Step>(0);
  const [confirmExit, setConfirmExit] = useState(false);
  const [showVoteErrors, setShowVoteErrors] = useState(false);
  const [stepError, setStepError] = useState("");

  const [foto, setFoto] = useState<FotoNueva | null>(
    context.pendingPhotoUri
      ? { uri: context.pendingPhotoUri, width: 0, height: 0, fileSize: null }
      : null,
  );
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [calidad, setCalidad] = useState<EstadoCalidadFoto>(
    context.pendingPhotoUri || context.existingPhotoPath ? "error" : "sin_foto",
  );
  const [calidadAdvertencia, setCalidadAdvertencia] = useState<string | null>(null);
  const [takingPhoto, setTakingPhoto] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [resultado, setResultado] = useState<"enviada" | "en_cola" | null>(null);

  const location = useBestLocation(context.initialLocation);

  const {
    control,
    trigger,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ActaFormInput, unknown, ActaFormValues>({
    resolver: zodResolver(actaFormSchema),
    defaultValues: context.defaults,
    mode: "onTouched",
    reValidateMode: "onChange",
  });
  const values = useWatch({ control }) as ActaFormInput;

  // Foto ya enviada (corrección con señal): se muestra como vista previa.
  useEffect(() => {
    if (!context.existingPhotoPath || context.pendingPhotoUri || offline) return;
    let active = true;
    actaUseCases.obtenerEvidencia
      .execute(context.existingPhotoPath)
      .then((url) => {
        if (active) setExistingPhotoUrl(url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [context.existingPhotoPath, context.pendingPhotoUri, offline]);

  const previewUri = foto?.uri ?? existingPhotoUrl;
  const keepsExistingPhoto = !foto && Boolean(context.existingPhotoPath);
  const hasPhoto = Boolean(foto) || keepsExistingPhoto;

  const distanciaRecintoM = useMemo(() => {
    if (!location.ubicacion || mesa.recintoLatitud === null || mesa.recintoLongitud === null) {
      return null;
    }
    return distanciaEntreCoordenadasM(location.ubicacion, {
      latitud: mesa.recintoLatitud,
      longitud: mesa.recintoLongitud,
    });
  }, [location.ubicacion, mesa.recintoLatitud, mesa.recintoLongitud]);

  const goToStep = useCallback((next: Step) => {
    setStepError("");
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const finish = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/veedor");
  }, []);

  const handleBack = useCallback((): boolean => {
    if (saving) return true;
    if (step === 3) {
      finish();
    } else if (step > 0) {
      goToStep((step - 1) as Step);
    } else if ((isDirty || foto) && !confirmExit) {
      setConfirmExit(true);
    } else {
      finish();
    }
    return true;
  }, [saving, step, isDirty, foto, confirmExit, finish, goToStep]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => subscription.remove();
  }, [handleBack]);

  async function continueFromVotes(): Promise<void> {
    const valid = await trigger();
    setShowVoteErrors(!valid);
    if (valid) {
      goToStep(1);
    } else {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }

  function continueFromPhoto(): void {
    if (!hasPhoto) {
      setStepError("Tome la foto del acta para continuar.");
      return;
    }
    if (!location.ubicacion) {
      setStepError(
        location.estado === "buscando"
          ? "Espere unos segundos: se está obteniendo la ubicación GPS."
          : "La ubicación GPS es obligatoria. Use \"Reintentar ubicación\".",
      );
      return;
    }
    goToStep(2);
  }

  async function takePhoto(): Promise<void> {
    setTakingPhoto(true);
    setStepError("");
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Active el permiso de cámara para fotografiar el acta.");
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        exif: false,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      setFoto({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize ?? null,
      });
      setCalidad("analizando");
      setCalidadAdvertencia(null);
      // La ubicación se toma en el momento de la foto (RF-12).
      void location.start();

      try {
        const small = await manipulateAsync(asset.uri, [{ resize: { width: 640 } }], {
          compress: 0.8,
          format: SaveFormat.JPEG,
          base64: true,
        });
        if (!small.base64) throw new Error("Sin datos de imagen");
        // Dimensiones de la foto original: el análisis exige al menos 1200 px.
        const analysis = imageQualityUseCase.execute(
          small.base64,
          asset.width,
          asset.height,
          asset.fileSize ?? null,
        );
        setCalidad(analysis.resultado);
        setCalidadAdvertencia(analysis.advertencia);
      } catch {
        setCalidad("error");
      }
    } catch (error) {
      setStepError(errorMessage(error, "No se pudo tomar la foto."));
    } finally {
      setTakingPhoto(false);
    }
  }

  async function confirm(valores: ActaFormValues): Promise<void> {
    if (!location.ubicacion) {
      setSaveError("Falta la ubicación GPS.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      // Siempre se guarda primero en el teléfono: si la señal se corta a mitad
      // del envío, el acta no se pierde y se reintenta sola.
      const operation = await offlineUseCases.encolarActa.execute({
        mesaId: mesa.id,
        dignidad,
        actaId: context.actaId,
        version: context.version,
        totalSufragantes: valores.totalSufragantes,
        votosBlancos: valores.votosBlancos,
        votosNulos: valores.votosNulos,
        votos: valores.votos.map((vote) => ({
          candidatoId: vote.candidatoId,
          cantidad: vote.cantidad,
        })),
        latitud: location.ubicacion.latitud,
        longitud: location.ubicacion.longitud,
        fotoUri: foto?.uri ?? null,
        fotoPathExistente: context.existingPhotoPath,
      });

      if (offline) {
        setResultado("en_cola");
        goToStep(3);
        return;
      }

      await offlineUseCases.sincronizarPendientes.execute().catch(() => 0);
      const after = await offlineUseCases.consultarOperaciones.execute();
      const mine = after.find((op) => op.id === operation.id);

      if (mine?.estado === "fallado") {
        setSaveError(
          `${mine.ultimoError ?? "El servidor rechazó el acta."} El acta quedó guardada en el teléfono: corríjala y vuelva a confirmar.`,
        );
        return;
      }
      setResultado(mine?.estado === "guardado" ? "enviada" : "en_cola");
      goToStep(3);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: "registro_acta", dignidad, offline: String(offline) },
      });
      setSaveError(errorMessage(error, "No fue posible guardar el acta."));
    } finally {
      setSaving(false);
    }
  }

  const voteErrors = showVoteErrors ? collectErrors(errors) : [];
  const subtitle = [
    context.recintoNombre,
    profile.rol === "veedor" ? `Veedor: ${firstName(profile)}` : "Corrección del coordinador",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader
            eyebrow={`Mesa JRV ${mesa.numeroJrv}`}
            title={`Acta de ${dignityTitle[dignidad]}`}
            subtitle={subtitle}
            onBack={step === 3 ? undefined : () => void handleBack()}
          >
            {step < 3 ? <StepIndicator steps={STEPS} current={step} /> : null}
          </ScreenHeader>

          <View style={styles.body}>
            {stepError ? <Notice tone="error">{stepError}</Notice> : null}
            {voteErrors.length > 0 && step === 0 ? (
              <Notice tone="error">{voteErrors.join("\n")}</Notice>
            ) : null}

            <Animated.View key={step} entering={step === 3 ? FadeIn : FadeInRight.duration(280)}>
              {step === 0 ? (
                <VotesStep
                  control={control}
                  errors={showVoteErrors ? errors : {}}
                  candidatos={candidatos}
                  disabled={saving}
                />
              ) : step === 1 ? (
                <PhotoStep
                  previewUri={previewUri}
                  keepsExistingPhoto={keepsExistingPhoto && !existingPhotoUrl}
                  calidad={calidad}
                  calidadAdvertencia={calidadAdvertencia}
                  ubicacion={location}
                  distanciaRecintoM={distanciaRecintoM}
                  takingPhoto={takingPhoto}
                  disabled={saving || takingPhoto}
                  onTakePhoto={() => void takePhoto()}
                  onRetryLocation={() => void location.start()}
                />
              ) : step === 2 ? (
                <ReviewStep
                  dignidad={dignidad}
                  values={values}
                  candidatos={candidatos}
                  previewUri={previewUri}
                  keepsExistingPhoto={keepsExistingPhoto}
                  calidad={calidad}
                  ubicacion={location}
                  distanciaRecintoM={distanciaRecintoM}
                  offline={offline}
                  error={saveError}
                />
              ) : resultado ? (
                <SavedStep
                  resultado={resultado}
                  numeroJrv={mesa.numeroJrv}
                  dignidad={dignidad}
                  siguienteDignidad={context.siguienteDignidad}
                  onContinue={() =>
                    router.replace({
                      pathname: "/registro-acta",
                      params: { mesaId: mesa.id, dignidad: context.siguienteDignidad ?? "" },
                    })
                  }
                  onFinish={finish}
                />
              ) : null}
            </Animated.View>
          </View>
        </ScrollView>

        {step < 3 ? (
          <SafeAreaView edges={["bottom"]} style={styles.footer}>
            {confirmExit ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.footerColumn}>
                <Notice tone="warning">
                  ¿Salir sin guardar? Se perderán los datos escritos en esta acta.
                </Notice>
                <View style={styles.footerRow}>
                  <View style={styles.flex}>
                    <Button
                      variant="secondary"
                      label="Seguir editando"
                      onPress={() => setConfirmExit(false)}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Button variant="danger" label="Salir" onPress={finish} />
                  </View>
                </View>
              </Animated.View>
            ) : step === 2 ? (
              <View style={styles.footerColumn}>
                <Button
                  label={
                    saving
                      ? "Enviando…"
                      : offline
                        ? "Guardar en el teléfono"
                        : "Confirmar y enviar acta"
                  }
                  loading={saving}
                  onPress={() => void handleSubmit(confirm)()}
                />
                <Button
                  variant="ghost"
                  label="Corregir votos"
                  onPress={() => goToStep(0)}
                  disabled={saving}
                />
              </View>
            ) : (
              <View style={styles.footerRow}>
                <View style={styles.backButton}>
                  <Button variant="secondary" label="Atrás" onPress={() => void handleBack()} />
                </View>
                <View style={styles.flex}>
                  <Button
                    label={step === 0 ? "Continuar a la foto" : "Continuar a revisar"}
                    onPress={() =>
                      step === 0 ? void continueFromVotes() : continueFromPhoto()
                    }
                    disabled={takingPhoto}
                  />
                </View>
              </View>
            )}
          </SafeAreaView>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  body: {
    alignSelf: "center",
    gap: 12,
    maxWidth: 620,
    paddingHorizontal: 20,
    paddingTop: 18,
    width: "100%",
  },
  footer: {
    backgroundColor: colors.paper,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  footerRow: { flexDirection: "row", gap: 10, paddingBottom: 8 },
  footerColumn: { gap: 6, paddingBottom: 4 },
  backButton: { width: 110 },
});
