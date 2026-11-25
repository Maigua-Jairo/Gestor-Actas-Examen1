import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email("Ingrese un correo electrónico válido.")
  .toLowerCase();

export const inicioSesionSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Ingrese su clave."),
});

export const recuperarClaveSchema = z.object({
  email: emailSchema,
});

export interface ReglaClave {
  id: "longitud" | "mayusculaMinuscula" | "numero";
  descripcion: string;
  cumple: (clave: string) => boolean;
}

/** Reglas de la clave. Las usa la validación y la lista de requisitos en pantalla. */
export const reglasClave: readonly ReglaClave[] = [
  {
    id: "longitud",
    descripcion: "Al menos 8 caracteres",
    cumple: (clave) => clave.length >= 8,
  },
  {
    id: "mayusculaMinuscula",
    descripcion: "Una mayúscula y una minúscula",
    cumple: (clave) => /[A-Z]/.test(clave) && /[a-z]/.test(clave),
  },
  {
    id: "numero",
    descripcion: "Un número",
    cumple: (clave) => /\d/.test(clave),
  },
];

const passwordSchema = z.string().superRefine((clave, context) => {
  const pendiente = reglasClave.find((regla) => !regla.cumple(clave));
  if (pendiente) {
    context.addIssue({
      code: "custom",
      message: `La clave debe tener: ${pendiente.descripcion.toLowerCase()}.`,
    });
  }
});

export const cambiarClaveSchema = z
  .object({
    password: passwordSchema,
    confirmation: z.string().min(1, "Repita la nueva clave."),
  })
  .refine((value) => value.password === value.confirmation, {
    message: "Las dos claves deben coincidir.",
    path: ["confirmation"],
  });
