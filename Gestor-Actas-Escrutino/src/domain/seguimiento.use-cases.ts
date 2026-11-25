import type { TableroProvincial } from "@/domain/schemas/seguimiento";

export interface SeguimientoRepository {
  loadDashboard(provincia: string): Promise<TableroProvincial>;
  subscribeToActaChanges(onChange: () => void): () => void;
}

export class ObtenerTableroProvincialUseCase {
  constructor(private readonly repository: SeguimientoRepository) {}

  execute(provincia: string): Promise<TableroProvincial> {
    if (!provincia.trim()) {
      throw new Error("El perfil provincial no tiene provincia asignada.");
    }

    return this.repository.loadDashboard(provincia);
  }
}

export class SuscribirTableroProvincialUseCase {
  constructor(private readonly repository: SeguimientoRepository) {}

  execute(onChange: () => void): () => void {
    return this.repository.subscribeToActaChanges(onChange);
  }
}
