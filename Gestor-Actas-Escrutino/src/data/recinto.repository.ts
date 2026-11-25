import { esErrorDeRed, SinConexionError, sinConexion } from "@/data/network";
import { OfflineDatabase } from "@/data/offline.database";
import type { TerritoryRepository } from "@/data/territory.repository";
import type { ActaRepository } from "@/domain/acta.use-cases";
import type { EspacioActas } from "@/domain/schemas/acta";
import type {
  AsignacionesRecinto,
  TableroRecintoRepository,
} from "@/domain/recinto.use-cases";
import type { VeedorRepository } from "@/domain/veedor.use-cases";

/**
 * Datos del coordinador de recinto. Reutiliza los repositorios de actas
 * (RLS ya limita a las mesas de su recinto) y de territorio, y guarda una
 * copia de las asignaciones para poder consultarlas sin señal.
 */
export class SupabaseRecintoRepository implements TableroRecintoRepository {
  constructor(
    private readonly actas: ActaRepository,
    private readonly territorio: TerritoryRepository,
    private readonly nombres: Pick<VeedorRepository, "getRecintoNombre">,
    private readonly localCache = new OfflineDatabase(),
  ) {}

  loadWorkspace(): Promise<EspacioActas> {
    return this.actas.loadWorkspace();
  }

  async loadAssignments(recintoId: string): Promise<AsignacionesRecinto | null> {
    const key = `asignaciones-recinto:${recintoId}`;
    const cached = async (): Promise<AsignacionesRecinto | null> => {
      const entry = await this.localCache.getCache(key).catch(() => null);
      return entry ? (JSON.parse(entry.valor) as AsignacionesRecinto) : null;
    };

    if (await sinConexion()) {
      return cached();
    }
    try {
      const board = await this.territorio.getAssignmentBoard(recintoId);
      const value: AsignacionesRecinto = {
        mesas: board.mesas.map((mesa) => ({ id: mesa.id, veedorId: mesa.veedorId })),
        veedores: board.veedores,
      };
      await this.localCache.setCache(key, JSON.stringify(value)).catch(() => undefined);
      return value;
    } catch (error) {
      if (esErrorDeRed(error)) {
        return cached();
      }
      throw error;
    }
  }

  getRecintoNombre(recintoId: string): Promise<string | null> {
    return this.nombres.getRecintoNombre(recintoId);
  }

  async assignWatcher(mesaId: string, veedorId: string): Promise<void> {
    if (await sinConexion()) {
      throw new SinConexionError("Necesita conexión para cambiar el veedor de una mesa.");
    }
    await this.territorio.assignWatcher(mesaId, veedorId);
  }
}
