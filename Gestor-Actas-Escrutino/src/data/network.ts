import NetInfo from "@react-native-community/netinfo";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";

/** Error que indica que la operación no se completó por falta de red. */
export class SinConexionError extends Error {
  constructor(message = "No hay conexión a internet.") {
    super(message);
    this.name = "SinConexionError";
  }
}

/**
 * true solo cuando NetInfo confirma que no hay red. Si aún no lo sabe (null),
 * se intenta la operación normalmente.
 */
export async function sinConexion(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === false || state.isInternetReachable === false;
}

/** Reconoce los errores de red de fetch, Supabase Auth y PostgREST. */
export function esErrorDeRed(error: unknown): boolean {
  if (error instanceof SinConexionError || isAuthRetryableFetchError(error)) {
    return true;
  }
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  return /network request failed|failed to fetch|network ?error|timed? ?out|aborted/i.test(
    message,
  );
}
