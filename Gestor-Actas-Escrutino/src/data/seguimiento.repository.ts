import { esErrorDeRed, SinConexionError, sinConexion } from "@/data/network";
import { OfflineDatabase } from "@/data/offline.database";
import { supabase } from "@/data/supabase";
import { distanciaEntreCoordenadasM } from "@/domain/acta.use-cases";
import { DISTANCIA_REVISION_M } from "@/domain/recinto.use-cases";
import type { SeguimientoRepository } from "@/domain/seguimiento.use-cases";
import type {
  AvanceRecinto,
  ConteoCandidato,
  DignidadConteo,
  TableroProvincial,
  UbicacionActa,
} from "@/domain/schemas/seguimiento";

export class SeguimientoRepositoryError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "SeguimientoRepositoryError";
  }
}

function isDignidad(value: string): value is DignidadConteo {
  return value === "ALCALDIA" || value === "PREFECTURA";
}

/** Convierte un error de Supabase: los de red se distinguen para usar la copia local. */
function fail(error: { message?: string; code?: string }, message: string): never {
  if (esErrorDeRed(error)) {
    throw new SinConexionError();
  }
  throw new SeguimientoRepositoryError(message, error.code);
}

const vacio = (provincia: string): TableroProvincial => ({
  provincia,
  resumen: {
    totalRecintos: 0,
    totalMesas: 0,
    mesasCompletas: 0,
    mesasParciales: 0,
    mesasPendientes: 0,
    actasGuardadas: 0,
    actasConIncidencia: 0,
    actasPorDignidad: { ALCALDIA: 0, PREFECTURA: 0 },
    blancosYNulosPorDignidad: { ALCALDIA: 0, PREFECTURA: 0 },
  },
  recintos: [],
  conteoCandidatos: [],
  ubicacionesActas: [],
  guardadoEn: null,
});

export class SupabaseSeguimientoRepository implements SeguimientoRepository {
  constructor(private readonly localCache = new OfflineDatabase()) {}

  /**
   * Tablero de la provincia. Con red se descarga y se guarda una copia; sin
   * red se devuelve esa copia, marcada con su fecha.
   */
  async loadDashboard(provincia: string): Promise<TableroProvincial> {
    const key = `tablero-provincial:${provincia}`;
    const cached = async (): Promise<TableroProvincial> => {
      const entry = await this.localCache.getCache(key).catch(() => null);
      if (!entry) {
        throw new SinConexionError(
          "No hay conexión y este teléfono aún no tiene el tablero guardado.",
        );
      }
      return { ...(JSON.parse(entry.valor) as TableroProvincial), guardadoEn: entry.actualizadoEn };
    };

    if (await sinConexion()) {
      return cached();
    }
    try {
      const tablero = await this.fetchDashboard(provincia);
      await this.localCache.setCache(key, JSON.stringify(tablero)).catch(() => undefined);
      return tablero;
    } catch (error) {
      if (esErrorDeRed(error)) {
        return cached();
      }
      throw error;
    }
  }

  private async fetchDashboard(provincia: string): Promise<TableroProvincial> {
    const { data: recintos, error: recintosError } = await supabase
      .from("recintos")
      .select("id, nombre, canton, parroquia, latitud, longitud")
      .eq("provincia", provincia)
      .order("nombre", { ascending: true });
    if (recintosError) fail(recintosError, "No fue posible consultar los recintos de la provincia.");

    const recintoRows = recintos ?? [];
    const recintoIds = recintoRows.map((recinto) => recinto.id);
    if (recintoIds.length === 0) {
      return vacio(provincia);
    }

    const mesasResult = await supabase
      .from("mesas")
      .select("id, recinto_id, numero_jrv, genero")
      .in("recinto_id", recintoIds);
    if (mesasResult.error) fail(mesasResult.error, "No fue posible consultar las mesas de la provincia.");

    const mesas = mesasResult.data ?? [];
    const mesaIds = mesas.map((mesa) => mesa.id);

    const [actasResult, candidatosResult, organizacionesResult] = await Promise.all([
      mesaIds.length > 0
        ? supabase
            .from("actas")
            .select(
              "id, mesa_id, dignidad, latitud, longitud, updated_at, votos_blancos, votos_nulos, votos(candidato_id, cantidad)",
            )
            .in("mesa_id", mesaIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("candidatos")
        .select("id, nombres, apellidos, dignidad, organizacion_id")
        .eq("activo", true),
      supabase.from("organizaciones").select("id, nombre, siglas").eq("activa", true),
    ]);
    if (actasResult.error) fail(actasResult.error, "No fue posible consultar las actas registradas.");
    if (candidatosResult.error) fail(candidatosResult.error, "No fue posible consultar los candidatos.");
    if (organizacionesResult.error) {
      fail(organizacionesResult.error, "No fue posible consultar las organizaciones políticas.");
    }

    const actas = actasResult.data ?? [];
    const mesaById = new Map(mesas.map((mesa) => [mesa.id, mesa]));
    const recintoById = new Map(recintoRows.map((recinto) => [recinto.id, recinto]));

    // Ubicación de cada acta y distancia a su recinto (S-06).
    const ubicacionesActas: UbicacionActa[] = [];
    const incidenciasPorRecinto = new Map<string, number>();
    const actasPorDignidad: Record<DignidadConteo, number> = { ALCALDIA: 0, PREFECTURA: 0 };
    const blancosYNulosPorDignidad: Record<DignidadConteo, number> = { ALCALDIA: 0, PREFECTURA: 0 };
    const actasByMesa = new Map<string, number>();

    for (const acta of actas) {
      if (!isDignidad(acta.dignidad)) continue;
      const mesa = mesaById.get(acta.mesa_id);
      const recinto = mesa ? recintoById.get(mesa.recinto_id) : undefined;
      if (!mesa || !recinto) continue;

      actasByMesa.set(mesa.id, (actasByMesa.get(mesa.id) ?? 0) + 1);
      actasPorDignidad[acta.dignidad] += 1;
      blancosYNulosPorDignidad[acta.dignidad] += acta.votos_blancos + acta.votos_nulos;

      const distanciaM =
        recinto.latitud !== null && recinto.longitud !== null
          ? distanciaEntreCoordenadasM(
              { latitud: acta.latitud, longitud: acta.longitud },
              { latitud: recinto.latitud, longitud: recinto.longitud },
            )
          : null;
      const requiereRevision = distanciaM !== null && distanciaM > DISTANCIA_REVISION_M;
      if (requiereRevision) {
        incidenciasPorRecinto.set(recinto.id, (incidenciasPorRecinto.get(recinto.id) ?? 0) + 1);
      }

      ubicacionesActas.push({
        actaId: acta.id,
        mesaId: acta.mesa_id,
        numeroJrv: mesa.numero_jrv,
        recintoId: mesa.recinto_id,
        recintoNombre: recinto.nombre,
        dignidad: acta.dignidad,
        latitud: acta.latitud,
        longitud: acta.longitud,
        actualizadaEn: acta.updated_at,
        distanciaM,
        requiereRevision,
      });
    }

    const avances: AvanceRecinto[] = recintoRows.map((recinto) => {
      const mesasRecinto = mesas.filter((mesa) => mesa.recinto_id === recinto.id);
      let completas = 0;
      let parciales = 0;
      let pendientes = 0;
      for (const mesa of mesasRecinto) {
        const count = actasByMesa.get(mesa.id) ?? 0;
        if (count >= 2) completas += 1;
        else if (count === 1) parciales += 1;
        else pendientes += 1;
      }
      return {
        id: recinto.id,
        nombre: recinto.nombre,
        canton: recinto.canton,
        parroquia: recinto.parroquia,
        totalMesas: mesasRecinto.length,
        completas,
        parciales,
        pendientes,
        incidencias: incidenciasPorRecinto.get(recinto.id) ?? 0,
      };
    });

    // Conteo acumulado por candidato.
    const organizacionesById = new Map(
      (organizacionesResult.data ?? []).map((organization) => [organization.id, organization]),
    );
    const conteoByCandidato = new Map<string, ConteoCandidato>();
    for (const candidato of candidatosResult.data ?? []) {
      const organization = organizacionesById.get(candidato.organizacion_id);
      if (!isDignidad(candidato.dignidad) || !organization) continue;
      conteoByCandidato.set(candidato.id, {
        candidatoId: candidato.id,
        nombres: candidato.nombres,
        apellidos: candidato.apellidos,
        organizacionNombre: organization.nombre,
        organizacionSiglas: organization.siglas,
        dignidad: candidato.dignidad,
        votos: 0,
      });
    }
    for (const acta of actas) {
      for (const voto of acta.votos ?? []) {
        const conteo = conteoByCandidato.get(voto.candidato_id);
        if (conteo) conteo.votos += voto.cantidad;
      }
    }

    const sum = (pick: (avance: AvanceRecinto) => number) =>
      avances.reduce((total, avance) => total + pick(avance), 0);

    return {
      provincia,
      resumen: {
        totalRecintos: avances.length,
        totalMesas: mesas.length,
        mesasCompletas: sum((a) => a.completas),
        mesasParciales: sum((a) => a.parciales),
        mesasPendientes: sum((a) => a.pendientes),
        actasGuardadas: ubicacionesActas.length,
        actasConIncidencia: ubicacionesActas.filter((u) => u.requiereRevision).length,
        actasPorDignidad,
        blancosYNulosPorDignidad,
      },
      recintos: avances,
      conteoCandidatos: [...conteoByCandidato.values()].sort((a, b) => b.votos - a.votos),
      ubicacionesActas,
      guardadoEn: null,
    };
  }

  subscribeToActaChanges(onChange: () => void): () => void {
    const channel = supabase
      .channel("tablero-provincial-actas")
      .on("postgres_changes", { event: "*", schema: "public", table: "actas" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "votos" }, onChange)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }
}
