import { z } from "zod";

import {
  type AuthRepository,
  type PerfilUsuario,
  type Recinto,
  type UsuarioAutenticado,
  type ResultadoCreacionCuenta,
  type Credenciales,
  type TipoEnlaceAuth,
} from "@/data/auth.repository";
import { puedeCrearCuenta, type RolUsuario } from "@/domain/roles";
import {
  crearUsuarioNuevo,
  usuarioNuevoSchema,
  type UsuarioNuevo,
} from "@/domain/schemas/usuario";
import {
  cambiarClaveSchema,
  inicioSesionSchema,
  recuperarClaveSchema,
} from "@/domain/schemas/auth";

export class IniciarSesionUseCase {
  constructor(private readonly repository: AuthRepository) {}

  async execute(
    email: string,
    password: string,
  ): Promise<UsuarioAutenticado> {
    const credentials: Credenciales = inicioSesionSchema.parse({
      email,
      password,
    });
    return this.repository.signIn(credentials);
  }
}

export class CerrarSesionUseCase {
  constructor(private readonly repository: AuthRepository) {}

  execute(): Promise<void> {
    return this.repository.signOut();
  }
}

export class ObtenerSesionUseCase {
  constructor(private readonly repository: AuthRepository) {}

  execute(): Promise<UsuarioAutenticado | null> {
    return this.repository.getSessionUser();
  }
}

export class ObtenerPerfilUseCase {
  constructor(private readonly repository: AuthRepository) {}

  execute(userId: string): Promise<PerfilUsuario | null> {
    return this.repository.getProfile(userId);
  }
}

export class ListarCuentasUseCase {
  constructor(private readonly repository: AuthRepository) {}

  execute(): Promise<PerfilUsuario[]> {
    return this.repository.getManagedProfiles();
  }
}

export class ListarRecintosUseCase {
  constructor(private readonly repository: AuthRepository) {}

  execute(): Promise<Recinto[]> {
    return this.repository.getRecintos();
  }
}

export class RecuperarClaveUseCase {
  constructor(private readonly repository: AuthRepository) {}

  async execute(email: string, redirectTo: string): Promise<void> {
    const values = recuperarClaveSchema.parse({ email });
    await this.repository.sendPasswordResetEmail(
      values.email,
      redirectTo,
    );
  }
}

export class ConfirmarEnlaceAuthUseCase {
  constructor(private readonly repository: AuthRepository) {}

  execute(tokenHash: string, type: TipoEnlaceAuth): Promise<void> {
    if (!tokenHash.trim()) {
      throw new Error("El enlace está incompleto. Ábralo de nuevo desde el correo.");
    }

    return this.repository.verifyEmailLink(tokenHash, type);
  }
}

export class CanjearCodigoEnlaceUseCase {
  constructor(private readonly repository: AuthRepository) {}

  execute(code: string): Promise<void> {
    if (!code.trim()) {
      throw new Error("El enlace está incompleto. Ábralo de nuevo desde el correo.");
    }
    return this.repository.exchangeLinkCode(code);
  }
}

export class CambiarClaveUseCase {
  constructor(private readonly repository: AuthRepository) {}

  async execute(newPassword: string, confirmation: string): Promise<void> {
    const values = cambiarClaveSchema.parse({
      password: newPassword,
      confirmation,
    });
    await this.repository.updatePassword(values.password);
  }
}

export class CrearCuentaUseCase {
  constructor(private readonly repository: AuthRepository) {}

  async execute(
    creador: RolUsuario,
    valores: z.input<typeof usuarioNuevoSchema>,
  ): Promise<ResultadoCreacionCuenta> {
    const usuario: UsuarioNuevo = crearUsuarioNuevo(valores);

    if (!puedeCrearCuenta(creador, usuario.rol)) {
      throw new Error("No tiene autorizacion para crear este tipo de cuenta.");
    }

    if (usuario.rol === "recinto" && !usuario.recintoId) {
      throw new Error("Debe seleccionar el recinto del coordinador.");
    }

    return this.repository.createAccount(usuario);
  }
}
