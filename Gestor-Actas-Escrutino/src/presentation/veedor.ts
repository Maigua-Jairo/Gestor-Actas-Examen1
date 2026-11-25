import { SupabaseActaRepository } from "@/data/acta.repository";
import { SupabaseVeedorRepository } from "@/data/veedor.repository";
import {
  ListarActasEnColaVeedoraUseCase,
  ObtenerNombreRecintoUseCase,
  ObtenerResumenVeedoraUseCase,
  SincronizarActasVeedoraUseCase,
} from "@/domain/veedor.use-cases";
import { offlineRepository } from "@/presentation/offline";

// Usa la misma cola que el resto de la app para que nunca haya dos
// sincronizaciones simultáneas del mismo elemento.
export const veedorRepository = new SupabaseVeedorRepository(
  new SupabaseActaRepository(),
  offlineRepository,
);

export const veedorUseCases = {
  obtenerResumen: new ObtenerResumenVeedoraUseCase(veedorRepository),
  listarActasEnCola: new ListarActasEnColaVeedoraUseCase(veedorRepository),
  obtenerNombreRecinto: new ObtenerNombreRecintoUseCase(veedorRepository),
  sincronizarPendientes: new SincronizarActasVeedoraUseCase(veedorRepository),
};
