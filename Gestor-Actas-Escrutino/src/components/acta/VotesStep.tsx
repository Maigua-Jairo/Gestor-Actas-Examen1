import { useRef } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { Controller, useWatch, type Control, type FieldErrors } from "react-hook-form";

import { CountInput } from "@/components/acta/CountInput";
import { Notice, Pill } from "@/components/ui";
import { calcularBalanceActa } from "@/domain/acta.use-cases";
import type { ActaFormInput, CandidatoActa } from "@/domain/schemas/acta";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type VotesStepProps = {
  control: Control<ActaFormInput>;
  errors: FieldErrors<ActaFormInput>;
  candidatos: CandidatoActa[];
  disabled: boolean;
};

function badgeText(candidate: CandidatoActa): string {
  if (candidate.organizacionSiglas) {
    return candidate.organizacionSiglas.slice(0, 4).toUpperCase();
  }
  return candidate.organizacionNombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export function VotesStep({ control, errors, candidatos, disabled }: VotesStepProps) {
  const values = useWatch({ control }) as ActaFormInput;
  const balance = calcularBalanceActa({
    totalSufragantes: values.totalSufragantes ?? "",
    votosBlancos: values.votosBlancos ?? "",
    votosNulos: values.votosNulos ?? "",
    votos: values.votos ?? [],
  });

  // Orden de avance con la tecla "Siguiente": total → candidatos → blancos → nulos.
  const inputs = useRef<(TextInput | null)[]>([]);
  const focusNext = (index: number) => inputs.current[index + 1]?.focus();
  const blankIndex = candidatos.length + 1;
  const nullIndex = candidatos.length + 2;

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(380)} style={styles.card}>
        <Text style={styles.label}>Total de sufragantes</Text>
        <Text style={styles.hint}>Copie el número tal como está en el acta.</Text>
        <Controller
          control={control}
          name="totalSufragantes"
          render={({ field }) => (
            <CountInput
              size="lg"
              accessibilityLabel="Total de sufragantes"
              value={String(field.value ?? "")}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              invalid={Boolean(errors.totalSufragantes)}
              editable={!disabled}
              inputRef={(ref) => {
                inputs.current[0] = ref;
              }}
              onSubmitEditing={() => focusNext(0)}
            />
          )}
        />
      </Animated.View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Votos por organización</Text>
        <Pill
          tone="info"
          label={`Total: ${balance.totalSufragantes ?? "—"}`}
        />
      </View>

      {candidatos.map((candidate, index) => (
        <Animated.View
          key={candidate.id}
          entering={FadeInDown.delay(60 + index * 40).duration(360)}
          style={[styles.card, styles.candidateCard]}
        >
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1} adjustsFontSizeToFit>
              {badgeText(candidate)}
            </Text>
          </View>
          <View style={styles.candidateInfo}>
            <Text style={styles.candidateName} numberOfLines={2}>
              {`${candidate.nombres} ${candidate.apellidos}`.trim()}
            </Text>
            <Text style={styles.candidateOrg} numberOfLines={2}>
              {candidate.organizacionNombre}
            </Text>
          </View>
          <View style={styles.voteColumn}>
            <Text style={styles.voteLabel}>VOTOS</Text>
            <Controller
              control={control}
              name={`votos.${index}.cantidad`}
              render={({ field }) => (
                <CountInput
                  accessibilityLabel={`Votos de ${candidate.nombres} ${candidate.apellidos}`}
                  value={String(field.value ?? "")}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  invalid={Boolean(errors.votos?.[index]?.cantidad)}
                  editable={!disabled}
                  inputRef={(ref) => {
                    inputs.current[index + 1] = ref;
                  }}
                  onSubmitEditing={() => focusNext(index + 1)}
                />
              )}
            />
          </View>
        </Animated.View>
      ))}

      <Animated.View layout={LinearTransition.duration(220)}>
        <BalanceNotice
          total={balance.totalSufragantes}
          diferencia={balance.diferencia}
        />
      </Animated.View>

      <View style={[styles.card, styles.extraRow]}>
        <View style={styles.extraField}>
          <Text style={styles.label}>Votos en blanco</Text>
          <Controller
            control={control}
            name="votosBlancos"
            render={({ field }) => (
              <CountInput
                size="lg"
                accessibilityLabel="Votos en blanco"
                value={String(field.value ?? "")}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(errors.votosBlancos)}
                editable={!disabled}
                inputRef={(ref) => {
                  inputs.current[blankIndex] = ref;
                }}
                onSubmitEditing={() => focusNext(blankIndex)}
              />
            )}
          />
        </View>
        <View style={styles.extraField}>
          <Text style={styles.label}>Votos nulos</Text>
          <Controller
            control={control}
            name="votosNulos"
            render={({ field }) => (
              <CountInput
                size="lg"
                accessibilityLabel="Votos nulos"
                value={String(field.value ?? "")}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(errors.votosNulos)}
                editable={!disabled}
                returnKeyType="done"
                inputRef={(ref) => {
                  inputs.current[nullIndex] = ref;
                }}
              />
            )}
          />
        </View>
      </View>
    </View>
  );
}

function BalanceNotice({
  total,
  diferencia,
}: {
  total: number | null;
  diferencia: number | null;
}) {
  if (total === null || diferencia === null) {
    return (
      <Notice tone="info">
        Ingrese primero el total de sufragantes para comprobar la suma.
      </Notice>
    );
  }
  if (diferencia > 0) {
    return (
      <Notice tone="warning">
        Faltan {diferencia} {diferencia === 1 ? "voto" : "votos"} por asignar para
        llegar al total de sufragantes.
      </Notice>
    );
  }
  if (diferencia < 0) {
    return (
      <Notice tone="error">
        Hay {Math.abs(diferencia)} {diferencia === -1 ? "voto" : "votos"} de más: la
        suma supera el total de sufragantes.
      </Notice>
    );
  }
  return (
    <Notice tone="success">
      La suma coincide con el total de sufragantes.
    </Notice>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  label: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 15 },
  hint: { color: colors.textAuxiliary, fontFamily: fonts.regular, fontSize: 14 },
  sectionRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  sectionTitle: { color: colors.navy, fontFamily: fonts.bold, fontSize: 18 },
  candidateCard: { alignItems: "center", flexDirection: "row", gap: 12 },
  badge: {
    alignItems: "center",
    backgroundColor: colors.institutional,
    borderRadius: 12,
    height: 46,
    justifyContent: "center",
    paddingHorizontal: 4,
    width: 46,
  },
  badgeText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 14 },
  candidateInfo: { flex: 1, gap: 2 },
  candidateName: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  candidateOrg: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  voteColumn: { alignItems: "center", gap: 4 },
  voteLabel: {
    color: colors.textAuxiliary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    letterSpacing: 1,
  },
  extraRow: { flexDirection: "row", gap: 12 },
  extraField: { flex: 1, gap: 8 },
});
