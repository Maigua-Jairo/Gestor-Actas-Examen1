import { StyleSheet, View } from "react-native";

import { Pill } from "@/components/ui";
import type { EvidenciaCalidad } from "@/domain/image-quality.use-cases";
import type { EstadoBusquedaGps } from "@/components/acta/useBestLocation";

export type EstadoCalidadFoto = "sin_foto" | "analizando" | "error" | EvidenciaCalidad["resultado"];

type EvidenceChipsProps = {
  calidad: EstadoCalidadFoto;
  gps: EstadoBusquedaGps;
  precisionM: number | null;
};

/** Etiquetas de nitidez y GPS que acompañan a la foto del acta. */
export function EvidenceChips({ calidad, gps, precisionM }: EvidenceChipsProps) {
  return (
    <View style={styles.row}>
      {calidad === "aceptable" ? (
        <Pill tone="success" icon="checkmark" label="Nítida" />
      ) : calidad === "probablemente_borrosa" ? (
        <Pill tone="warning" icon="alert" label="Podría estar borrosa" />
      ) : calidad === "analizando" ? (
        <Pill tone="neutral" icon="hourglass-outline" label="Revisando nitidez…" />
      ) : calidad === "error" ? (
        <Pill tone="neutral" icon="help" label="Nitidez sin revisar" />
      ) : null}

      {gps === "listo" ? (
        <Pill
          tone="info"
          icon="location"
          label={precisionM !== null ? `GPS ${Math.round(precisionM)} m` : "GPS listo"}
        />
      ) : gps === "buscando" ? (
        <Pill
          tone="neutral"
          icon="locate-outline"
          label={
            precisionM !== null
              ? `Mejorando GPS… ${Math.round(precisionM)} m`
              : "Buscando GPS…"
          }
        />
      ) : gps === "error" ? (
        <Pill tone="danger" icon="location-outline" label="Sin GPS" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
