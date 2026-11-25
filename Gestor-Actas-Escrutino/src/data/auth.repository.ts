import {
  clearSesionLocal,
  getSesionLocal,
  saveSesionLocal,
} from "@/data/local-session.storage";
import { esErrorDeRed, SinConexionError, sinConexion } from "@/data/network";
import { OfflineDatabase } from "@/data/offline.database";
import { supabase } from "@/data/supabase";
import { type RolUsuario } from "@/domain/roles";
import { type UsuarioNuevo } from "@/domain/schemas/usuario";

export interface UsuarioAutenticado {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
  debeCambiarClave: boolean;
}

export interface PerfilUsuario {
  id: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  email: string;
  rol: RolUsuario;
  provincia: string | null;
  recintoId: string | null;
  debeCambiarClave: boolean;
}

export interface Recinto {
  id: string;
  nombre: string;
  provincia: string;
  canton: string;
}

export interface Credenciales {
  email: string;
  password: string;
}

export type TipoEnlaceAuth = "signup" | "recovery";

export interface ResultadoCreacionCuenta {
  id: string;
  email: string;
  rol: "recinto" | "veedor";
  debeCambiarClave: true;
  temporaryPassword: string;
  verificationEmailSent: true;
}

export class AuthRepositoryError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AuthRepositoryError";
  }
}

export interface AuthRepository {
  signIn(credentials: Credenciales): Promise<UsuarioAutenticado>;
  signOut(): Promise<void>;
  getSessionUser(): Promise<UsuarioAutenticado | null>;
  getProfile(userId: string): Promise<PerfilUsuario | null>;
  getManagedProfiles(): Promise<PerfilUsuario[]>;
  getRecintos(): Promise<Recinto[]>;
  sendPasswordResetEmail(email: string, redirectTo: string): Promise<void>;
  verifyEmailLink(tokenHash: string, type: TipoEnlaceAuth): Promise<void>;
  /** Enlaces PKCE que llegan con ?code= en lugar de token_hash. */
  exchangeLinkCode(code: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
  createAccount(user: UsuarioNuevo): Promise<ResultadoCreacionCuenta>;
}

function mapUser(
  user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"],
  debeCambiarClave = false,
): UsuarioAutenticado | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at),
    debeCambiarClave,
  };
}

function esRolUsuario(value: string): value is RolUsuario {
  return (
    value === "provincial" ||
    value === "recinto" ||
    value === "veedor"
  );
}

export class SupabaseAuthRepository implements AuthRepository {
  constructor(private readonly localCache = new OfflineDatabase()) {}

  async signIn(credentials: Credenciales): Promise<UsuarioAutenticado> {
    const { data, error } = await supabase.auth.signInWithPassword(credentials);

    if (error) {
      throw new AuthRepositoryError(
        "Correo o clave incorrectos.",
        error.code,
      );
    }

    const user = mapUser(data.user);
    if (!user) {
      throw new AuthRepositoryError("No fue posible obtener la sesion.");
    }

    const profile = await this.getProfile(user.id);
    if (!profile) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        throw new AuthRepositoryError(
          "La cuenta no tiene perfil habilitado y no se pudo cerrar su sesion.",
          signOutError.code,
        );
      }
      throw new AuthRepositoryError(
        "La cuenta no tiene un perfil habilitado. Contacte al administrador.",
      );
    }

    await saveSesionLocal(user.email, profile).catch(() => undefined);
    return { ...user, debeCambiarClave: profile.debeCambiarClave };
  }

  async signOut(): Promise<void> {
    // Primero lo local: aunque no haya red, la persona sale de la app.
    await clearSesionLocal().catch(() => undefined);
    await this.localCache.clearCache().catch(() => undefined);

    const { error } = await supabase.auth.signOut();
    if (!error) {
      return;
    }
    if (esErrorDeRed(error)) {
      // Sin red no se puede revocar en el servidor; se borra la sesión del teléfono.
      await supabase.auth.signOut({ scope: "local" });
      return;
    }
    throw new AuthRepositoryError(
      "No fue posible cerrar la sesion.",
      error.code,
    );
  }

  /**
   * Usuario de la sesión actual. Con red lo valida contra Supabase; sin red
   * usa la copia local de la última sesión válida.
   */
  async getSessionUser(): Promise<UsuarioAutenticado | null> {
    if (await sinConexion()) {
      return this.getOfflineSessionUser();
    }

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (esErrorDeRed(error)) {
        return this.getOfflineSessionUser();
      }
      if (
        error.name === "AuthSessionMissingError" ||
        error.code === "session_not_found" ||
        error.code === "user_not_found"
      ) {
        await clearSesionLocal().catch(() => undefined);
        return null;
      }
      throw new AuthRepositoryError(
        "No fue posible recuperar la sesion.",
        error.code,
      );
    }

    const user = mapUser(data.user);
    if (!user) {
      return null;
    }

    let profile: PerfilUsuario | null;
    try {
      profile = await this.getProfile(user.id);
    } catch (profileError) {
      if (esErrorDeRed(profileError)) {
        return this.getOfflineSessionUser();
      }
      throw profileError;
    }
    if (!profile) {
      await this.signOut();
      return null;
    }

    return { ...user, debeCambiarClave: profile.debeCambiarClave };
  }

  private async getOfflineSessionUser(): Promise<UsuarioAutenticado | null> {
    const local = await getSesionLocal();
    if (!local) {
      return null;
    }
    return {
      id: local.userId,
      email: local.email,
      emailConfirmed: true,
      debeCambiarClave: local.perfil.debeCambiarClave,
    };
  }

  async getProfile(userId: string): Promise<PerfilUsuario | null> {
    const local = await getSesionLocal();
    const cached = local?.userId === userId ? local.perfil : null;

    if (cached && (await sinConexion())) {
      return cached;
    }

    const { data, error } = await supabase
      .from("perfiles")
      .select(
        "id, cedula, nombres, apellidos, telefono, correo, rol, provincia, recinto_id, debe_cambiar_clave",
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      if (cached && esErrorDeRed(error)) {
        return cached;
      }
      if (esErrorDeRed(error)) {
        throw new SinConexionError(
          "Necesita conexión a internet para abrir la app por primera vez.",
        );
      }
      throw new AuthRepositoryError(
        "No fue posible consultar el perfil.",
        error.code,
      );
    }

    if (!data) {
      return null;
    }

    if (!esRolUsuario(data.rol)) {
      throw new AuthRepositoryError("El perfil tiene un rol no reconocido.");
    }

    const profile: PerfilUsuario = {
      id: data.id,
      cedula: data.cedula,
      nombres: data.nombres,
      apellidos: data.apellidos,
      telefono: data.telefono,
      email: data.correo,
      rol: data.rol,
      provincia: data.provincia ?? null,
      recintoId: data.recinto_id ?? null,
      debeCambiarClave: data.debe_cambiar_clave === true,
    };

    // Solo se actualiza la copia de la persona que tiene la sesión abierta.
    if (local?.userId === userId) {
      await saveSesionLocal(local.email, profile).catch(() => undefined);
    }
    return profile;
  }

  async getManagedProfiles(): Promise<PerfilUsuario[]> {
    const { data, error } = await supabase
      .from("perfiles")
      .select(
        "id, cedula, nombres, apellidos, telefono, correo, rol, provincia, recinto_id, debe_cambiar_clave",
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw new AuthRepositoryError(
        "No fue posible consultar las cuentas.",
        error.code,
      );
    }

    return (data ?? []).map((profile) => {
      if (!esRolUsuario(profile.rol)) {
        throw new AuthRepositoryError("Se encontro una cuenta con rol desconocido.");
      }

      return {
        id: profile.id,
        cedula: profile.cedula,
        nombres: profile.nombres,
        apellidos: profile.apellidos,
        telefono: profile.telefono,
        email: profile.correo,
        rol: profile.rol,
        provincia: profile.provincia ?? null,
        recintoId: profile.recinto_id ?? null,
        debeCambiarClave: profile.debe_cambiar_clave === true,
      };
    });
  }

  async getRecintos(): Promise<Recinto[]> {
    const { data, error } = await supabase
      .from("recintos")
      .select("id, nombre, provincia, canton")
      .order("nombre", { ascending: true });

    if (error) {
      throw new AuthRepositoryError(
        "No fue posible consultar los recintos.",
        error.code,
      );
    }

    return data ?? [];
  }

  async sendPasswordResetEmail(
    email: string,
    redirectTo: string,
  ): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      throw new AuthRepositoryError(
        "No fue posible enviar la recuperacion de clave.",
        error.code,
      );
    }
  }

  async verifyEmailLink(
    tokenHash: string,
    type: TipoEnlaceAuth,
  ): Promise<void> {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) {
      throw new AuthRepositoryError(
        esErrorDeRed(error)
          ? "Necesita conexión a internet para verificar el enlace."
          : "El enlace venció o ya se usó. Pida uno nuevo.",
        error.code,
      );
    }
  }

  async exchangeLinkCode(code: string): Promise<void> {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw new AuthRepositoryError(
        esErrorDeRed(error)
          ? "Necesita conexión a internet para verificar el enlace."
          : "El enlace venció o ya se usó. Pida uno nuevo.",
        error.code,
      );
    }
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      const messages: Record<string, string> = {
        same_password: "La nueva clave debe ser distinta de la anterior.",
        weak_password:
          "La clave es demasiado fácil de adivinar. Elija una más segura.",
        reauthentication_needed:
          "Por seguridad, vuelva a iniciar sesión y cambie la clave enseguida.",
        session_not_found:
          "Su sesión expiró. Vuelva a iniciar sesión para cambiar la clave.",
      };
      throw new AuthRepositoryError(
        (error.code && messages[error.code]) ||
          "No fue posible cambiar la clave. Inténtelo nuevamente.",
        error.code,
      );
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) {
      throw new AuthRepositoryError(
        "La clave se actualizó, pero no se pudo verificar el perfil.",
        userError?.code,
      );
    }

    const profile = await this.getProfile(userId);
    if (!profile || profile.debeCambiarClave) {
      throw new AuthRepositoryError(
        "La clave se actualizó, pero no se pudo confirmar el cambio en la cuenta.",
      );
    }
  }

  async createAccount(
    user: UsuarioNuevo,
  ): Promise<ResultadoCreacionCuenta> {
    const { data, error } = await supabase.functions.invoke("crear-cuenta", {
      body: user,
    });

    if (error) {
      let message = error.message;
      if (error.context instanceof Response) {
        try {
          const responseBody = await error.context.clone().json();
          if (
            typeof responseBody === "object" &&
            responseBody !== null &&
            typeof responseBody.error === "string"
          ) {
            message = responseBody.error;
          }
        } catch {
          message = error.message;
        }
      }

      throw new AuthRepositoryError(
        message || "No fue posible crear la cuenta.",
        error.name,
      );
    }

    if (
      !data ||
      !data.account ||
      typeof data.account.id !== "string" ||
      typeof data.account.email !== "string" ||
      (data.account.rol !== "recinto" &&
        data.account.rol !== "veedor") ||
      typeof data.temporaryPassword !== "string" ||
      data.verificationEmailSent !== true
    ) {
      throw new AuthRepositoryError(
        "La funcion no devolvio los datos de la cuenta creada.",
      );
    }

    return {
      id: data.account.id,
      email: data.account.email,
      rol: data.account.rol,
      debeCambiarClave: true,
      temporaryPassword: data.temporaryPassword,
      verificationEmailSent: true,
    };
  }
}