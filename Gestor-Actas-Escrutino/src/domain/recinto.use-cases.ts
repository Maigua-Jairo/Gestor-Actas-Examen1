import { distanciaEntreCoordenadasM } from "@/domain/acta.use-cases";
import {
  dignidadesActa,
  type DignidadActa,
  type EspacioActas,
} from "@/domain/schemas/acta";

/** Más allá de esta distancia al recinto, el acta se marca para revisión (S-06). */
export const DISTANCIA_REVISION_M = 300;

/** Estado de la mesa para el coordinador (leyenda de la página 14). */
export type EstadoMesaRecinto = "guardada" | "pendiente" | "revisar" | "sin_registro";

export interface VeedorRecinto {
  id: string;
  nombres: string;
  apellidos: string;
}

export interface ActaRecinto {
  id: string;
  dignidad: DignidadActa;
  version: number;
  actualizadaEn: string;
  /** Distancia al recinto en metros; null si el recinto no tiene coordenadas. */
  distanciaM: number | null;
  requiereRevision: boolean;
}

export interface MesaRecinto {
  id: string;
  numeroJrv: number;
  genero: string | null;
  estado: EstadoMesaRecinto;
  veedor: VeedorRecinto | null;
  actas: ActaRecinto[];
  /** Dignidades que aún no tienen acta. */
  faltantes: DignidadActa[];
}

export interface ConteoCandidatoRecinto {
  candidatoId: string;
  nombre: string;
  siglas: string;
  votos: number;
}

export interface ConteoDignidadRecinto {
  candidatos: ConteoCandidatoRecinto[];
  blancosYNulos: number;
  total: number;
  actas: number;
}

export interface ActaPorRevisar {
  mesaId: string;
  numeroJrv: number;
  dignidad: DignidadActa;
  distanciaM: number;
}

export interface TableroRecinto {
  recintoNombre: string | null;
  mesas: MesaRecinto[];
  veedores: VeedorRecinto[];
  totalMesas: number;
  /** Mesas con sus dos actas registradas (S-02). */
  mesasReportadas: number;
  actasRecibidas: number;
  porRevisar: ActaPorRevisar[];
  mesasSinVeedor: MesaRecinto[];
  conteo: Record<DignidadActa, ConteoDignidadRecinto>;
  /** Fecha de la copia local si se trabaja sin conexión. */
  guardadoEn: string | null;
  /** false si no se pudieron leer las asignaciones (sin conexión y sin copia). */
  asignacionesDisponibles: boolean;
}

/** Asignaciones vigentes del recinto, tal como las entrega el repositorio. */
export interface AsignacionesRecinto {
  mesas: { id: string; veedorId: string | null }[];
  veedores: VeedorRecinto[];
}

export interface TableroRecintoRepository {
  loadWorkspace(): Promise<EspacioActas>;
  /** null si no hay conexión ni copia local de las asignaciones. */
  loadAssignments(recintoId: string): Promise<AsignacionesRecinto | null>;
  getRecintoNombre(recintoId: string): Promise<string | null>;
  assignWatcher(mesaId: string, veedorId: string): Promise<void>;
}

const prioridadEstado: Record<EstadoMesaRecinto, number> = {
  revisar: 0,
  pendiente: 1,
  sin_registro: 2,
  guardada: 3,
};

export function construirTableroRecinto(
  espacio: EspacioActas,
  asignaciones: AsignacionesRecinto | null,
  recintoNombre: string | null,
): TableroRecinto {
  const veedores = asignaciones?.veedores ?? [];
  const veedorPorId = new Map(veedores.map((veedor) => [veedor.id, veedor]));
  const veedorPorMesa = new Map(
    (asignaciones?.mesas ?? []).map((mesa) => [mesa.id, mesa.veedorId]),
  );

  const mesas: MesaRecinto[] = [...espacio.mesas]
    .sort((a, b) => a.numeroJrv - b.numeroJrv)
    .map((mesa) => {
      const recinto =
        mesa.recintoLatitud !== null && mesa.recintoLongitud !== null
          ? { latitud: mesa.recintoLatitud, longitud: mesa.recintoLongitud }
          : null;

      const actas: ActaRecinto[] = mesa.actas.map((acta) => {
        const distanciaM = recinto
          ? distanciaEntreCoordenadasM(
              { latitud: acta.latitud, longitud: acta.longitud },
              recinto,
            )
          : null;
        return {
          id: acta.id,
          dignidad: acta.dignidad,
          version: acta.version,
          actualizadaEn: acta.actualizadaEn,
          distanciaM,
          requiereRevision: distanciaM !== null && distanciaM > DISTANCIA_REVISION_M,
        };
      });

      const faltantes = dignidadesActa.filter(
        (dignidad) => !actas.some((acta) => acta.dignidad === dignidad),
      );
      const estado: EstadoMesaRecinto = actas.some((acta) => acta.requiereRevision)
        ? "revisar"
        : actas.length === 0
          ? "sin_registro"
          : faltantes.length > 0
            ? "pendiente"
            : "guardada";

      const veedorId = veedorPorMesa.get(mesa.id) ?? null;
      return {
        id: mesa.id,
        numeroJrv: mesa.numeroJrv,
        genero: mesa.genero || null,
        estado,
        veedor: veedorId ? veedorPorId.get(veedorId) ?? null : null,
        actas,
        faltantes,
      };
    });

  const conteo = Object.fromEntries(
    dignidadesActa.map((dignidad) => {
      const candidatos = espacio.candidatos.filter((c) => c.dignidad === dignidad);
      const votosPorCandidato = new Map<string, number>();
      let blancosYNulos = 0;
      let total = 0;
      let actas = 0;
      for (const mesa of espacio.mesas) {
        const acta = mesa.actas.find((item) => item.dignidad === dignidad);
        if (!acta) continue;
        actas += 1;
        blancosYNulos += acta.votosBlancos + acta.votosNulos;
        total += acta.totalSufragantes;
        for (const voto of acta.votos) {
          votosPorCandidato.set(
            voto.candidatoId,
            (votosPorCandidato.get(voto.candidatoId) ?? 0) + voto.cantidad,
          );
        }
      }
      return [
        dignidad,
        {
          candidatos: candidatos
            .map((candidato) => ({
              candidatoId: candidato.id,
              nombre: `${candidato.nombres} ${candidato.apellidos}`.trim(),
              siglas: candidato.organizacionSiglas || candidato.organizacionNombre,
              votos: votosPorCandidato.get(candidato.id) ?? 0,
            }))
            .sort((a, b) => b.votos - a.votos),
          blancosYNulos,
          total,
          actas,
        },
      ];
    }),
  ) as Record<DignidadActa, ConteoDignidadRecinto>;

  const porRevisar: ActaPorRevisar[] = mesas.flatMap((mesa) =>
    mesa.actas
      .filter((acta) => acta.requiereRevision && acta.distanciaM !== null)
      .map((acta) => ({
        mesaId: mesa.id,
        numeroJrv: mesa.numeroJrv,
        dignidad: acta.dignidad,
        distanciaM: acta.distanciaM ?? 0,
      })),
  );

  return {
    recintoNombre,
    mesas,
    veedores,
    totalMesas: mesas.length,
    mesasReportadas: mesas.filter((mesa) => mesa.faltantes.length === 0).length,
    actasRecibidas: mesas.reduce((suma, mesa) => suma + mesa.actas.length, 0),
    porRevisar,
    mesasSinVeedor: asignaciones ? mesas.filter((mesa) => !mesa.veedor) : [],
    conteo,
    guardadoEn: espacio.guardadoEn ?? null,
    asignacionesDisponibles: asignaciones !== null,
  };
}

export type EstadoActaRecibida = "revisar" | "confirmada" | "faltante";

export interface ActaRecibida {
  mesa: MesaRecinto;
  dignidad: DignidadActa;
  estado: EstadoActaRecibida;
  /** null si aún no llega (faltante). */
  acta: ActaRecinto | null;
}

const ordenActaRecibida: Record<EstadoActaRecibida, number> = {
  revisar: 0,
  confirmada: 1,
  faltante: 2,
};

/**
 * Todas las actas del recinto (mesa × dignidad), incluidas las que aún no
 * llegan. Primero las que hay que revisar; las recibidas, de la más reciente
 * a la más antigua; las faltantes, por número de mesa.
 */
export function listarActasRecinto(tablero: TableroRecinto): ActaRecibida[] {
  return tablero.mesas
    .flatMap((mesa) =>
      dignidadesActa.map((dignidad): ActaRecibida => {
        const acta = mesa.actas.find((item) => item.dignidad === dignidad) ?? null;
        return {
          mesa,
          dignidad,
          acta,
          estado: !acta ? "faltante" : acta.requiereRevision ? "revisar" : "confirmada",
        };
      }),
    )
    .sort(
      (a, b) =>
        ordenActaRecibida[a.estado] - ordenActaRecibida[b.estado] ||
        (b.acta?.actualizadaEn ?? "").localeCompare(a.acta?.actualizadaEn ?? "") ||
        a.mesa.numeroJrv - b.mesa.numeroJrv,
    );
}

/** Mesas que necesitan atención del coordinador, en orden de urgencia. */
export function mesasPorAtender(tablero: TableroRecinto): MesaRecinto[] {
  return tablero.mesas
    .filter((mesa) => mesa.estado !== "guardada" || !mesa.veedor)
    .sort(
      (a, b) =>
        prioridadEstado[a.estado] - prioridadEstado[b.estado] ||
        a.numeroJrv - b.numeroJrv,
    );
}

export class ObtenerTableroRecintoUseCase {
  constructor(private readonly repository: TableroRecintoRepository) {}

  async execute(recintoId: string): Promise<TableroRecinto> {
    if (!recintoId.trim()) {
      throw new Error("El coordinador no tiene un recinto asignado.");
    }
    const [espacio, asignaciones, nombre] = await Promise.all([
      this.repository.loadWorkspace(),
      this.repository.loadAssignments(recintoId),
      this.repository.getRecintoNombre(recintoId).catch(() => null),
    ]);
    return construirTableroRecinto(espacio, asignaciones, nombre);
  }
}

export interface ResultadoTraslado {
  asignadas: string[];
  fallidas: { mesaId: string; error: string }[];
}

/**
 * Asigna varias mesas a un veedor: reemplazo de un veedor ausente o mesas
 * a cargo de un veedor recién creado (RF-20). Cada mesa se asigna por
 * separado; si una falla, las demás se intentan igual y se informa cuáles fallaron.
 */
export class TrasladarMesasUseCase {
  constructor(private readonly repository: TableroRecintoRepository) {}

  async execute(mesaIds: string[], veedorId: string): Promise<ResultadoTraslado> {
    if (!veedorId.trim()) {
      throw new Error("Seleccione el veedor que recibirá las mesas.");
    }
    const resultado: ResultadoTraslado = { asignadas: [], fallidas: [] };
    for (const mesaId of mesaIds) {
      try {
        await this.repository.assignWatcher(mesaId, veedorId);
        resultado.asignadas.push(mesaId);
      } catch (error) {
        resultado.fallidas.push({
          mesaId,
          error: error instanceof Error ? error.message : "No se pudo asignar.",
        });
      }
    }
    return resultado;
  }
}

export class AsignarVeedorMesaRecintoUseCase {
  constructor(private readonly repository: TableroRecintoRepository) {}

  execute(mesaId: string, veedorId: string): Promise<void> {
    if (!mesaId.trim() || !veedorId.trim()) {
      throw new Error("Seleccione una mesa y un veedor.");
    }
    return this.repository.assignWatcher(mesaId, veedorId);
  }
}
