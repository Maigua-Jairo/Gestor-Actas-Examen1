import type { Href } from "expo-router";

import type { RolUsuario } from "@/domain/roles";

/** Pantalla de inicio de cada rol después de iniciar sesión. */
export function rutaInicioPorRol(rol: RolUsuario | null | undefined): Href {
  switch (rol) {
    case "provincial":
      return "/provincial";
    case "recinto":
      return "/recinto";
    case "veedor":
      return "/veedor";
    default:
      // Sin rol reconocido no hay pantalla que mostrar: vuelve al acceso.
      return "/(auth)/login";
  }
}
