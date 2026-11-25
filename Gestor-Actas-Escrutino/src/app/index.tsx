import { useEffect, useState } from "react";
import { router } from "expo-router";

import { BrandSplash } from "@/components/BrandSplash";
import { Button, Notice } from "@/components/ui";
import { authUseCases } from "@/presentation/auth";
import { rutaInicioPorRol } from "@/presentation/navigation";

/** Arranque: decide a qué pantalla va la persona según su sesión y su rol. */
export default function IndexScreen() {
  const [startupError, setStartupError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const user = await authUseCases.obtenerSesion.execute();
        if (!active) return;
        if (!user) {
          router.replace("/(auth)/login");
        } else if (user.debeCambiarClave) {
          router.replace("/(auth)/cambiar-clave");
        } else {
          const profile = await authUseCases.obtenerPerfil.execute(user.id);
          router.replace(rutaInicioPorRol(profile?.rol));
        }
      } catch (error) {
        if (active) {
          setStartupError(
            error instanceof Error
              ? error.message
              : "No fue posible verificar la sesión. Compruebe su conexión e inténtelo nuevamente.",
          );
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [retry]);

  if (startupError) {
    return (
      <BrandSplash message="No pudimos abrir su sesión">
        <Notice tone="error">{startupError}</Notice>
        <Button
          label="Reintentar"
          onPress={() => {
            setStartupError("");
            setRetry((value) => value + 1);
          }}
        />
        <Button
          variant="ghost"
          label="Ir al inicio de sesión"
          onPress={() => router.replace("/(auth)/login")}
        />
      </BrandSplash>
    );
  }

  return <BrandSplash message="Preparando su espacio…" />;
}
