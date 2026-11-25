import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { ConteoDignidadRecinto } from "@/domain/recinto.use-cases";
import type { DignidadActa } from "@/domain/schemas/acta";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

/** Serie de gráficos de la organización activa; blancos y nulos en gris. */
const PALETTE = colors.chart;
const BLANK_COLOR = colors.borderStrong;

type VotesBreakdownProps = {
  conteo: Record<DignidadActa, ConteoDignidadRecinto>;
};

/** Votos acumulados del recinto por dignidad: barra apilada y leyenda. */
export function VotesBreakdown({ conteo }: VotesBreakdownProps) {
  const [dignidad, setDignidad] = useState<DignidadActa>("ALCALDIA");
  const data = conteo[dignidad];
  const total = data.candidatos.reduce((sum, c) => sum + c.votos, 0) + data.blancosYNulos;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Votos del recinto</Text>
        <DignityToggle value={dignidad} onChange={setDignidad} />
      </View>

      {data.actas === 0 ? (
        <Text style={styles.empty}>
          Aún no hay actas de {dignidad === "ALCALDIA" ? "alcaldía" : "prefectura"} en este recinto.
        </Text>
      ) : (
        <>
          <View style={styles.bar} accessibilityElementsHidden>
            {data.candidatos.map((candidato, index) => (
              <BarSegment
                key={candidato.candidatoId}
                fraction={total > 0 ? candidato.votos / total : 0}
                color={PALETTE[index % PALETTE.length]}
              />
            ))}
            <BarSegment
              fraction={total > 0 ? data.blancosYNulos / total : 0}
              color={BLANK_COLOR}
            />
          </View>

          <View style={styles.legend}>
            {data.candidatos.map((candidato, index) => (
              <View
                key={candidato.candidatoId}
                style={styles.legendItem}
                accessibilityLabel={`${candidato.siglas}, ${candidato.nombre}: ${candidato.votos} votos`}
              >
                <View
                  style={[styles.swatch, { backgroundColor: PALETTE[index % PALETTE.length] }]}
                />
                <Text style={styles.legendName} numberOfLines={1}>
                  {candidato.siglas}
                </Text>
                <Text style={styles.legendValue}>{candidato.votos}</Text>
              </View>
            ))}
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: BLANK_COLOR }]} />
              <Text style={styles.legendName}>Blancos y nulos</Text>
              <Text style={styles.legendValue}>{data.blancosYNulos}</Text>
            </View>
          </View>

          <Text style={styles.footnote}>
            {data.actas} {data.actas === 1 ? "acta" : "actas"} · {data.total} sufragantes
          </Text>
        </>
      )}
    </View>
  );
}

function BarSegment({ fraction, color }: { fraction: number; color: string }) {
  const grow = useSharedValue(0);

  useEffect(() => {
    grow.set(withTiming(fraction, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [fraction, grow]);

  const style = useAnimatedStyle(() => ({ flexGrow: grow.get() }));

  return <Animated.View style={[styles.segment, { backgroundColor: color }, style]} />;
}

/** Selector Alcaldía / Prefectura con indicador deslizante. */
export function DignityToggle({
  value,
  onChange,
}: {
  value: DignidadActa;
  onChange: (value: DignidadActa) => void;
}) {
  const [width, setWidth] = useState(0);
  const offset = useSharedValue(value === "ALCALDIA" ? 0 : 1);

  useEffect(() => {
    offset.set(withTiming(value === "ALCALDIA" ? 0 : 1, { duration: 220 }));
  }, [value, offset]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (offset.get() * width) / 2 }],
    width: width / 2,
  }));

  return (
    <View
      style={styles.toggle}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 6)}
      accessibilityRole="tablist"
    >
      <Animated.View style={[styles.toggleIndicator, indicatorStyle]} />
      {(["ALCALDIA", "PREFECTURA"] as const).map((option) => (
        <Pressable
          key={option}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option }}
          onPress={() => onChange(option)}
          style={styles.toggleOption}
        >
          <Text style={[styles.toggleText, value === option && styles.toggleTextActive]}>
            {option === "ALCALDIA" ? "Alcaldía" : "Prefectura"}
          </Text>
        </Pressable>
      ))}
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
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  title: { color: colors.navy, fontFamily: fonts.bold, fontSize: 17 },
  empty: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15 },
  bar: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    flexDirection: "row",
    gap: 2,
    height: 14,
    overflow: "hidden",
  },
  segment: { flexBasis: 0, height: "100%" },
  legend: { flexDirection: "row", flexWrap: "wrap", rowGap: 10 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 8, width: "50%" },
  swatch: { borderRadius: 3, height: 10, width: 10 },
  legendName: { color: colors.text, flexShrink: 1, fontFamily: fonts.semiBold, fontSize: 14 },
  legendValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
    marginLeft: "auto",
    paddingRight: 14,
  },
  footnote: { color: colors.textAuxiliary, fontFamily: fonts.regular, fontSize: 13 },
  toggle: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    flexDirection: "row",
    padding: 3,
    width: 216,
  },
  toggleIndicator: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    bottom: 3,
    left: 3,
    position: "absolute",
    top: 3,
  },
  toggleOption: { alignItems: "center", flex: 1, justifyContent: "center", minHeight: 34 },
  toggleText: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 13 },
  toggleTextActive: { color: colors.onPrimary },
});
