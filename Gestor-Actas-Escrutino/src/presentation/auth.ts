import { SupabaseAuthRepository } from "@/data/auth.repository";
import {
  CambiarClaveUseCase,
  CanjearCodigoEnlaceUseCase,
  CerrarSesionUseCase,
  ConfirmarEnlaceAuthUseCase,
  CrearCuentaUseCase,
  IniciarSesionUseCase,
  ListarCuentasUseCase,
  ListarRecintosUseCase,
  ObtenerPerfilUseCase,
  ObtenerSesionUseCase,
  RecuperarClaveUseCase,
} from "@/domain/auth.use-cases";

export const authRepository = new SupabaseAuthRepository();

export const authUseCases = {
  iniciarSesion: new IniciarSesionUseCase(authRepository),
  cerrarSesion: new CerrarSesionUseCase(authRepository),
  obtenerPerfil: new ObtenerPerfilUseCase(authRepository),
  obtenerSesion: new ObtenerSesionUseCase(authRepository),
  listarCuentas: new ListarCuentasUseCase(authRepository),
  listarRecintos: new ListarRecintosUseCase(authRepository),
  recuperarClave: new RecuperarClaveUseCase(authRepository),
  confirmarEnlace: new ConfirmarEnlaceAuthUseCase(authRepository),
  canjearCodigoEnlace: new CanjearCodigoEnlaceUseCase(authRepository),
  cambiarClave: new CambiarClaveUseCase(authRepository),
  crearCuenta: new CrearCuentaUseCase(authRepository),
};
