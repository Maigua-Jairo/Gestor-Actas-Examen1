import { esErrorDeRed, sinConexion } from "@/data/network";
import { OfflineDatabase } from "@/data/offline.database";
import { supabase } from "@/data/supabase";
import { dignidadesActa, type DignidadActa, type EspacioActas } from "@/domain/schemas/acta";
import type { ActaRepository } from "@/domain/acta.use-cases";
import type { OfflineQueueRepository } from "@/domain/offline.use-cases";
import type {
  OperacionActaVeedora,
  VeedorRepository,
} from "@/domain/veedor.use-cases";

function esDignidad(value: unknown): value is DignidadActa {
  return dignidadesActa.some((dignidad) => dignidad === value);
}

/**
 * Datos del veedor: mesas y actas desde Supabase (RLS limita a sus mesas
 * asignadas) y operaciones pendientes desde la cola SQLite del dispositivo.
 */
export class SupabaseVeedorRepository implements VeedorRepository {
  constructor(
    private readonly actas: ActaRepository,
    private readonly cola: OfflineQueueRepository,
    private readonly localCache = new OfflineDatabase(),
  ) {}

  loadWorkspace(): Promise<EspacioActas> {
    return this.actas.loadWorkspace();
  }

  async listOperations(): Promise<OperacionActaVeedora[]> {
    const operaciones = await this.cola.listAll();
    return operaciones.flatMap((operacion) => {
      try {
        const payload = JSON.parse(operacion.payload) as {
          mesaId?: unknown;
          dignidad?: unknown;
        };
        if (typeof payload.mesaId !== "string" || !esDignidad(payload.dignidad)) {
          return [];
        }
        return [
          {
            id: operacion.id,
            mesaId: payload.mesaId,
            dignidad: payload.dignidad,
            estado: operacion.estado,
            ultimoError: operacion.ultimoError,
            intentos: operacion.intentos,
            createdAt: operacion.createdAt,
            updatedAt: operacion.updatedAt,
          },
        ];
      } catch {
        // Una operación ilegible no debe impedir mostrar las demás.
        return [];
      }
    });
  }

  async getRecintoNombre(recintoId: string): Promise<string | null> {
    const key = `recinto-nombre:${recintoId}`;
    const cached = async () =>
      (await this.localCache.getCache(key).catch(() => null))?.valor ?? null;

    if (await sinConexion()) {
      return cached();
    }

    const { data, error } = await supabase
      .from("recintos")
      .select("nombre")
      .eq("id", recintoId)
      .maybeSingle();
    if (error) {
      if (esErrorDeRed(error)) {
        return cached();
      }
      throw new Error("No fue posible consultar el recinto.");
    }
    if (data?.nombre) {
      await this.localCache.setCache(key, data.nombre).catch(() => undefined);
    }
    return data?.nombre ?? null;
  }

  syncPending(): Promise<number> {
    return this.cola.syncPending();
  }
}
