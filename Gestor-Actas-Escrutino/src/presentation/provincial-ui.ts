import type { PillTone } from "@/components/ui/Pill";
import type { EstadoRecinto } from "@/domain/schemas/seguimiento";
import { colors } from "@/theme/colors";

/** Etiquetas de estado de recinto (página 16 del diseño). */
export const estadoRecintoVisual: Record<
  EstadoRecinto,
  { label: string; tone: PillTone; bar: string }
> = {
  completo: { label: "Completo", tone: "success", bar: colors.syncOkText },
  en_curso: { label: "En curso", tone: "info", bar: colors.primary },
  atencion: { label: "Atención", tone: "danger", bar: colors.syncErrorText },
  sin_iniciar: { label: "Sin iniciar", tone: "warning", bar: colors.syncPendingText },
};

/** Saludo formal del coordinador: "Ing. Pérez" no se puede inferir; se usa "J. Pérez". */
export function saludoProvincial(nombres: string, apellidos: string): string {
  const inicial = nombres.trim().charAt(0);
  const apellido = apellidos.trim().split(/\s+/)[0] ?? "";
  return inicial ? `${inicial}. ${apellido}` : apellido;
}

/** Porcentaje entero, sin división por cero. */
export function porcentaje(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}
