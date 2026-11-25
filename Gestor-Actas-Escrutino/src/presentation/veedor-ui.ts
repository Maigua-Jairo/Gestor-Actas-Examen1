import { router } from "expo-router";

import type { PillTone } from "@/components/ui/Pill";
import type { PerfilUsuario } from "@/data/auth.repository";
import type { DignidadActa } from "@/domain/schemas/acta";
import type {
  EstadoActaVeedora,
  EstadoMesaVeedora,
  MesaAsignadaVeedora,
  ResumenVeedora,
} from "@/domain/veedor.use-cases";
import { colors } from "@/theme/colors";

export const dignityLabel: Record<DignidadActa, string> = {
  ALCALDIA: "Alcaldía",
  PREFECTURA: "Prefectura",
};

interface EstadoVisual {
  label: string;
  tone: PillTone;
  bar: string;
}

export const mesaStatus: Record<EstadoMesaVeedora, EstadoVisual> = {
  completa: { label: "Guardado", tone: "success", bar: colors.syncOkText },
  parcial: { label: "En curso", tone: "info", bar: colors.primary },
  pendiente: { label: "Pendiente", tone: "warning", bar: colors.syncPendingText },
  fallada: { label: "Falló", tone: "danger", bar: colors.syncErrorText },
  sin_registro: { label: "Por registrar", tone: "neutral", bar: colors.borderStrong },
};

export const actaStatus: Record<EstadoActaVeedora, EstadoVisual> = {
  guardada: { label: "Enviada", tone: "success", bar: colors.syncOkText },
  pendiente: { label: "Pendiente", tone: "warning", bar: colors.syncPendingText },
  fallada: { label: "Error", tone: "danger", bar: colors.syncErrorText },
  sin_registro: { label: "Por registrar", tone: "neutral", bar: colors.borderStrong },
};

export function describeMesa(mesa: MesaAsignadaVeedora): string {
  switch (mesa.estado) {
    case "completa":
      return "Mesa completa";
    case "pendiente":
      return "Guardada en el teléfono · pendiente de envío";
    case "fallada":
      return (
        mesa.actas.find((acta) => acta.estado === "fallada")?.detalle ??
        "No se pudo enviar. Revise el acta."
      );
    case "parcial": {
      const faltante = mesa.actas.find((acta) => acta.estado === "sin_registro");
      return faltante ? `Falta ${dignityLabel[faltante.dignidad]}` : "En curso";
    }
    default:
      return "Sin registrar";
  }
}

export function greetingName(profile: PerfilUsuario | null): string {
  if (!profile) return "";
  const initial = profile.nombres.trim().charAt(0);
  const surname = profile.apellidos.trim().split(/\s+/)[0] ?? "";
  return initial ? `${initial}. ${surname}` : surname;
}

export function veedorEyebrow(summary: ResumenVeedora | null): string {
  return summary?.recintoNombre
    ? `VEEDOR · ${summary.recintoNombre.toUpperCase()}`
    : "VEEDOR";
}

export function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  return sameDay
    ? `actualizadas hoy a las ${time}`
    : `actualizadas el ${pad(date.getDate())}/${pad(date.getMonth() + 1)} a las ${time}`;
}

/** Convierte el error técnico de un envío en una explicación para el veedor. */
export function describeErrorEnvio(message: string | null): string {
  if (!message) return "No se pudo enviar.";
  if (/network|failed to fetch|timed? ?out|aborted|conexi[oó]n/i.test(message)) {
    return "Se cortó la conexión al enviar.";
  }
  if (/fotograf[ií]a local ya no existe/i.test(message)) {
    return "La foto ya no está en el teléfono: vuelva a tomarla.";
  }
  if (/jwt|session|sesi[oó]n|401|403/i.test(message)) {
    return "La sesión expiró: vuelva a iniciar sesión para enviarla.";
  }
  if (/candidatos cambi/i.test(message)) {
    return "La lista de candidatos cambió: corrija el acta.";
  }
  if (/suma|sufragantes|votos inv[aá]lidos/i.test(message)) {
    return "Los números no cuadran: corrija el acta.";
  }
  if (/autorizaci[oó]n|no tiene/i.test(message)) {
    return "Esta mesa ya no está asignada a su cuenta.";
  }
  // Errores técnicos de la base de datos (en inglés): nunca se muestran tal cual.
  if (/invalid input|syntax|violates|constraint|null value|does not exist|permission denied|unexpected|ambiguous|column reference|function .*\(/i.test(message)) {
    return "Error interno al enviar. Reintente; si se repite, avise a su coordinador.";
  }
  return message;
}

/** true si el error se arregla corrigiendo el acta (reintentar no basta). */
export function requiereCorreccion(message: string | null): boolean {
  return Boolean(
    message &&
      /fotograf[ií]a local|candidatos cambi|suma|sufragantes|votos inv[aá]lidos/i.test(
        message,
      ),
  );
}

export { haceCuanto } from "@/presentation/format";

/** Abre el asistente de registro/corrección de un acta. */
export function openActa(mesaId: string, dignidad: DignidadActa): void {
  router.push({ pathname: "/registro-acta", params: { mesaId, dignidad } });
}

/** Al tocar una mesa se abre el acta que más urge: fallida, sin registrar o pendiente. */
export function dignidadPrioritaria(mesa: MesaAsignadaVeedora): DignidadActa {
  const orden = ["fallada", "sin_registro", "pendiente"] as const;
  for (const estado of orden) {
    const acta = mesa.actas.find((item) => item.estado === estado);
    if (acta) return acta.dignidad;
  }
  return "ALCALDIA";
}
