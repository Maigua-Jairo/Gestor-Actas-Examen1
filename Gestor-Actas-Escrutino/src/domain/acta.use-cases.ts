import type { EspacioActas, UbicacionActa } from "@/domain/schemas/acta";

/**
 * Lectura de mesas, candidatos y actas. El guardado no pasa por aquí: toda
 * acta entra primero a la cola del teléfono (offline.use-cases), que la envía.
 */
export interface ActaRepository {
  loadWorkspace(): Promise<EspacioActas>;
  getEvidenceUrl(path: string): Promise<string>;
}

export function distanciaEntreCoordenadasM(
  first: UbicacionActa,
  second: UbicacionActa,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDifference = radians(second.latitud - first.latitud);
  const longitudeDifference = radians(second.longitud - first.longitud);
  const firstLatitude = radians(first.latitud);
  const secondLatitude = radians(second.latitud);
  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface BalanceActa {
  /** null mientras no se haya ingresado el total de sufragantes. */
  totalSufragantes: number | null;
  /** Votos por candidato + blancos + nulos. */
  asignados: number;
  /** Total − asignados. Positivo: faltan votos; negativo: sobran. */
  diferencia: number | null;
}

function aEntero(value: string | number | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Cuadre en vivo del acta mientras se escribe (antes de validar con Zod). */
export function calcularBalanceActa(valores: {
  totalSufragantes: string | number;
  votosBlancos: string | number;
  votosNulos: string | number;
  votos: { cantidad: string | number }[];
}): BalanceActa {
  const totalTexto = String(valores.totalSufragantes ?? "").trim();
  const totalSufragantes = totalTexto === "" ? null : aEntero(totalTexto);
  const asignados =
    valores.votos.reduce((suma, voto) => suma + aEntero(voto.cantidad), 0) +
    aEntero(valores.votosBlancos) +
    aEntero(valores.votosNulos);
  return {
    totalSufragantes,
    asignados,
    diferencia: totalSufragantes === null ? null : totalSufragantes - asignados,
  };
}

export class ObtenerEspacioActasUseCase {
  constructor(private readonly repository: ActaRepository) {}

  execute(): Promise<EspacioActas> {
    return this.repository.loadWorkspace();
  }
}

export class ObtenerEvidenciaActaUseCase {
  constructor(private readonly repository: ActaRepository) {}

  execute(path: string): Promise<string> {
    if (!path.trim()) {
      throw new Error("No se encontró la ruta de la fotografía.");
    }

    return this.repository.getEvidenceUrl(path);
  }
}
