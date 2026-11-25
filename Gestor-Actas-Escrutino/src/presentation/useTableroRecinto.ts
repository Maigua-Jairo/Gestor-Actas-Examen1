import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { useNetInfo } from "@react-native-community/netinfo";

import type { PerfilUsuario } from "@/data/auth.repository";
import type { TableroRecinto } from "@/domain/recinto.use-cases";
import { authUseCases } from "@/presentation/auth";
import { rutaInicioPorRol } from "@/presentation/navigation";
import { recintoUseCases } from "@/presentation/recinto";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "No fue posible cargar el recinto.";
}

/**
 * Sesión del coordinador de recinto y tablero de su recinto. Recarga al
 * volver a la pantalla y al recuperar la señal.
 */
export function useTableroRecinto() {
  const { isConnected, isInternetReachable } = useNetInfo();
  const online = isConnected === true && isInternetReachable !== false;

  const [profile, setProfile] = useState<PerfilUsuario | null>(null);
  const [tablero, setTablero] = useState<TableroRecinto | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const wasOnline = useRef<boolean | null>(null);

  const load = useCallback(async (recintoId: string) => {
    try {
      setTablero(await recintoUseCases.obtenerTablero.execute(recintoId));
      setError("");
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const user = await authUseCases.obtenerSesion.execute();
        if (!user) {
          router.replace("/(auth)/login");
          return;
        }
        if (user.debeCambiarClave) {
          router.replace("/(auth)/cambiar-clave");
          return;
        }
        const current = await authUseCases.obtenerPerfil.execute(user.id);
        if (current?.rol !== "recinto") {
          router.replace(rutaInicioPorRol(current?.rol));
          return;
        }
        if (!current.recintoId) {
          throw new Error("Su cuenta no tiene un recinto asignado. Avise al coordinador provincial.");
        }
        if (active) setProfile(current);
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (profile?.recintoId) void load(profile.recintoId);
    }, [profile, load]),
  );

  useEffect(() => {
    const previous = wasOnline.current;
    wasOnline.current = online;
    if (online && previous === false && profile?.recintoId) {
      void load(profile.recintoId);
    }
  }, [online, profile, load]);

  const reload = useCallback(async () => {
    if (profile?.recintoId) await load(profile.recintoId);
  }, [profile, load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  return {
    profile,
    tablero,
    error,
    loading: !tablero && !error,
    refreshing,
    refresh,
    reload,
  };
}
