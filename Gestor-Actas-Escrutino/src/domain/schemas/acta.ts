import { z } from "zod";

const maxVoteCount = 2_147_483_647;

const nonNegativeIntegerInput = z
  .union([z.string(), z.number()])
  .transform((value, context) => {
    if (typeof value === "string" && !/^\d+$/.test(value.trim())) {
      context.addIssue({
        code: "custom",
        message: "Ingresa un número entero no negativo.",
      });
      return z.NEVER;
    }

    const number = typeof value === "string" ? Number(value) : value;
    if (
      !Number.isSafeInteger(number) ||
      number < 0 ||
      number > maxVoteCount
    ) {
      context.addIssue({
        code: "custom",
        message: "El valor supera el límite permitido.",
      });
      return z.NEVER;
    }

    return number;
  });

export const dignidadesActa = ["ALCALDIA", "PREFECTURA"] as const;
export type DignidadActa = (typeof dignidadesActa)[number];

export const actaFormSchema = z
  .object({
    totalSufragantes: nonNegativeIntegerInput,
    votosBlancos: nonNegativeIntegerInput,
    votosNulos: nonNegativeIntegerInput,
    votos: z.array(
      z.object({
        candidatoId: z.uuid(),
        cantidad: nonNegativeIntegerInput,
      }),
    ),
  })
  .superRefine((acta, context) => {
    if (acta.votos.length === 0) {
      context.addIssue({
        code: "custom",
        message: "No hay candidatos activos para esta dignidad.",
        path: ["votos"],
      });
    }

    const candidateIds = new Set<string>();
    acta.votos.forEach((voto, index) => {
      if (candidateIds.has(voto.candidatoId)) {
        context.addIssue({
          code: "custom",
          message: "Un candidato aparece más de una vez.",
          path: ["votos", index, "candidatoId"],
        });
      }
      candidateIds.add(voto.candidatoId);

      if (voto.cantidad > acta.totalSufragantes) {
        context.addIssue({
          code: "custom",
          message: "Los votos del candidato superan los sufragantes.",
          path: ["votos", index, "cantidad"],
        });
      }
    });

    const sumaVotos =
      acta.votos.reduce((total, voto) => total + voto.cantidad, 0) +
      acta.votosBlancos +
      acta.votosNulos;

    if (sumaVotos !== acta.totalSufragantes) {
      context.addIssue({
        code: "custom",
        message:
          "La suma de votos por candidato, blancos y nulos debe coincidir con los sufragantes.",
        path: ["totalSufragantes"],
      });
    }
  });

export type ActaFormInput = z.input<typeof actaFormSchema>;
export type ActaFormValues = z.output<typeof actaFormSchema>;

export interface CandidatoActa {
  id: string;
  nombres: string;
  apellidos: string;
  dignidad: DignidadActa;
  organizacionId: string;
  organizacionNombre: string;
  organizacionSiglas: string | null;
  organizacionOrden: number;
}

export interface VotoCandidatoActa {
  candidatoId: string;
  cantidad: number;
}

export interface ActaRegistrada {
  id: string;
  dignidad: DignidadActa;
  totalSufragantes: number;
  votosBlancos: number;
  votosNulos: number;
  fotoPath: string;
  latitud: number;
  longitud: number;
  version: number;
  actualizadaEn: string;
  votos: VotoCandidatoActa[];
}

export interface MesaActa {
  id: string;
  numeroJrv: number;
  genero: string;
  recintoLatitud: number | null;
  recintoLongitud: number | null;
  actas: ActaRegistrada[];
}

export interface EspacioActas {
  mesas: MesaActa[];
  candidatos: CandidatoActa[];
  /**
   * null si los datos vienen del servidor. Si vienen de la copia del
   * teléfono (sin conexión), fecha ISO de cuándo se guardó esa copia.
   */
  guardadoEn?: string | null;
}

export interface UbicacionActa {
  latitud: number;
  longitud: number;
}