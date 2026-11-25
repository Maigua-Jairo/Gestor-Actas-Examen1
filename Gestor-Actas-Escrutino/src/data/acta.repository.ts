import { getSesionLocal } from "@/data/local-session.storage";
import { esErrorDeRed, SinConexionError, sinConexion } from "@/data/network";
import { OfflineDatabase } from "@/data/offline.database";
import { supabase } from "@/data/supabase";
import {
  dignidadesActa,
  type ActaRegistrada,
  type CandidatoActa,
  type DignidadActa,
  type EspacioActas,
  type MesaActa,
} from "@/domain/schemas/acta";
import type { ActaRepository } from "@/domain/acta.use-cases";

const evidenceBucket = "evidencias-actas";
export class ActaRepositoryError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ActaRepositoryError";
  }
}

function isDignidadActa(value: string): value is DignidadActa {
  return dignidadesActa.some((dignidad) => dignidad === value);
}

async function workspaceCacheKey(): Promise<string | null> {
  const local = await getSesionLocal();
  if (local) {
    return `espacio-actas:${local.userId}`;
  }
  const { data } = await supabase.auth.getSession();
  return data.session ? `espacio-actas:${data.session.user.id}` : null;
}

export class SupabaseActaRepository implements ActaRepository {
  constructor(private readonly localCache = new OfflineDatabase()) {}

  /**
   * Mesas, candidatos y actas. Con red se descargan y se guarda una copia en
   * el teléfono; sin red se devuelve esa copia, marcada con su fecha.
   */
  async loadWorkspace(): Promise<EspacioActas> {
    const key = await workspaceCacheKey();

    if (key && (await sinConexion())) {
      return this.readCachedWorkspace(key);
    }

    try {
      const workspace = await this.fetchWorkspace();
      if (key) {
        await this.localCache
          .setCache(key, JSON.stringify(workspace))
          .catch(() => undefined);
      }
      return workspace;
    } catch (error) {
      if (key && esErrorDeRed(error)) {
        return this.readCachedWorkspace(key);
      }
      throw error;
    }
  }

  private async readCachedWorkspace(key: string): Promise<EspacioActas> {
    const entry = await this.localCache.getCache(key);
    if (!entry) {
      throw new SinConexionError(
        "No hay conexión y este teléfono aún no tiene sus mesas guardadas. Conéctese a internet una vez para descargarlas.",
      );
    }
    const workspace = JSON.parse(entry.valor) as EspacioActas;
    return { ...workspace, guardadoEn: entry.actualizadoEn };
  }

  private async fetchWorkspace(): Promise<EspacioActas> {
    const [mesasResult, organizationsResult, candidatesResult, actasResult] =
      await Promise.all([
        supabase
          .from("mesas")
          .select("id, numero_jrv, genero, recintos(latitud, longitud)")
          .order("numero_jrv", { ascending: true }),
        supabase
          .from("organizaciones")
          .select("id, nombre, siglas, orden")
          .eq("activa", true)
          .order("orden", { ascending: true }),
        supabase
          .from("candidatos")
          .select("id, nombres, apellidos, dignidad, organizacion_id")
          .eq("activo", true)
          .order("apellidos", { ascending: true }),
        supabase
          .from("actas")
          .select(
            "id, mesa_id, dignidad, total_sufragantes, votos_blancos, votos_nulos, foto_path, latitud, longitud, version, updated_at, votos(candidato_id, cantidad)",
          ),
      ]);

    const networkFailure = [
      mesasResult.error,
      organizationsResult.error,
      candidatesResult.error,
      actasResult.error,
    ].some((error) => error && esErrorDeRed(error));
    if (networkFailure) {
      throw new SinConexionError();
    }

    if (mesasResult.error) {
      throw new ActaRepositoryError(
        "No fue posible consultar las mesas asignadas.",
        mesasResult.error.code,
      );
    }
    if (organizationsResult.error) {
      throw new ActaRepositoryError(
        "No fue posible consultar las organizaciones políticas.",
        organizationsResult.error.code,
      );
    }
    if (candidatesResult.error) {
      throw new ActaRepositoryError(
        "No fue posible consultar los candidatos.",
        candidatesResult.error.code,
      );
    }
    if (actasResult.error) {
      throw new ActaRepositoryError(
        "No fue posible consultar las actas registradas.",
        actasResult.error.code,
      );
    }

    const organizationsById = new Map(
      (organizationsResult.data ?? []).map((organization) => [
        organization.id,
        organization,
      ]),
    );

    const candidates: CandidatoActa[] = (candidatesResult.data ?? [])
      .filter((candidate) => {
        const organization = organizationsById.get(candidate.organizacion_id);
        return isDignidadActa(candidate.dignidad) && organization !== undefined;
      })
      .map((candidate) => {
        const organization = organizationsById.get(candidate.organizacion_id);
        if (!organization || !isDignidadActa(candidate.dignidad)) {
          throw new ActaRepositoryError(
            "Un candidato no está asociado a una organización activa.",
          );
        }

        return {
          id: candidate.id,
          nombres: candidate.nombres,
          apellidos: candidate.apellidos,
          dignidad: candidate.dignidad,
          organizacionId: candidate.organizacion_id,
          organizacionNombre: organization.nombre,
          organizacionSiglas: organization.siglas,
          organizacionOrden: organization.orden,
        };
      })
      .sort(
        (first, second) =>
          first.organizacionOrden - second.organizacionOrden ||
          first.apellidos.localeCompare(second.apellidos, "es"),
      );

    const registeredActsByMesa = new Map<string, ActaRegistrada[]>();
    for (const row of actasResult.data ?? []) {
      if (!isDignidadActa(row.dignidad)) {
        throw new ActaRepositoryError(
          "El acta registrada tiene una dignidad desconocida.",
        );
      }

      const acts = registeredActsByMesa.get(row.mesa_id) ?? [];
      acts.push({
        id: row.id,
        dignidad: row.dignidad,
        totalSufragantes: row.total_sufragantes,
        votosBlancos: row.votos_blancos,
        votosNulos: row.votos_nulos,
        fotoPath: row.foto_path,
        latitud: row.latitud,
        longitud: row.longitud,
        version: row.version,
        actualizadaEn: row.updated_at,
        votos: (row.votos ?? []).map((vote) => ({
          candidatoId: vote.candidato_id,
          cantidad: vote.cantidad,
        })),
      });
      registeredActsByMesa.set(row.mesa_id, acts);
    }

    const mesas: MesaActa[] = (mesasResult.data ?? []).map((mesa) => {
      const recinto = Array.isArray(mesa.recintos)
        ? mesa.recintos[0]
        : mesa.recintos;

      return {
        id: mesa.id,
        numeroJrv: mesa.numero_jrv,
        genero: mesa.genero,
        recintoLatitud: recinto?.latitud ?? null,
        recintoLongitud: recinto?.longitud ?? null,
        actas: registeredActsByMesa.get(mesa.id) ?? [],
      };
    });

    return { mesas, candidatos: candidates, guardadoEn: null };
  }

  async getEvidenceUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(evidenceBucket)
      .createSignedUrl(path, 60 * 60);

    if (error) {
      throw new ActaRepositoryError(
        "No fue posible cargar la fotografía de esta acta.",
        error.name,
      );
    }

    return data.signedUrl;
  }
}
