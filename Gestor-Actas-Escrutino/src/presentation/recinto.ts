import { SupabaseActaRepository } from "@/data/acta.repository";
import { SupabaseRecintoRepository } from "@/data/recinto.repository";
import {
  AsignarVeedorMesaRecintoUseCase,
  ObtenerTableroRecintoUseCase,
  TrasladarMesasUseCase,
} from "@/domain/recinto.use-cases";
import { territoryRepository } from "@/presentation/territory";
import { veedorRepository } from "@/presentation/veedor";

const recintoRepository = new SupabaseRecintoRepository(
  new SupabaseActaRepository(),
  territoryRepository,
  veedorRepository,
);

export const recintoUseCases = {
  obtenerTablero: new ObtenerTableroRecintoUseCase(recintoRepository),
  asignarVeedor: new AsignarVeedorMesaRecintoUseCase(recintoRepository),
  trasladarMesas: new TrasladarMesasUseCase(recintoRepository),
};
