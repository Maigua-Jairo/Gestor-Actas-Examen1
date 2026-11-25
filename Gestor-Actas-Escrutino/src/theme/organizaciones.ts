/**
 * Paletas de marca por organización política (RNF-06). Solo cambian los
 * colores de identidad: los colores de estado (guardado, pendiente, error)
 * son comunes a todas para que su significado no cambie.
 *
 * La organización se elige al compilar con EXPO_PUBLIC_ORGANIZACION
 * (por ejemplo ORG-02). Si no se define, se usa ORG-01.
 */
export interface PaletaOrganizacion {
  nombre: string;
  /** Color principal: botones, enlaces, barras de progreso. */
  primary: string;
  primaryPressed: string;
  /** Tono más oscuro del degradado de cabeceras y tarjetas destacadas. */
  institutional: string;
  /** Tono más claro del degradado. */
  accent: string;
  /** Títulos y textos destacados sobre fondo claro. */
  navy: string;
  navyDeep: string;
  /** Fondo general de la app y su degradado. */
  background: string;
  gradientStart: string;
  gradientEnd: string;
  /** Superficies y bordes teñidos con la marca. */
  surfaceMuted: string;
  borderSoftBlue: string;
  infoText: string;
  /** Serie de colores para gráficos (de más oscuro a más claro). */
  chart: readonly [string, string, string, string, string, string];
}

const ORG_01: PaletaOrganizacion = {
  nombre: "Azul institucional",
  primary: "#1F5FBF",
  primaryPressed: "#1A52A5",
  institutional: "#034EA2",
  accent: "#0A62C4",
  navy: "#0F1B2D",
  navyDeep: "#0B2B5E",
  background: "#F4F8FD",
  gradientStart: "#F4F8FD",
  gradientEnd: "#FFFFFF",
  surfaceMuted: "#E1EBFA",
  borderSoftBlue: "#C9D4E2",
  infoText: "#0B2B5E",
  chart: ["#0B2B5E", "#1F5FBF", "#0A62C4", "#7FA7DC", "#B9CCE8", "#DCE6F4"],
};

const ORG_02: PaletaOrganizacion = {
  nombre: "Violeta",
  primary: "#6D28D9",
  primaryPressed: "#5B21B6",
  institutional: "#4C1D95",
  accent: "#7C3AED",
  navy: "#1E1033",
  navyDeep: "#2E1065",
  background: "#F7F5FD",
  gradientStart: "#F7F5FD",
  gradientEnd: "#FFFFFF",
  surfaceMuted: "#EDE7FB",
  borderSoftBlue: "#D6CCF0",
  infoText: "#2E1065",
  chart: ["#2E1065", "#6D28D9", "#7C3AED", "#A78BFA", "#C4B5FD", "#E4DCFD"],
};

const ORG_03: PaletaOrganizacion = {
  nombre: "Turquesa",
  primary: "#0F766E",
  primaryPressed: "#115E59",
  institutional: "#134E4A",
  accent: "#0D9488",
  navy: "#0B1F1D",
  navyDeep: "#134E4A",
  background: "#F2FAF9",
  gradientStart: "#F2FAF9",
  gradientEnd: "#FFFFFF",
  surfaceMuted: "#DDF3F0",
  borderSoftBlue: "#BFE3DE",
  infoText: "#134E4A",
  chart: ["#134E4A", "#0F766E", "#0D9488", "#5EBDB3", "#A7DCD5", "#D5EFEB"],
};

export const paletas = {
  "ORG-01": ORG_01,
  "ORG-02": ORG_02,
  "ORG-03": ORG_03,
} as const;

export type CodigoOrganizacion = keyof typeof paletas;

declare const process: { env: Record<string, string | undefined> };

function esCodigo(valor: string | undefined): valor is CodigoOrganizacion {
  return valor !== undefined && valor in paletas;
}

const configurada = process.env.EXPO_PUBLIC_ORGANIZACION;

export const organizacionActiva: CodigoOrganizacion = esCodigo(configurada)
  ? configurada
  : "ORG-01";

export const paletaActiva: PaletaOrganizacion = paletas[organizacionActiva];
