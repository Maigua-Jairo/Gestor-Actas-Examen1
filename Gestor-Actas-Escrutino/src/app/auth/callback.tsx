import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";

import { BrandSplash, BrandSplashText } from "@/components/BrandSplash";
import { Button, Notice } from "@/components/ui";
import { authUseCases } from "@/presentation/auth";

type Param = string | string[] | undefined;

function firstParam(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Destino de los enlaces del correo: confirmación de cuenta y recuperación de clave. */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    flow?: Param;
    token_hash?: Param;
    type?: Param;
    code?: Param;
    error_description?: Param;
  }>();
  const started = useRef(false);
  const [error, setError] = useState("");
  const flow = firstParam(params.flow);
  const tokenHash = firstParam(params.token_hash);
  const type = firstParam(params.type);
  const code = firstParam(params.code);
  const errorDescription = firstParam(params.error_description);
  const isRecovery = flow === "recovery" || type === "recovery";

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
        if (errorDescription) {
          // Supabase describe el error en inglés; para la persona basta saber que no sirve.
          throw new Error("El enlace venció o ya se usó. Pida uno nuevo.");
        }
        if (tokenHash && (type === "signup" || type === "recovery")) {
          await authUseCases.confirmarEnlace.execute(tokenHash, type);
        } else if (code) {
          await authUseCases.canjearCodigoEnlace.execute(code);
        } else {
          throw new Error("El enlace está incompleto. Ábralo de nuevo desde el correo.");
        }

        if (isRecovery) {
          router.replace({ pathname: "/(auth)/cambiar-clave", params: { flujo: "recuperacion" } });
        } else {
          await authUseCases.cerrarSesion.execute();
          router.replace("/(auth)/login?confirmado=1");
        }
      } catch (verificationError) {
        setError(
          verificationError instanceof Error
            ? verificationError.message
            : "No fue posible verificar el enlace.",
        );
      }
    })();
  }, [code, errorDescription, isRecovery, tokenHash, type]);

  if (error) {
    return (
      <BrandSplash message={isRecovery ? "No pudimos validar el enlace" : "No pudimos confirmar su correo"}>
        <Notice tone="error">{error}</Notice>
        <BrandSplashText>
          {isRecovery
            ? "Los enlaces de recuperación duran 1 hora y sirven una sola vez."
            : "Si el enlace venció, pida a su coordinador que le reenvíe la verificación."}
        </BrandSplashText>
        {isRecovery ? (
          <Button
            label="Pedir un enlace nuevo"
            onPress={() => router.replace("/(auth)/recuperar-clave")}
          />
        ) : null}
        <Button
          variant={isRecovery ? "ghost" : "primary"}
          label="Ir al inicio de sesión"
          onPress={() => router.replace("/(auth)/login")}
        />
      </BrandSplash>
    );
  }

  return (
    <BrandSplash
      message={isRecovery ? "Validando su enlace de recuperación…" : "Confirmando su correo…"}
    />
  );
}
