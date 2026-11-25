// Única fuente de verdad de los colores de la app.
// Marca: viene de la organización activa (theme/organizaciones.ts).
// Neutros y estados: comunes a todas las organizaciones.

import { paletaActiva } from "./organizaciones";

const neutros = {
  paper: "#FFFFFF",
  neutralBackground: "#F4F4F5",
  border: "#E4E4E7",
  borderStrong: "#CBD5E1",
  text: "#18181B",
  textMuted: "#52525B",
  textAuxiliary: "#5A6B82",
  onPrimary: "#FFFFFF",
  ripple: "rgba(0,0,0,0.1)",
} as const;

/** Estados de las actas y avisos: no cambian con la organización. */
const estados = {
  syncOkBg: "#DCFCE7",
  syncOkBorder: "#86EFAC",
  syncOkText: "#166534",
  syncPendingBg: "#FEF3C7",
  syncPendingBorder: "#FCD34D",
  syncPendingText: "#92400E",
  syncErrorBg: "#FEE2E2",
  syncErrorBorder: "#FCA5A5",
  syncErrorText: "#991B1B",
  successText: "#166534",
  errorText: "#991B1B",
  /** Esquinas guía de la cámara. */
  cameraGuide: "#4ADE80",
} as const;

/** Franja tricolor de la bandera del Ecuador. */
const bandera = {
  flagYellow: "#FFD100",
  flagRed: "#EF3340",
} as const;

export const colors = {
  ...neutros,
  ...estados,
  ...bandera,
  primary: paletaActiva.primary,
  primaryPressed: paletaActiva.primaryPressed,
  institutional: paletaActiva.institutional,
  accent: paletaActiva.accent,
  navy: paletaActiva.navy,
  navyDeep: paletaActiva.navyDeep,
  background: paletaActiva.background,
  gradientStart: paletaActiva.gradientStart,
  gradientEnd: paletaActiva.gradientEnd,
  surfaceMuted: paletaActiva.surfaceMuted,
  borderSoftBlue: paletaActiva.borderSoftBlue,
  infoText: paletaActiva.infoText,
  chart: paletaActiva.chart,
} as const;
