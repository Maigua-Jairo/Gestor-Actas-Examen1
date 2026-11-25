import {
  type TerritoryRepository,
  type TableroAsignaciones,
  type RecintoTerritorial,
} from "@/data/territory.repository";
import {
  nuevoRecintoSchema,
  type NuevoRecinto,
} from "@/domain/schemas/recinto";

export class ListarRecintosPorProvinciaUseCase {
  constructor(private readonly repository: TerritoryRepository) {}

  execute(provincia: string): Promise<RecintoTerritorial[]> {
    return this.repository.listRecintos(provincia);
  }
}

export class CrearRecintoUseCase {
  constructor(private readonly repository: TerritoryRepository) {}

  execute(
    provincia: string,
    valores: NuevoRecinto,
  ): Promise<RecintoTerritorial> {
    if (!provincia.trim()) {
      throw new Error("El perfil provincial no tiene provincia asignada.");
    }

    return this.repository.createRecinto(
      provincia,
      nuevoRecintoSchema.parse(valores),
    );
  }
}

export class ObtenerTableroAsignacionesUseCase {
  constructor(private readonly repository: TerritoryRepository) {}

  execute(recintoId: string): Promise<TableroAsignaciones> {
    if (!recintoId.trim()) {
      throw new Error("El coordinador no tiene un recinto asignado.");
    }

    return this.repository.getAssignmentBoard(recintoId);
  }
}

export class AsignarVeedoraMesaUseCase {
  constructor(private readonly repository: TerritoryRepository) {}

  execute(mesaId: string, veedorId: string): Promise<void> {
    if (!mesaId.trim() || !veedorId.trim()) {
      throw new Error("Selecciona una mesa y un veedor.");
    }

    return this.repository.assignWatcher(mesaId, veedorId);
  }
}
