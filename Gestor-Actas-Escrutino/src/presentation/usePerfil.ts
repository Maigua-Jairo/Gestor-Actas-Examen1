import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect } from "expo-router";

import type { PerfilUsuario } from "@/data/auth.repository";
import type { RolUsuario } from "@/domain/roles";
import { authUseCases } from "@/presentation/auth";
import { rutaInicioPorRol } from "@/presentation/navigation";
import { offlineUseCases } from "@/presentation/offline";

/**
 * Datos comunes de la pantalla de perfil de cualquier rol: sesión, perfil,
 * estado de la cola del teléfono y cierre de sesión.
 */
export function usePerfil(rolEsperado: RolUsuario) {
  const [profile, setProfile] = useState<PerfilUsuario | null>(null);
  const [error, setError] = useState("");
  const [queueCount, setQueueCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

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
        if (current?.rol !== rolEsperado) {
          router.replace(rutaInicioPorRol(current?.rol));
          return;
        }
        if (active) setProfile(current);
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "No fue posible cargar el perfil.",
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [rolEsperado]);

  // El estado de envíos cambia mientras la persona usa otras pestañas.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([
        offlineUseCases.consultarOperaciones.execute(),
        offlineUseCases.ultimaSincronizacion.execute(),
      ])
        .then(([operations, sync]) => {
          if (!active) return;
          setQueueCount(operations.filter((op) => op.estado !== "guardado").length);
          setLastSync(sync);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, []),
  );

  const signOut = useCallback(async () => {
    setSigningOut(true);
    setError("");
    try {
      await authUseCases.cerrarSesion.execute();
      router.replace("/(auth)/login");
    } catch (signOutError) {
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : "No fue posible cerrar la sesión.",
      );
      setSigningOut(false);
    }
  }, []);

  return { profile, error, queueCount, lastSync, signingOut, signOut };
}
