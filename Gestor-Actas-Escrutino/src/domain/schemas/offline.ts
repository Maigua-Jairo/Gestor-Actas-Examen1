export type EstadoOperacionOffline =
  | "pendiente"
  | "en_proceso"
  | "guardado"
  | "fallado";

export interface OperacionActaOffline {
  id: string;
  tipo: "guardar_acta";
  payload: string;
  fotoUri: string | null;
  estado: EstadoOperacionOffline;
  intentos: number;
  ultimoError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EncolarActaInput {
  mesaId: string;
  dignidad: "ALCALDIA" | "PREFECTURA";
  actaId: string | null;
  version: number | null;
  totalSufragantes: number;
  votosBlancos: number;
  votosNulos: number;
  votos: {
    candidatoId: string;
    cantidad: number;
  }[];
  latitud: number;
  longitud: number;
  fotoUri: string | null;
  fotoPathExistente: string | null;
}
