export type DignidadConteo = "ALCALDIA" | "PREFECTURA";

export interface AvanceRecinto {
  id: string;
  nombre: string;
  canton: string;
  parroquia: string;
  totalMesas: number;
  completas: number;
  parciales: number;
  pendientes: number;
  /** Actas tomadas a más de 300 m del recinto (S-06). */
  incidencias: number;
}

export interface UbicacionActa {
  actaId: string;
  mesaId: string;
  numeroJrv: number;
  recintoId: string;
  recintoNombre: string;
  dignidad: DignidadConteo;
  latitud: number;
  longitud: number;
  actualizadaEn: string;
  /** Distancia al recinto en metros; null si el recinto no tiene coordenadas. */
  distanciaM: number | null;
  requiereRevision: boolean;
}

export interface ConteoCandidato {
  candidatoId: string;
  nombres: string;
  apellidos: string;
  organizacionNombre: string;
  organizacionSiglas: string | null;
  dignidad: DignidadConteo;
  votos: number;
}

export interface ResumenNacionalProvincial {
  totalRecintos: number;
  totalMesas: number;
  mesasCompletas: number;
  mesasParciales: number;
  mesasPendientes: number;
  actasGuardadas: number;
  actasConIncidencia: number;
  actasPorDignidad: Record<DignidadConteo, number>;
  blancosYNulosPorDignidad: Record<DignidadConteo, number>;
}

export interface TableroProvincial {
  provincia: string;
  resumen: ResumenNacionalProvincial;
  recintos: AvanceRecinto[];
  conteoCandidatos: ConteoCandidato[];
  ubicacionesActas: UbicacionActa[];
  /** Fecha de la copia local si se trabaja sin conexión; null si viene del servidor. */
  guardadoEn?: string | null;
}

/** Estado de un recinto para el coordinador provincial (etiquetas de la página 16). */
export type EstadoRecinto = "completo" | "en_curso" | "atencion" | "sin_iniciar";

export function estadoDeRecinto(recinto: AvanceRecinto): EstadoRecinto {
  if (recinto.incidencias > 0) return "atencion";
  if (recinto.totalMesas > 0 && recinto.completas === recinto.totalMesas) return "completo";
  if (recinto.completas + recinto.parciales === 0) return "sin_iniciar";
  return "en_curso";
}

export interface AvanceCanton {
  canton: string;
  totalMesas: number;
  mesasReportadas: number;
}

/** Mesas reportadas agrupadas por cantón, de más a menos mesas. */
export function avancePorCanton(recintos: AvanceRecinto[]): AvanceCanton[] {
  const porCanton = new Map<string, AvanceCanton>();
  for (const recinto of recintos) {
    const actual = porCanton.get(recinto.canton) ?? {
      canton: recinto.canton,
      totalMesas: 0,
      mesasReportadas: 0,
    };
    actual.totalMesas += recinto.totalMesas;
    actual.mesasReportadas += recinto.completas;
    porCanton.set(recinto.canton, actual);
  }
  return [...porCanton.values()].sort((a, b) => b.totalMesas - a.totalMesas);
}
