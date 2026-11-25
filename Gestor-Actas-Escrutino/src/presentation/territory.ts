import { SupabaseTerritoryRepository } from "@/data/territory.repository";
import {
  AsignarVeedoraMesaUseCase,
  CrearRecintoUseCase,
  ListarRecintosPorProvinciaUseCase,
  ObtenerTableroAsignacionesUseCase,
} from "@/domain/territory.use-cases";

export const territoryRepository = new SupabaseTerritoryRepository();

export const territoryUseCases = {
  listarRecintos: new ListarRecintosPorProvinciaUseCase(territoryRepository),
  crearRecinto: new CrearRecintoUseCase(territoryRepository),
  obtenerTableroAsignaciones: new ObtenerTableroAsignacionesUseCase(
    territoryRepository,
  ),
  asignarVeedoraMesa: new AsignarVeedoraMesaUseCase(territoryRepository),
};
