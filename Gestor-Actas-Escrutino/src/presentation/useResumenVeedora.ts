import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { useNetInfo } from "@react-native-community/netinfo";

import type { PerfilUsuario } from "@/data/auth.repository";
import type { ResumenVeedora } from "@/domain/veedor.use-cases";
import { authUseCases } from "@/presentation/auth";
import { rutaInicioPorRol } from "@/presentation/navigation";
import { veedorUseCases } from "@/presentation/veedor";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "No fue posible cargar sus mesas.";
}

/**
 * Sesión del veedor y resumen de sus mesas. Recarga al volver a la pantalla
 * y, al recuperar la señal, envía la cola antes de recargar.
 */
export function useResumenVeedora() {
  const { isConnected, isInternetReachable } = useNetInfo();
  const online = isConnected === true && isInternetReachable !== false;

  const [profile, setProfile] = useState<PerfilUsuario | null>(null);
  const [summary, setSummary] = useState<ResumenVeedora | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const wasOnline = useRef<boolean | null>(null);

  const loadSummary = useCallback(async (recintoId: string | null) => {
    try {
      setSummary(await veedorUseCases.obtenerResumen.execute(recintoId));
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
        if (current?.rol !== "veedor") {
          router.replace(rutaInicioPorRol(current?.rol));
          return;
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
      if (profile) void loadSummary(profile.recintoId);
    }, [profile, loadSummary]),
  );

  useEffect(() => {
    const previous = wasOnline.current;
    wasOnline.current = online;
    if (online && previous === false && profile) {
      void veedorUseCases.sincronizarPendientes
        .execute()
        .catch(() => undefined)
        .finally(() => void loadSummary(profile.recintoId));
    }
  }, [online, profile, loadSummary]);

  const refresh = useCallback(async () => {
    if (!profile) return;
    setRefreshing(true);
    try {
      if (online) {
        await veedorUseCases.sincronizarPendientes.execute().catch(() => undefined);
      }
      await loadSummary(profile.recintoId);
    } finally {
      setRefreshing(false);
    }
  }, [profile, online, loadSummary]);

  const retry = useCallback(() => {
    setError("");
    if (profile) void loadSummary(profile.recintoId);
  }, [profile, loadSummary]);

  return {
    profile,
    summary,
    error,
    loading: !summary && !error,
    refreshing,
    refresh,
    retry,
  };
}
