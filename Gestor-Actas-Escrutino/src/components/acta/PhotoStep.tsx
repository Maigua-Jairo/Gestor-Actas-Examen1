import { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { EvidenceChips, type EstadoCalidadFoto } from "@/components/acta/EvidenceChips";
import type { UbicacionCapturada } from "@/components/acta/useBestLocation";
import { Button, Notice } from "@/components/ui";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type PhotoStepProps = {
  /** Foto nueva o, en una corrección, la ya enviada (si se pudo cargar). */
  previewUri: string | null;
  /** true si se conservará la foto ya enviada aunque no se pueda mostrar (sin señal). */
  keepsExistingPhoto: boolean;
  calidad: EstadoCalidadFoto;
  calidadAdvertencia: string | null;
  ubicacion: UbicacionCapturada;
  distanciaRecintoM: number | null;
  takingPhoto: boolean;
  disabled: boolean;
  onTakePhoto: () => void;
  onRetryLocation: () => void;
};

export function PhotoStep({
  previewUri,
  keepsExistingPhoto,
  calidad,
  calidadAdvertencia,
  ubicacion,
  distanciaRecintoM,
  takingPhoto,
  disabled,
  onTakePhoto,
  onRetryLocation,
}: PhotoStepProps) {
  const hasPhoto = Boolean(previewUri) || keepsExistingPhoto;

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(380)}>
        <LinearGradient
          colors={[colors.navy, colors.navyDeep]}
          style={styles.frameCard}
        >
          <Text style={styles.frameTitle}>
            {hasPhoto ? "Revise que se lean todos los números" : "Encuadre el acta completa"}
          </Text>
          <View style={styles.frame}>
            {previewUri ? (
              <Animated.View entering={FadeIn.duration(300)} style={StyleSheet.absoluteFill}>
                <Image
                  source={{ uri: previewUri }}
                  resizeMode="contain"
                  style={styles.preview}
                  accessibilityLabel="Vista previa de la foto del acta"
                />
              </Animated.View>
            ) : keepsExistingPhoto ? (
              <View style={styles.placeholder}>
                <Ionicons name="cloud-done-outline" size={42} color={colors.surfaceMuted} />
                <Text style={styles.placeholderText}>
                  Se conservará la foto que ya se envió. Sin señal no se puede mostrar.
                </Text>
              </View>
            ) : (
              <FrameGuides />
            )}
          </View>
          <EvidenceChips
            calidad={calidad}
            gps={ubicacion.estado}
            precisionM={ubicacion.precisionM}
          />
        </LinearGradient>
      </Animated.View>

      {calidad === "probablemente_borrosa" && calidadAdvertencia ? (
        <Notice tone="warning">{calidadAdvertencia}</Notice>
      ) : !hasPhoto ? (
        <Notice tone="warning">
          Si la foto sale borrosa, vuelva a tomarla antes de continuar.
        </Notice>
      ) : null}

      {ubicacion.estado === "error" ? (
        <View style={styles.gpsError}>
          <Notice tone="error">{ubicacion.error}</Notice>
          <Button
            variant="secondary"
            label="Reintentar ubicación"
            icon={<Ionicons name="locate" size={18} color={colors.primary} />}
            onPress={onRetryLocation}
            disabled={disabled}
          />
        </View>
      ) : null}

      {distanciaRecintoM !== null && distanciaRecintoM > 300 ? (
        <Notice tone="warning">
          Está a unos {Math.round(distanciaRecintoM)} m del recinto. Verifique que el
          acta corresponda a esta mesa. Se registrará igual, con esta advertencia.
        </Notice>
      ) : null}

      <Button
        variant={hasPhoto ? "secondary" : "primary"}
        label={
          takingPhoto ? "Abriendo cámara…" : hasPhoto ? "Tomar otra foto" : "Abrir cámara"
        }
        icon={
          <Ionicons
            name="camera"
            size={20}
            color={hasPhoto ? colors.primary : colors.onPrimary}
          />
        }
        loading={takingPhoto}
        onPress={onTakePhoto}
        disabled={disabled}
      />
    </View>
  );
}

/** Esquinas verdes que "respiran" para indicar dónde encuadrar el acta. */
function FrameGuides() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 1100 }), -1, true));
  }, [pulse]);

  const style = useAnimatedStyle(() => ({ opacity: 0.55 + pulse.get() * 0.45 }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
      </Animated.View>
      <View style={styles.placeholder}>
        <Ionicons name="document-text-outline" size={40} color="rgba(255,255,255,0.5)" />
        <Text style={styles.placeholderText}>
          Coloque el acta sobre una superficie plana, con buena luz.
        </Text>
      </View>
    </View>
  );
}

const CORNER = 34;
const corner = colors.cameraGuide;

const styles = StyleSheet.create({
  container: { gap: 12 },
  frameCard: { borderRadius: 22, gap: 14, padding: 16 },
  frameTitle: {
    color: colors.onPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 16,
    textAlign: "center",
  },
  frame: {
    aspectRatio: 3 / 4,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1.5,
    overflow: "hidden",
    width: "100%",
  },
  preview: { height: "100%", width: "100%" },
  placeholder: {
    alignItems: "center",
    flex: 1,
    gap: 10,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  placeholderText: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlign: "center",
  },
  corner: { borderColor: corner, height: CORNER, position: "absolute", width: CORNER },
  cornerTL: { borderLeftWidth: 4, borderTopLeftRadius: 10, borderTopWidth: 4, left: 18, top: 18 },
  cornerTR: { borderRightWidth: 4, borderTopRightRadius: 10, borderTopWidth: 4, right: 18, top: 18 },
  cornerBL: { borderBottomLeftRadius: 10, borderBottomWidth: 4, borderLeftWidth: 4, bottom: 18, left: 18 },
  cornerBR: { borderBottomRightRadius: 10, borderBottomWidth: 4, borderRightWidth: 4, bottom: 18, right: 18 },
  gpsError: { gap: 10 },
});
