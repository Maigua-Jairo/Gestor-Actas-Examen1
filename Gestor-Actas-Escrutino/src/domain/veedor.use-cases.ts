import {
  dignidadesActa,
  type DignidadActa,
  type EspacioActas,
} from "@/domain/schemas/acta";
import type { EstadoOperacionOffline } from "@/domain/schemas/offline";

/** Estado de una acta (mesa + dignidad) desde el punto de vista del veedor. */
export type EstadoActaVeedora =
  | "guardada"
  | "pendiente"
  | "fallada"
  | "sin_registro";

/** Estado agregado de la mesa: lo más urgente de sus dos actas. */
export type EstadoMesaVeedora =
  | "completa"
  | "parcial"
  | "pendiente"
  | "fallada"
  | "sin_registro";

export interface ActaDeMesaVeedora {
  dignidad: DignidadActa;
  estado: EstadoActaVeedora;
  /** Último error de envío, si lo hubo. */
  detalle: string | null;
}

export interface MesaAsignadaVeedora {
  id: string;
  numeroJrv: number;
  genero: string | null;
  estado: EstadoMesaVeedora;
  actas: ActaDeMesaVeedora[];
}

export interface SiguienteActaVeedora {
  mesaId: string;
  numeroJrv: number;
  dignidad: DignidadActa;
  /** true si es un acta que falló al enviarse y hay que corregirla. */
  esCorreccion: boolean;
}

export interface ResumenVeedora {
  recintoNombre: string | null;
  /** Fecha de la copia local si se trabaja sin conexión; null si los datos son del servidor. */
  guardadoEn: string | null;
  mesas: MesaAsignadaVeedora[];
  actasRegistradas: number;
  actasTotales: number;
  actasEnCola: number;
  siguiente: SiguienteActaVeedora | null;
}

/** Operación de la cola local, ya leída por el repositorio. */
export interface OperacionActaVeedora {
  id: string;
  mesaId: string;
  dignidad: DignidadActa;
  estado: EstadoOperacionOffline;
  ultimoError: string | null;
  intentos: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActaEnColaVeedora {
  id: string;
  mesaId: string;
  mesa: string;
  dignidad: DignidadActa;
  estado: "pendiente" | "proceso" | "fallado";
  ultimoError: string | null;
  intentos: number;
  /** Cuándo se guardó en el teléfono. */
  guardadaEn: string;
}

export interface VeedorRepository {
  loadWorkspace(): Promise<EspacioActas>;
  listOperations(): Promise<OperacionActaVeedora[]>;
  getRecintoNombre(recintoId: string): Promise<string | null>;
  syncPending(): Promise<number>;
}

function ultimaOperacionActiva(
  operaciones: OperacionActaVeedora[],
  mesaId: string,
  dignidad: DignidadActa,
): OperacionActaVeedora | undefined {
  return operaciones
    .filter(
      (operacion) =>
        operacion.mesaId === mesaId &&
        operacion.dignidad === dignidad &&
        operacion.estado !== "guardado",
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function estadoDeMesa(actas: ActaDeMesaVeedora[]): EstadoMesaVeedora {
  if (actas.some((acta) => acta.estado === "fallada")) return "fallada";
  if (actas.some((acta) => acta.estado === "pendiente")) return "pendiente";
  const guardadas = actas.filter((acta) => acta.estado === "guardada").length;
  if (guardadas === actas.length) return "completa";
  if (guardadas > 0) return "parcial";
  return "sin_registro";
}

/**
 * Combina las actas del servidor con la cola local. Una operación local sin
 * confirmar tiene prioridad sobre lo que dice el servidor, porque es lo más
 * reciente que hizo el veedor en este dispositivo.
 */
export function construirResumenVeedora(
  espacio: EspacioActas,
  operaciones: OperacionActaVeedora[],
  recintoNombre: string | null,
): ResumenVeedora {
  const mesas: MesaAsignadaVeedora[] = [...espacio.mesas]
    .sort((a, b) => a.numeroJrv - b.numeroJrv)
    .map((mesa) => {
      const actas = dignidadesActa.map((dignidad): ActaDeMesaVeedora => {
        const operacion = ultimaOperacionActiva(operaciones, mesa.id, dignidad);
        if (operacion?.estado === "fallado") {
          return { dignidad, estado: "fallada", detalle: operacion.ultimoError };
        }
        if (operacion) {
          return { dignidad, estado: "pendiente", detalle: null };
        }
        const enServidor = mesa.actas.some((acta) => acta.dignidad === dignidad);
        return {
          dignidad,
          estado: enServidor ? "guardada" : "sin_registro",
          detalle: null,
        };
      });

      return {
        id: mesa.id,
        numeroJrv: mesa.numeroJrv,
        genero: mesa.genero || null,
        estado: estadoDeMesa(actas),
        actas,
      };
    });

  const todas = mesas.flatMap((mesa) =>
    mesa.actas.map((acta) => ({ mesa, acta })),
  );
  const fallada = todas.find(({ acta }) => acta.estado === "fallada");
  const porRegistrar = todas.find(({ acta }) => acta.estado === "sin_registro");
  const siguiente = fallada ?? porRegistrar;

  return {
    recintoNombre,
    guardadoEn: espacio.guardadoEn ?? null,
    mesas,
    actasTotales: todas.length,
    actasRegistradas: todas.filter(
      ({ acta }) => acta.estado === "guardada" || acta.estado === "pendiente",
    ).length,
    actasEnCola: todas.filter(
      ({ acta }) => acta.estado === "pendiente" || acta.estado === "fallada",
    ).length,
    siguiente: siguiente
      ? {
          mesaId: siguiente.mesa.id,
          numeroJrv: siguiente.mesa.numeroJrv,
          dignidad: siguiente.acta.dignidad,
          esCorreccion: siguiente.acta.estado === "fallada",
        }
      : null,
  };
}

export class ObtenerResumenVeedoraUseCase {
  constructor(private readonly repository: VeedorRepository) {}

  async execute(recintoId: string | null): Promise<ResumenVeedora> {
    const [espacio, operaciones, recintoNombre] = await Promise.all([
      this.repository.loadWorkspace(),
      this.repository.listOperations(),
      recintoId
        ? this.repository.getRecintoNombre(recintoId).catch(() => null)
        : Promise.resolve(null),
    ]);
    return construirResumenVeedora(espacio, operaciones, recintoNombre);
  }
}

export interface ColaVeedora {
  /** Fallidas primero, luego en proceso y pendientes; las más antiguas antes. */
  actas: ActaEnColaVeedora[];
  fallidas: number;
  enProceso: number;
  pendientes: number;
  /** Enviadas en la última media hora, la más reciente primero. */
  enviadasRecientes: ActaEnviadaVeedora[];
}

export interface ActaEnviadaVeedora {
  id: string;
  mesa: string;
  dignidad: DignidadActa;
  enviadaEn: string;
}

/** Ventana para mostrar confirmaciones de envío recientes. */
const VENTANA_ENVIADAS_MS = 30 * 60 * 1000;

const ordenCola: Record<ActaEnColaVeedora["estado"], number> = {
  fallado: 0,
  proceso: 1,
  pendiente: 2,
};

export class ListarActasEnColaVeedoraUseCase {
  constructor(private readonly repository: VeedorRepository) {}

  async execute(ahora: Date = new Date()): Promise<ColaVeedora> {
    const [espacio, operaciones] = await Promise.all([
      this.repository.loadWorkspace(),
      this.repository.listOperations(),
    ]);
    const numeroPorMesa = new Map(
      espacio.mesas.map((mesa) => [mesa.id, String(mesa.numeroJrv)]),
    );
    const mesaDe = (mesaId: string) => numeroPorMesa.get(mesaId) ?? "—";

    const actas: ActaEnColaVeedora[] = operaciones
      .filter((operacion) => operacion.estado !== "guardado")
      .map((operacion) => ({
        id: operacion.id,
        mesaId: operacion.mesaId,
        mesa: mesaDe(operacion.mesaId),
        dignidad: operacion.dignidad,
        estado:
          operacion.estado === "en_proceso"
            ? ("proceso" as const)
            : operacion.estado === "fallado"
              ? ("fallado" as const)
              : ("pendiente" as const),
        ultimoError: operacion.ultimoError,
        intentos: operacion.intentos,
        guardadaEn: operacion.createdAt,
      }))
      .sort(
        (a, b) =>
          ordenCola[a.estado] - ordenCola[b.estado] ||
          a.guardadaEn.localeCompare(b.guardadaEn),
      );

    const desde = ahora.getTime() - VENTANA_ENVIADAS_MS;
    const enviadasRecientes = operaciones
      .filter(
        (operacion) =>
          operacion.estado === "guardado" &&
          new Date(operacion.updatedAt).getTime() >= desde,
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((operacion) => ({
        id: operacion.id,
        mesa: mesaDe(operacion.mesaId),
        dignidad: operacion.dignidad,
        enviadaEn: operacion.updatedAt,
      }));

    return {
      actas,
      fallidas: actas.filter((acta) => acta.estado === "fallado").length,
      enProceso: actas.filter((acta) => acta.estado === "proceso").length,
      pendientes: actas.filter((acta) => acta.estado === "pendiente").length,
      enviadasRecientes,
    };
  }
}

export class ObtenerNombreRecintoUseCase {
  constructor(private readonly repository: VeedorRepository) {}

  execute(recintoId: string): Promise<string | null> {
    return this.repository.getRecintoNombre(recintoId).catch(() => null);
  }
}

export class SincronizarActasVeedoraUseCase {
  constructor(private readonly repository: VeedorRepository) {}

  execute(): Promise<number> {
    return this.repository.syncPending();
  }
}
