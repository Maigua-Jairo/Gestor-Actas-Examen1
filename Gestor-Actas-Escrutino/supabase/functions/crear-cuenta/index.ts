
import { createClient } from "npm:@supabase/supabase-js@2";

type RolCreable = "recinto" | "veedor";

interface SolicitudCrearCuenta {
  cedula: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  email: string;
  rol: RolCreable;
  recintoId?: string;
}

const passwordAlphabet =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";

function randomCharacter(alphabet: string): string {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return alphabet[random[0] % alphabet.length];
}

function crearClaveTemporal(): string {
  const grupos = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%&*",
  ];
  const caracteres = grupos.map(randomCharacter);

  while (caracteres.length < 20) {
    caracteres.push(randomCharacter(passwordAlphabet));
  }

  for (let i = caracteres.length - 1; i > 0; i -= 1) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const j = random[0] % (i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }

  return caracteres.join("");
}

function validarCedula(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) {
    return false;
  }

  const provincia = Number(cedula.slice(0, 2));
  const tercerDigito = Number(cedula[2]);
  if ((provincia < 1 || (provincia > 24 && provincia !== 30)) || tercerDigito > 5) {
    return false;
  }

  const digitos = cedula.split("").map(Number);
  let suma = 0;
  for (let i = 0; i < 9; i += 1) {
    if (i % 2 === 0) {
      const valor = digitos[i] * 2;
      suma += valor > 9 ? valor - 9 : valor;
    } else {
      suma += digitos[i];
    }
  }

  return (10 - (suma % 10)) % 10 === digitos[9];
}

function esSolicitudCrearCuenta(
  valor: unknown,
): valor is SolicitudCrearCuenta {
  if (typeof valor !== "object" || valor === null) {
    return false;
  }

  const body = valor as Record<string, unknown>;
  return (
    typeof body.cedula === "string" &&
    validarCedula(body.cedula) &&
    typeof body.nombres === "string" &&
    body.nombres.trim().length >= 2 &&
    body.nombres.trim().length <= 120 &&
    typeof body.apellidos === "string" &&
    body.apellidos.trim().length >= 2 &&
    body.apellidos.trim().length <= 120 &&
    typeof body.telefono === "string" &&
    /^(09\d{8}|0[2-7]\d{7})$/.test(body.telefono) &&
    typeof body.email === "string" &&
    body.email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) &&
    (body.rol === "recinto" || body.rol === "veedor") &&
    (body.recintoId === undefined ||
      (typeof body.recintoId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          body.recintoId,
        )))
  );
}

function construirRedirectSignup(): string {
  const configuredUrl = Deno.env.get("APP_AUTH_REDIRECT_URL");
  if (!configuredUrl) {
    throw new Error("Missing APP_AUTH_REDIRECT_URL configuration");
  }

  const redirect = new URL(configuredUrl);
  if (
    redirect.protocol !== "controlelectoral:" ||
    redirect.hostname !== "auth" ||
    redirect.pathname !== "/callback" ||
    redirect.search.length > 0 ||
    redirect.hash.length > 0
  ) {
    throw new Error("Invalid APP_AUTH_REDIRECT_URL configuration");
  }

  redirect.searchParams.set("flow", "signup");
  return redirect.toString();
}

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
      const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
        const missingEnvironmentVariables: string[] = [];
        if (!supabaseUrl) {
          missingEnvironmentVariables.push("SUPABASE_URL");
        }
        if (!supabaseAnonKey) {
          missingEnvironmentVariables.push("SUPABASE_ANON_KEY");
        }
        if (!supabaseServiceRoleKey) {
          missingEnvironmentVariables.push("SUPABASE_SERVICE_ROLE_KEY");
        }
        return errorResponse(
          `Faltan variables de entorno requeridas: ${missingEnvironmentVariables.join(", ")}.`,
          500,
        );
      }

      const authorization = request.headers.get("Authorization");
      const token = authorization?.replace(/^Bearer\s+/i, "");
      if (!token) {
        return errorResponse("Se requiere una sesion autenticada.", 401);
      }

      const supabase = createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          global: {
            headers: { Authorization: `Bearer ${token}` },
          },
        },
      );
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser(token);
      if (userError || !user) {
        return errorResponse("Se requiere una sesion autenticada.", 401);
      }

      if (request.method !== "POST") {
        return errorResponse("Metodo no permitido.", 405);
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return errorResponse("El cuerpo de la solicitud no es JSON valido.", 400);
      }

      if (!esSolicitudCrearCuenta(body)) {
        return errorResponse("Los datos de la cuenta no son validos.", 400);
      }

      const { data: caller, error: callerError } = await supabase
        .from("perfiles")
        .select("id, rol, provincia, recinto_id")
        .eq("id", user.id)
        .maybeSingle();

      if (callerError) {
        return errorResponse("No fue posible validar el perfil solicitante.", 500);
      }
      if (!caller) {
        return errorResponse("El usuario no tiene un perfil habilitado.", 403);
      }

      const supabaseAdmin = createClient(
        supabaseUrl,
        supabaseServiceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      );

      async function rollbackCreatedAccount(accountId: string): Promise<boolean> {
        const { error: profileError } = await supabaseAdmin
          .from("perfiles")
          .delete()
          .eq("id", accountId);
        const { error: authError } =
          await supabaseAdmin.auth.admin.deleteUser(accountId);
        return !profileError && !authError;
      }

      let targetRecintoId: string;
      let targetProvince: string;
      if (
        caller.rol === "provincial" &&
        body.rol === "recinto"
      ) {
        if (!body.recintoId) {
          return errorResponse("Debe seleccionar un recinto.", 400);
        }

        const { data: recinto, error: recintoError } = await supabase
          .from("recintos")
          .select("id, provincia")
          .eq("id", body.recintoId)
          .maybeSingle();

        if (recintoError) {
          return errorResponse("No fue posible validar el recinto.", 500);
        }
        if (!recinto) {
          return errorResponse("El recinto seleccionado no existe.", 400);
        }
        if (!caller.provincia || recinto.provincia !== caller.provincia) {
          return errorResponse(
            "El recinto no pertenece a la provincia del coordinador.",
            403,
          );
        }

        targetRecintoId = recinto.id;
        targetProvince = recinto.provincia;
      } else if (
        caller.rol === "recinto" &&
        body.rol === "veedor"
      ) {
        if (!caller.recinto_id) {
          return errorResponse("El coordinador no tiene un recinto asignado.", 403);
        }

        const { data: recinto, error: recintoError } = await supabase
          .from("recintos")
          .select("id, provincia")
          .eq("id", caller.recinto_id)
          .maybeSingle();

        if (recintoError) {
          return errorResponse("No fue posible validar el recinto.", 500);
        }
        if (!recinto) {
          return errorResponse("El recinto del coordinador no existe.", 403);
        }

        targetRecintoId = recinto.id;
        targetProvince = recinto.provincia;
      } else {
        return errorResponse("No tiene autorizacion para crear esta cuenta.", 403);
      }

      let redirectTo: string;
      try {
        redirectTo = construirRedirectSignup();
      } catch {
        return errorResponse("La redireccion de autenticacion no esta configurada.", 500);
      }

      const email = body.email.trim().toLowerCase();
      const temporaryPassword = crearClaveTemporal();
      const { data: created, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: false,
          user_metadata: {
            nombres: body.nombres.trim(),
            apellidos: body.apellidos.trim(),
          },
        });

      if (createError || !created.user) {
        return errorResponse(
          "No fue posible crear la cuenta. Verifique que el correo no este registrado.",
          409,
        );
      }

      const accountId = created.user.id;
      const { error: profileError } = await supabaseAdmin
        .from("perfiles")
        .insert({
          id: accountId,
          cedula: body.cedula,
          nombres: body.nombres.trim(),
          apellidos: body.apellidos.trim(),
          telefono: body.telefono,
          correo: email,
          rol: body.rol,
          provincia: targetProvince,
          recinto_id: targetRecintoId,
          debe_cambiar_clave: true,
        });

      if (profileError) {
        const rolledBack = await rollbackCreatedAccount(accountId);
        if (!rolledBack) {
          return errorResponse(
            "El alta no se completo y requiere revision administrativa antes de reintentar.",
            500,
          );
        }
        return errorResponse(
          "No fue posible guardar el perfil. Verifique la cedula y la asignacion del recinto.",
          409,
        );
      }

      const { error: emailError } = await supabaseAdmin.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (emailError) {
        const rolledBack = await rollbackCreatedAccount(accountId);
        if (!rolledBack) {
          return errorResponse(
            "No fue posible enviar la verificacion y el alta requiere revision administrativa.",
            500,
          );
        }
        return errorResponse(
          "No fue posible enviar el correo de verificacion. No se creo la cuenta.",
          502,
        );
      }

      return Response.json({
        account: {
          id: accountId,
          email,
          rol: body.rol,
          debeCambiarClave: true,
        },
        temporaryPassword,
        verificationEmailSent: true,
      });
    } catch (error) {
      const caughtError =
        error instanceof Error ? error : new Error(String(error));
      const mensaje = caughtError.message;
      console.error("Error interno al crear la cuenta.", {
        name: caughtError.name,
        message: mensaje,
        stack: caughtError.stack,
      });
      return Response.json(
        {
          error: "Error interno al crear la cuenta.",
          detalle: mensaje,
        },
        { status: 500 },
      );
    }
  },
};
