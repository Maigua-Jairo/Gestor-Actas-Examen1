import type {
  EncolarActaInput,
  OperacionActaOffline,
} from "@/domain/schemas/offline";

export interface OfflineQueueRepository {
  initialize(): Promise<void>;
  enqueue(input: EncolarActaInput): Promise<OperacionActaOffline>;
  listPending(): Promise<OperacionActaOffline[]>;
  listAll(): Promise<OperacionActaOffline[]>;
  markProcessing(id: string): Promise<void>;
  markSaved(id: string): Promise<void>;
  markFailed(id: string, message: string): Promise<void>;
  syncPending(): Promise<number>;
  /** Elimina del teléfono un acta que aún no se envió. */
  discard(id: string): Promise<void>;
  /** Fecha ISO de la última vez que la cola se revisó con el servidor. */
  getLastSync(): Promise<string | null>;
}

export class EncolarActaUseCase {
  constructor(private readonly repository: OfflineQueueRepository) {}

  execute(input: EncolarActaInput): Promise<OperacionActaOffline> {
    if (!input.mesaId.trim()) {
      throw new Error("No se pudo identificar la mesa para la cola offline.");
    }
    // Latitud 0 es válida: en Ecuador pasa la línea equinoccial.
    if (
      !Number.isFinite(input.latitud) ||
      !Number.isFinite(input.longitud) ||
      Math.abs(input.latitud) > 90 ||
      Math.abs(input.longitud) > 180
    ) {
      throw new Error("La operación offline requiere ubicación GPS.");
    }
    if (!input.fotoUri && !input.fotoPathExistente) {
      throw new Error("La operación offline requiere una fotografía.");
    }

    return this.repository.enqueue(input);
  }
}

export class ConsultarOperacionesOfflineUseCase {
  constructor(private readonly repository: OfflineQueueRepository) {}

  execute(): Promise<OperacionActaOffline[]> {
    return this.repository.listAll();
  }
}

export class DescartarActaOfflineUseCase {
  constructor(private readonly repository: OfflineQueueRepository) {}

  execute(id: string): Promise<void> {
    return this.repository.discard(id);
  }
}

export class ConsultarUltimaSincronizacionUseCase {
  constructor(private readonly repository: OfflineQueueRepository) {}

  execute(): Promise<string | null> {
    return this.repository.getLastSync();
  }
}

export class SincronizarOperacionesOfflineUseCase {
  constructor(private readonly repository: OfflineQueueRepository) {}

  execute(): Promise<number> {
    return this.repository.syncPending();
  }
}
