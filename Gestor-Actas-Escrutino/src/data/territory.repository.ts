import { supabase } from "@/data/supabase";
import type { NuevoRecinto } from "@/domain/schemas/recinto";

export interface RecintoTerritorial extends NuevoRecinto {
  id: string;
  provincia: string;
}

export interface VeedorAsignable {
  id: string;
  nombres: string;
  apellidos: string;
}

export interface MesaAsignacion {
  id: string;
  numeroJrv: number;
  genero: string | null;
  veedorId: string | null;
}

export interface TableroAsignaciones {
  mesas: MesaAsignacion[];
  veedores: VeedorAsignable[];
}

export class TerritoryRepositoryError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "TerritoryRepositoryError";
  }
}

export interface TerritoryRepository {
  listRecintos(provincia: string): Promise<RecintoTerritorial[]>;
  createRecinto(
    provincia: string,
    recinto: NuevoRecinto,
  ): Promise<RecintoTerritorial>;
  getAssignmentBoard(recintoId: string): Promise<TableroAsignaciones>;
  assignWatcher(mesaId: string, veedorId: string): Promise<void>;
}

const recintoColumns = "id, provincia, canton, parroquia, nombre";

export class SupabaseTerritoryRepository implements TerritoryRepository {
  async listRecintos(provincia: string): Promise<RecintoTerritorial[]> {
    const { data, error } = await supabase
      .from("recintos")
      .select(recintoColumns)
      .eq("provincia", provincia)
      .order("nombre", { ascending: true });

    if (error) {
      throw new TerritoryRepositoryError(
        "No fue posible consultar los recintos.",
        error.code,
      );
    }

    return data ?? [];
  }

  async createRecinto(
    provincia: string,
    recinto: NuevoRecinto,
  ): Promise<RecintoTerritorial> {
    const { data, error } = await supabase
      .from("recintos")
      .insert({ ...recinto, provincia })
      .select(recintoColumns)
      .single();

    if (error) {
      throw new TerritoryRepositoryError(
        "No fue posible registrar el recinto.",
        error.code,
      );
    }

    return data;
  }

  async getAssignmentBoard(recintoId: string): Promise<TableroAsignaciones> {
    const [mesasResult, veedoresResult] = await Promise.all([
      supabase
        .from("mesas")
        .select("id, numero_jrv, genero")
        .eq("recinto_id", recintoId)
        .order("numero_jrv", { ascending: true }),
      supabase
        .from("perfiles")
        .select("id, nombres, apellidos")
        .eq("recinto_id", recintoId)
        .eq("rol", "veedor")
        .order("apellidos", { ascending: true }),
    ]);

    if (mesasResult.error) {
      throw new TerritoryRepositoryError(
        "No fue posible consultar las mesas del recinto.",
        mesasResult.error.code,
      );
    }
    if (veedoresResult.error) {
      throw new TerritoryRepositoryError(
        "No fue posible consultar los veedores del recinto.",
        veedoresResult.error.code,
      );
    }

    const mesaIds = (mesasResult.data ?? []).map((mesa) => mesa.id);
    let activeAssignments: { mesa_id: string; veedor_id: string }[] = [];

    if (mesaIds.length > 0) {
      const { data, error } = await supabase
        .from("asignaciones_veedor")
        .select("mesa_id, veedor_id")
        .eq("activa", true)
        .in("mesa_id", mesaIds);

      if (error) {
        throw new TerritoryRepositoryError(
          "No fue posible consultar las asignaciones actuales.",
          error.code,
        );
      }

      activeAssignments = data ?? [];
    }

    const assignedVeedorByMesa = new Map(
      activeAssignments.map((assignment) => [
        assignment.mesa_id,
        assignment.veedor_id,
      ]),
    );

    return {
      mesas: (mesasResult.data ?? []).map((mesa) => ({
        id: mesa.id,
        numeroJrv: mesa.numero_jrv,
        genero: mesa.genero,
        veedorId: assignedVeedorByMesa.get(mesa.id) ?? null,
      })),
      veedores: (veedoresResult.data ?? []).map((veedor) => ({
        id: veedor.id,
        nombres: veedor.nombres,
        apellidos: veedor.apellidos,
      })),
    };
  }

  async assignWatcher(mesaId: string, veedorId: string): Promise<void> {
    const { error } = await supabase.rpc("asignar_veedor_a_mesa", {
      p_mesa_id: mesaId,
      p_veedor_id: veedorId,
    });

    if (error) {
      throw new TerritoryRepositoryError(
        "No fue posible asignar el veedor a la mesa.",
        error.code,
      );
    }
  }
}
