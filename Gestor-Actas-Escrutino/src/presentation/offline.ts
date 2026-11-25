import { SQLiteOfflineQueueRepository } from "@/data/offline.repository";
import {
  ConsultarOperacionesOfflineUseCase,
  ConsultarUltimaSincronizacionUseCase,
  DescartarActaOfflineUseCase,
  EncolarActaUseCase,
  SincronizarOperacionesOfflineUseCase,
} from "@/domain/offline.use-cases";

/** Única instancia de la cola: su candado evita sincronizaciones simultáneas. */
export const offlineRepository = new SQLiteOfflineQueueRepository();

export const offlineUseCases = {
  initialize: {
    execute: () => offlineRepository.initialize(),
  },
  encolarActa: new EncolarActaUseCase(offlineRepository),
  consultarOperaciones: new ConsultarOperacionesOfflineUseCase(
    offlineRepository,
  ),
  sincronizarPendientes:
    new SincronizarOperacionesOfflineUseCase(offlineRepository),
  ultimaSincronizacion: new ConsultarUltimaSincronizacionUseCase(offlineRepository),
  descartarActa: new DescartarActaOfflineUseCase(offlineRepository),
};
