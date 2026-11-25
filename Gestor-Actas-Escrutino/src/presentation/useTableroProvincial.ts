import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { useNetInfo } from "@react-native-community/netinfo";

import type { PerfilUsuario } from "@/data/auth.repository";
import type { TableroProvincial } from "@/domain/schemas/seguimiento";
import { authUseCases } from "@/presentation/auth";
import { rutaInicioPorRol } from "@/presentation/navigation";
import { seguimientoUseCases } from "@/presentation/seguimiento";

/** Varios eventos seguidos (un acta y sus votos) generan una sola recarga. */
const REALTIME_DEBOUNCE_MS = 800;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "No fue posible cargar el seguimiento.";
}

/**
 * Sesión del coordinador provincial y tablero de su provincia, actualizado en
 * vivo con Supabase Realtime mientras la pantalla está visible (RF-15).
 */
export function useTableroProvincial() {
  const { isConnected, isInternetReachable } = useNetInfo();
  const online = isConnected === true && isInternetReachable !== false;

  const [profile, setProfile] = useState<PerfilUsuario | null>(null);
  const [tablero, setTablero] = useState<TableroProvincial | null>(null);
  const [actualizadoEn, setActualizadoEn] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const wasOnline = useRef<boolean | null>(null);

  const load = useCallback(async (provincia: string) => {
    try {
      const data = await seguimientoUseCases.obtenerTablero.execute(provincia);
      setTablero(data);
      setActualizadoEn(data.guardadoEn ?? new Date().toISOString());
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
        if (current?.rol !== "provincial") {
          router.replace(rutaInicioPorRol(current?.rol));
          return;
        }
        if (!current.provincia) {
          throw new Error("Su perfil no tiene provincia asignada. Contacte al administrador.");
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

  // Carga al mostrarse y suscripción en vivo solo mientras la pantalla está visible.
  useFocusEffect(
    useCallback(() => {
      const provincia = profile?.provincia;
      if (!provincia) return undefined;
      void load(provincia);
      let timer: ReturnType<typeof setTimeout> | null = null;
      const unsubscribe = seguimientoUseCases.suscribirCambios.execute(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void load(provincia), REALTIME_DEBOUNCE_MS);
      });
      return () => {
        if (timer) clearTimeout(timer);
        unsubscribe();
      };
    }, [profile, load]),
  );

  useEffect(() => {
    const previous = wasOnline.current;
    wasOnline.current = online;
    if (online && previous === false && profile?.provincia) {
      void load(profile.provincia);
    }
  }, [online, profile, load]);

  const reload = useCallback(async () => {
    if (profile?.provincia) await load(profile.provincia);
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
    actualizadoEn,
    error,
    loading: !tablero && !error,
    refreshing,
    refresh,
    reload,
  };
}
