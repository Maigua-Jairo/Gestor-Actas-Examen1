import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { DignityToggle } from "@/components/recinto/VotesBreakdown";
import type { ConteoCandidato, DignidadConteo } from "@/domain/schemas/seguimiento";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type CandidateBarsProps = {
  conteo: ConteoCandidato[];
  blancosYNulos: Record<DignidadConteo, number>;
};

/** Conteo rápido por candidato con barras horizontales (página 3 del diseño). */
export function CandidateBars({ conteo, blancosYNulos }: CandidateBarsProps) {
  const [dignidad, setDignidad] = useState<DignidadConteo>("ALCALDIA");
  const candidatos = conteo
    .filter((candidato) => candidato.dignidad === dignidad)
    .sort((a, b) => b.votos - a.votos);
  const max = Math.max(1, ...candidatos.map((candidato) => candidato.votos));
  const totalValidos = candidatos.reduce((sum, candidato) => sum + candidato.votos, 0);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Votos por candidato</Text>
        <DignityToggle value={dignidad} onChange={setDignidad} />
      </View>

      {totalValidos === 0 ? (
        <Text style={styles.empty}>Aún no hay votos registrados para esta dignidad.</Text>
      ) : (
        <Animated.View key={dignidad} entering={FadeIn.duration(250)} style={styles.list}>
          {candidatos.map((candidato, index) => (
            <View
              key={candidato.candidatoId}
              style={styles.row}
              accessibilityLabel={`${candidato.organizacionSiglas ?? candidato.organizacionNombre}, ${candidato.nombres} ${candidato.apellidos}: ${candidato.votos} votos`}
            >
              <Text style={styles.siglas} numberOfLines={1}>
                {candidato.organizacionSiglas || candidato.organizacionNombre}
              </Text>
              <Bar fraction={candidato.votos / max} delay={index * 60} leader={index === 0} />
              <Text style={styles.value}>{candidato.votos}</Text>
            </View>
          ))}
          <Text style={styles.footnote}>
            {totalValidos} votos válidos · {blancosYNulos[dignidad]} blancos y nulos
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

function Bar({ fraction, delay, leader }: { fraction: number; delay: number; leader: boolean }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.set(
      withDelay(delay, withTiming(fraction, { duration: 700, easing: Easing.out(Easing.cubic) })),
    );
  }, [fraction, delay, width]);

  const style = useAnimatedStyle(() => ({ width: `${Math.max(2, width.get() * 100)}%` }));

  return (
    <View style={styles.track}>
      <Animated.View
        style={[styles.fill, { backgroundColor: leader ? colors.institutional : colors.primary }, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  title: { color: colors.navy, fontFamily: fonts.bold, fontSize: 17 },
  empty: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15 },
  list: { gap: 12 },
  row: { alignItems: "center", flexDirection: "row", gap: 10 },
  siglas: { color: colors.text, fontFamily: fonts.bold, fontSize: 14, width: 64 },
  track: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    flex: 1,
    height: 10,
    overflow: "hidden",
  },
  fill: { borderRadius: 999, height: "100%" },
  value: { color: colors.text, fontFamily: fonts.bold, fontSize: 15, minWidth: 40, textAlign: "right" },
  footnote: { color: colors.textAuxiliary, fontFamily: fonts.regular, fontSize: 13 },
});
