import { z } from "zod";

export const nuevoRecintoSchema = z.object({
  nombre: z.string().trim().min(2, "Ingrese el nombre del recinto."),
  canton: z.string().trim().min(2, "Ingrese el cantón."),
  parroquia: z.string().trim().min(2, "Ingrese la parroquia."),
});

export type NuevoRecinto = z.infer<typeof nuevoRecintoSchema>;
