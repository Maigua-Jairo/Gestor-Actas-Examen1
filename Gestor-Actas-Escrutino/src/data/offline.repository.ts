import * as FileSystem from "expo-file-system/legacy";
import NetInfo from "@react-native-community/netinfo";
import * as Sentry from "@sentry/react-native";

import { getSesionLocal } from "@/data/local-session.storage";
import { OfflineDatabase } from "@/data/offline.database";
import { supabase } from "@/data/supabase";
import { crearUuid } from "@/data/uuid";
import type {
  OfflineQueueRepository,
} from "@/domain/offline.use-cases";
import type {
  EncolarActaInput,
  OperacionActaOffline,
} from "@/domain/schemas/offline";

export class OfflineRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfflineRepositoryError";
  }
}

const LAST_SYNC_KEY = "ultima-sincronizacion";

/** El servidor exige un UUID: es la clave que evita registrar dos veces la misma operación. */
function createOperationId(): string {
  return crearUuid();
}

function decodeBase64(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

interface OfflinePayload {
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
  fotoPathExistente: string | null;
}

export class SQLiteOfflineQueueRepository
  implements OfflineQueueRepository
{
  private syncInProgress = false;

  constructor(private readonly database = new OfflineDatabase()) {}

  async initialize(): Promise<void> {
    await this.database.initialize();
  }

  async enqueue(input: EncolarActaInput): Promise<OperacionActaOffline> {
    await this.database.initialize();
    const owner = await this.currentOwner();
    if (!owner) {
      throw new OfflineRepositoryError("Vuelva a iniciar sesión para guardar el acta.");
    }

    const id = createOperationId();
    const now = new Date().toISOString();
    let photoUri = input.fotoUri;

    if (photoUri && FileSystem.documentDirectory) {
      const directory = `${FileSystem.documentDirectory}offline-actas/`;
      await FileSystem.makeDirectoryAsync(directory, {
        intermediates: true,
      });

      const persistentUri = `${directory}${id}.jpg`;
      await FileSystem.copyAsync({
        from: photoUri,
        to: persistentUri,
      });
      photoUri = persistentUri;
    }

    const operation: OperacionActaOffline = {
      id,
      tipo: "guardar_acta",
      payload: JSON.stringify({
        mesaId: input.mesaId,
        dignidad: input.dignidad,
        actaId: input.actaId,
        version: input.version,
        totalSufragantes: input.totalSufragantes,
        votosBlancos: input.votosBlancos,
        votosNulos: input.votosNulos,
        votos: input.votos,
        latitud: input.latitud,
        longitud: input.longitud,
        fotoPathExistente: input.fotoPathExistente,
      }),
      fotoUri: photoUri,
      estado: "pendiente",
      intentos: 0,
      ultimoError: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.database.insert(operation, owner);
    await this.discardSupersededOperations(operation.id, input);
    return operation;
  }

  /**
   * Una nueva versión de la misma acta (mesa + dignidad) reemplaza a las que
   * aún no se enviaron: así se corrige un acta sin señal y el servidor no
   * recibe dos altas de la misma acta. Las que están "en_proceso" no se tocan.
   */
  private async discardSupersededOperations(
    keepId: string,
    input: EncolarActaInput,
  ): Promise<void> {
    const operations = await this.listAll();
    for (const previous of operations) {
      if (
        previous.id === keepId ||
        (previous.estado !== "pendiente" && previous.estado !== "fallado")
      ) {
        continue;
      }
      let payload: { mesaId?: unknown; dignidad?: unknown };
      try {
        payload = JSON.parse(previous.payload) as typeof payload;
      } catch {
        continue;
      }
      if (payload.mesaId !== input.mesaId || payload.dignidad !== input.dignidad) {
        continue;
      }
      await this.database.deleteOperation(previous.id);
      if (previous.fotoUri) {
        await FileSystem.deleteAsync(previous.fotoUri, { idempotent: true }).catch(
          () => undefined,
        );
      }
    }
  }

  async getLastSync(): Promise<string | null> {
    return (await this.database.getCache(LAST_SYNC_KEY).catch(() => null))?.valor ?? null;
  }

  /**
   * Cuenta dueña de la cola: la sesión guardada en el teléfono (funciona sin
   * señal) o, si no hay, la sesión de Supabase.
   */
  private async currentOwner(): Promise<string | null> {
    const local = await getSesionLocal();
    const userId = local?.userId ?? (await supabase.auth.getSession()).data.session?.user.id;
    if (!userId) {
      return null;
    }
    if (local?.perfil.rol === "veedor") {
      await this.database.adoptOrphanOperations(userId);
    }
    return userId;
  }

  async listPending(): Promise<OperacionActaOffline[]> {
    const owner = await this.currentOwner();
    return owner ? this.database.listPending(owner) : [];
  }

  async listAll(): Promise<OperacionActaOffline[]> {
    const owner = await this.currentOwner();
    return owner ? this.database.listAll(owner) : [];
  }

  /**
   * Elimina del teléfono un acta que aún no se envió (y su foto). No toca las
   * que se están enviando ni las ya confirmadas por el servidor.
   */
  async discard(id: string): Promise<void> {
    const owner = await this.currentOwner();
    const operation = owner ? await this.database.findOperation(id, owner) : null;
    if (!operation) {
      throw new OfflineRepositoryError("Esa acta ya no está en este teléfono.");
    }
    if (operation.estado === "en_proceso") {
      throw new OfflineRepositoryError("El acta se está enviando. Espere a que termine.");
    }
    if (operation.estado === "guardado") {
      throw new OfflineRepositoryError("El acta ya llegó al servidor; no se puede descartar.");
    }
    await this.database.deleteOperation(operation.id);
    if (operation.fotoUri) {
      await FileSystem.deleteAsync(operation.fotoUri, { idempotent: true }).catch(() => undefined);
    }
  }

  async markProcessing(id: string): Promise<void> {
    await this.database.updateState(id, "en_proceso");
  }

  async markSaved(id: string): Promise<void> {
    await this.database.updateState(id, "guardado");
  }

  async markFailed(id: string, message: string): Promise<void> {
    await this.database.updateState(id, "fallado", message);
  }

  async syncPending(): Promise<number> {
    if (this.syncInProgress) {
      return 0;
    }

    this.syncInProgress = true;
    let synchronized = 0;

    try {
      await this.database.initialize();
      const network = await NetInfo.fetch();

      if (!network.isConnected || !network.isInternetReachable) {
        return 0;
      }

      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        return 0;
      }

      // Solo se envían las actas de la cuenta con sesión abierta: las de otra
      // cuenta en el mismo teléfono las rechazaría el servidor (RLS).
      const owner = await this.currentOwner();
      if (!owner) {
        return 0;
      }
      const operations = await this.database.listPending(owner);

      for (const operation of operations) {
        await this.database.updateState(operation.id, "en_proceso");

        let payload: OfflinePayload;
        try {
          payload = JSON.parse(operation.payload) as OfflinePayload;
        } catch {
          await this.database.updateState(
            operation.id,
            "fallado",
            "No fue posible leer los datos locales de la operación.",
          );
          continue;
        }

        let evidencePath = payload.fotoPathExistente;
        let uploadedEvidencePath: string | null = null;

        try {
          if (operation.fotoUri) {
            const photoInfo = await FileSystem.getInfoAsync(
              operation.fotoUri,
            );
            if (!photoInfo.exists) {
              throw new OfflineRepositoryError(
                "La fotografía local ya no existe.",
              );
            }

            const base64 = await FileSystem.readAsStringAsync(
              operation.fotoUri,
              { encoding: FileSystem.EncodingType.Base64 },
            );
            const suffix = `${Date.now().toString(36)}-${Math.random()
              .toString(36)
              .slice(2, 10)}.jpg`;
            const filePath = `${payload.mesaId}/${suffix}`;

            const { error: uploadError } = await supabase.storage
              .from("evidencias-actas")
              .upload(filePath, decodeBase64(base64), {
                contentType: "image/jpeg",
                upsert: false,
              });

            if (uploadError) {
              throw new OfflineRepositoryError(
                uploadError.message ||
                  "No fue posible subir la fotografía pendiente.",
              );
            }

            evidencePath = filePath;
            uploadedEvidencePath = filePath;
          }

          if (!evidencePath) {
            throw new OfflineRepositoryError(
              "La operación no tiene una fotografía asociada.",
            );
          }

          const { data, error } = await supabase.rpc(
            "guardar_acta_offline",
            {
              p_operation_id: operation.id,
              p_id: payload.actaId,
              p_mesa_id: payload.mesaId,
              p_dignidad: payload.dignidad,
              p_total_sufragantes: payload.totalSufragantes,
              p_votos_blancos: payload.votosBlancos,
              p_votos_nulos: payload.votosNulos,
              p_foto_path: evidencePath,
              p_latitud: payload.latitud,
              p_longitud: payload.longitud,
              p_votos: payload.votos.map((vote) => ({
                candidato_id: vote.candidatoId,
                cantidad: vote.cantidad,
              })),
              p_version_esperada: payload.version,
            },
          );

          if (error) {
            throw new OfflineRepositoryError(
              error.message || "No fue posible sincronizar el acta.",
            );
          }
          if (!Array.isArray(data) || data.length !== 1) {
            throw new OfflineRepositoryError(
              "El servidor no confirmó la operación offline.",
            );
          }

          await this.database.updateState(operation.id, "guardado");
          synchronized += 1;

          if (operation.fotoUri) {
            await FileSystem.deleteAsync(operation.fotoUri, {
              idempotent: true,
            });
          }
        } catch (syncError) {
          Sentry.captureException(syncError, {
            tags: {
              feature: "offline_sync",
              operation_id: operation.id,
            },
          });
          if (uploadedEvidencePath) {
            await supabase.storage
              .from("evidencias-actas")
              .remove([uploadedEvidencePath]);
          }

          const message =
            syncError instanceof Error
              ? syncError.message
              : "No fue posible sincronizar el acta.";
          await this.database.updateState(
            operation.id,
            "fallado",
            message,
          );
        }
      }

      // Hubo señal y sesión: la cola se revisó contra el servidor.
      await this.database
        .setCache(LAST_SYNC_KEY, new Date().toISOString())
        .catch(() => undefined);
      return synchronized;
    } finally {
      this.syncInProgress = false;
    }
  }
}
