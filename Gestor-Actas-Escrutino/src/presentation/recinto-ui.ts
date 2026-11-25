import type { PillTone } from "@/components/ui/Pill";
import type { EstadoMesaRecinto, MesaRecinto } from "@/domain/recinto.use-cases";
import { dignityLabel } from "@/presentation/veedor-ui";
import { colors } from "@/theme/colors";

interface EstadoVisual {
  label: string;
  tone: PillTone;
  color: string;
  background: string;
  border: string;
}

/** Colores de la leyenda de mesas (páginas 14 y 18 del diseño). */
export const estadoMesaRecinto: Record<EstadoMesaRecinto, EstadoVisual> = {
  guardada: {
    label: "Guardada",
    tone: "success",
    color: colors.syncOkText,
    background: colors.syncOkBg,
    border: colors.syncOkBorder,
  },
  pendiente: {
    label: "Pendiente",
    tone: "warning",
    color: colors.syncPendingText,
    background: colors.syncPendingBg,
    border: colors.syncPendingBorder,
  },
  revisar: {
    label: "Revisar",
    tone: "danger",
    color: colors.syncErrorText,
    background: colors.syncErrorBg,
    border: colors.syncErrorBorder,
  },
  sin_registro: {
    label: "Sin acta",
    tone: "neutral",
    color: colors.textMuted,
    background: colors.paper,
    border: colors.borderStrong,
  },
};

export function nombreCorto(veedor: { nombres: string; apellidos: string }): string {
  const inicial = veedor.nombres.trim().charAt(0);
  const apellido = veedor.apellidos.trim().split(/\s+/)[0] ?? "";
  return inicial ? `${inicial}. ${apellido}` : apellido;
}

/** Frase corta que explica el estado de la mesa. */
export function describeMesaRecinto(mesa: MesaRecinto): string {
  const veedor = mesa.veedor ? `Veedor: ${nombreCorto(mesa.veedor)}` : "Sin veedor asignado";
  switch (mesa.estado) {
    case "revisar": {
      const lejana = mesa.actas.find((acta) => acta.requiereRevision);
      return lejana?.distanciaM
        ? `${veedor} · ${dignityLabel[lejana.dignidad]} a ${Math.round(lejana.distanciaM)} m del recinto`
        : `${veedor} · revisar ubicación`;
    }
    case "pendiente":
      return `${veedor} · falta ${mesa.faltantes.map((d) => dignityLabel[d].toLowerCase()).join(" y ")}`;
    case "sin_registro":
      return `${veedor} · sin actas`;
    default:
      return `${veedor} · mesa completa`;
  }
}
