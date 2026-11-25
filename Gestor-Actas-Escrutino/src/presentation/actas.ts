import { SupabaseActaRepository } from "@/data/acta.repository";
import {
  ObtenerEvidenciaActaUseCase,
  ObtenerEspacioActasUseCase,
} from "@/domain/acta.use-cases";

const actaRepository = new SupabaseActaRepository();

export const actaUseCases = {
  obtenerEspacio: new ObtenerEspacioActasUseCase(actaRepository),
  obtenerEvidencia: new ObtenerEvidenciaActaUseCase(actaRepository),
};
