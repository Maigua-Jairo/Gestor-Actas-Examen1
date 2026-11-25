import { z } from "zod";

import { validarCedulaEcuatoriana } from "@/domain/cedula";
import { type RolCreable } from "@/domain/roles";

export const cedulaSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$/, "La cédula debe tener 10 dígitos.")
  .refine(
    validarCedulaEcuatoriana,
    "El dígito verificador no coincide. Revise la cédula.",
  );

export const usuarioNuevoSchema = z.object({
  cedula: cedulaSchema,
  nombres: z.string().trim().min(2, "Ingrese los nombres."),
  apellidos: z.string().trim().min(2, "Ingrese los apellidos."),
  telefono: z
    .string()
    .trim()
    .regex(
      /^(09\d{8}|0[2-7]\d{7})$/,
      "Ingrese un celular (09…) o un teléfono fijo ecuatoriano.",
    ),
  email: z
    .string()
    .trim()
    .email("Ingrese un correo electrónico válido.")
    .toLowerCase(),
  rol: z.enum(["recinto", "veedor"]),
  recintoId: z.string().uuid().optional(),
});

export type UsuarioNuevo = z.infer<typeof usuarioNuevoSchema>;

export function crearUsuarioNuevo(
  valores: z.input<typeof usuarioNuevoSchema>,
): UsuarioNuevo {
  return usuarioNuevoSchema.parse(valores);
}

export function esRolCreable(rol: string): rol is RolCreable {
  return rol === "recinto" || rol === "veedor";
}