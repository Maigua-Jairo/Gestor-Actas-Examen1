import { Image, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { EvidenceChips, type EstadoCalidadFoto } from "@/components/acta/EvidenceChips";
import type { UbicacionCapturada } from "@/components/acta/useBestLocation";
import { Notice, Pill } from "@/components/ui";
import type { ActaFormInput, CandidatoActa, DignidadActa } from "@/domain/schemas/acta";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type ReviewStepProps = {
  dignidad: DignidadActa;
  values: ActaFormInput;
  candidatos: CandidatoActa[];
  previewUri: string | null;
  keepsExistingPhoto: boolean;
  calidad: EstadoCalidadFoto;
  ubicacion: UbicacionCapturada;
  distanciaRecintoM: number | null;
  offline: boolean;
  error: string;
};

const toNumber = (value: string | number | undefined) =>
  Number.parseInt(String(value ?? "0"), 10) || 0;

/** Resumen del acta antes de enviarla (página 2 del diseño). */
export function ReviewStep({
  dignidad,
  values,
  candidatos,
  previewUri,
  keepsExistingPhoto,
  calidad,
  ubicacion,
  distanciaRecintoM,
  offline,
  error,
}: ReviewStepProps) {
  return (
    <View style={styles.container}>
      {error ? <Notice tone="error">{error}</Notice> : null}

      <Animated.View entering={FadeInDown.duration(380)} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardEyebrow}>
            {dignidad === "ALCALDIA" ? "ALCALDÍA" : "PREFECTURA"}
          </Text>
          <Pill tone="success" icon="checkmark" label="Suma correcta" />
        </View>

        {candidatos.map((candidate, index) => (
          <View key={candidate.id} style={styles.voteRow}>
            <Text style={styles.voteName} numberOfLines={1}>
              {candidate.organizacionSiglas ? `${candidate.organizacionSiglas} · ` : ""}
              {`${candidate.nombres} ${candidate.apellidos}`.trim()}
            </Text>
            <Text style={styles.voteValue}>
              {toNumber(values.votos?.[index]?.cantidad)}
            </Text>
          </View>
        ))}

        <View style={styles.divider} />
        <View style={styles.voteRow}>
          <Text style={styles.extraText}>
            Blancos {toNumber(values.votosBlancos)} · Nulos {toNumber(values.votosNulos)}
          </Text>
          <Text style={styles.totalText}>Total {toNumber(values.totalSufragantes)}</Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(100).duration(380)}
        style={[styles.card, styles.photoCard]}
      >
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Ionicons
              name={keepsExistingPhoto ? "cloud-done-outline" : "image-outline"}
              size={28}
              color={colors.primary}
            />
          </View>
        )}
        <View style={styles.photoInfo}>
          <Text style={styles.photoTitle}>Foto del acta</Text>
          {keepsExistingPhoto && !previewUri ? (
            <Text style={styles.extraText}>Se conserva la foto ya enviada.</Text>
          ) : null}
          <EvidenceChips
            calidad={calidad}
            gps={ubicacion.estado}
            precisionM={ubicacion.precisionM}
          />
        </View>
      </Animated.View>

      {distanciaRecintoM !== null && distanciaRecintoM > 300 ? (
        <Notice tone="warning">
          La ubicación está a unos {Math.round(distanciaRecintoM)} m del recinto. El
          coordinador verá esta advertencia.
        </Notice>
      ) : null}

      {offline ? (
        <Notice tone="warning">
          Sin conexión: el acta se guardará en el teléfono y se enviará sola al
          recuperar la señal.
        </Notice>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardEyebrow: {
    color: colors.textAuxiliary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    letterSpacing: 1,
  },
  voteRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  voteName: { color: colors.text, flex: 1, fontFamily: fonts.regular, fontSize: 16 },
  voteValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
  divider: { backgroundColor: colors.border, height: 1, marginVertical: 2 },
  extraText: { color: colors.textMuted, flex: 1, fontFamily: fonts.regular, fontSize: 14 },
  totalText: { color: colors.navy, fontFamily: fonts.bold, fontSize: 17 },
  photoCard: { alignItems: "center", flexDirection: "row", gap: 14 },
  thumb: { borderRadius: 14, height: 84, width: 84 },
  thumbEmpty: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
  },
  photoInfo: { flex: 1, gap: 8 },
  photoTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
});
