import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import type { EstadoMesaRecinto, MesaRecinto } from "@/domain/recinto.use-cases";
import { estadoMesaRecinto } from "@/presentation/recinto-ui";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

const COLUMNS = 5;
const GAP = 8;

type MesaGridProps = {
  mesas: MesaRecinto[];
  /** Muestra el estado bajo el número (pantalla Mesas). */
  showLabels?: boolean;
  onPressMesa?: (mesa: MesaRecinto) => void;
};

/** Cuadrícula de mesas coloreadas por estado, con su leyenda. */
export function MesaGrid({ mesas, showLabels = false, onPressMesa }: MesaGridProps) {
  const [width, setWidth] = useState(0);
  const tileSize = width > 0 ? (width - GAP * (COLUMNS - 1)) / COLUMNS : 0;

  return (
    <View style={styles.container}>
      <Legend />
      <View
        style={styles.grid}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {tileSize > 0
          ? mesas.map((mesa, index) => {
              const visual = estadoMesaRecinto[mesa.estado];
              return (
                <Animated.View
                  key={mesa.id}
                  entering={ZoomIn.delay(index * 25).springify().damping(14)}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Mesa ${mesa.numeroJrv}: ${visual.label}${
                      mesa.veedor ? "" : ", sin veedor"
                    }`}
                    onPress={onPressMesa ? () => onPressMesa(mesa) : undefined}
                    disabled={!onPressMesa}
                    style={({ pressed }) => [
                      styles.tile,
                      {
                        backgroundColor: visual.background,
                        borderColor: visual.border,
                        height: showLabels ? tileSize * 1.05 : tileSize * 0.82,
                        width: tileSize,
                      },
                      pressed && styles.tilePressed,
                    ]}
                  >
                    <Text style={[styles.tileNumber, { color: visual.color }]}>
                      {mesa.numeroJrv}
                    </Text>
                    {showLabels ? (
                      <Text
                        style={[styles.tileLabel, { color: visual.color }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {visual.label}
                      </Text>
                    ) : null}
                    {!mesa.veedor ? <View style={styles.noWatcherDot} /> : null}
                  </Pressable>
                </Animated.View>
              );
            })
          : null}
      </View>
    </View>
  );
}

function Legend() {
  const items: EstadoMesaRecinto[] = ["guardada", "pendiente", "revisar", "sin_registro"];
  return (
    <View style={styles.legend}>
      {items.map((estado) => (
        <View key={estado} style={styles.legendItem}>
          <View
            style={[
              styles.legendSwatch,
              {
                backgroundColor: estadoMesaRecinto[estado].background,
                borderColor: estadoMesaRecinto[estado].color,
              },
            ]}
          />
          <Text style={styles.legendText}>{estadoMesaRecinto[estado].label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  tile: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  tilePressed: { opacity: 0.7 },
  tileNumber: { fontFamily: fonts.bold, fontSize: 20 },
  tileLabel: { fontFamily: fonts.semiBold, fontSize: 10, marginTop: 2 },
  noWatcherDot: {
    backgroundColor: colors.syncPendingText,
    borderColor: colors.paper,
    borderRadius: 5,
    borderWidth: 1.5,
    height: 10,
    position: "absolute",
    right: 5,
    top: 5,
    width: 10,
  },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 5 },
  legendSwatch: { borderRadius: 3, borderWidth: 1.5, height: 11, width: 11 },
  legendText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
});
