import { SupabaseSeguimientoRepository } from "@/data/seguimiento.repository";
import {
  ObtenerTableroProvincialUseCase,
  SuscribirTableroProvincialUseCase,
} from "@/domain/seguimiento.use-cases";

const seguimientoRepository = new SupabaseSeguimientoRepository();

export const seguimientoUseCases = {
  obtenerTablero: new ObtenerTableroProvincialUseCase(
    seguimientoRepository,
  ),
  suscribirCambios: new SuscribirTableroProvincialUseCase(
    seguimientoRepository,
  ),
};
