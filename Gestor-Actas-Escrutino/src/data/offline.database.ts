import * as SQLite from "expo-sqlite";

import { crearUuid, esUuid } from "@/data/uuid";
import type {
  EstadoOperacionOffline,
  OperacionActaOffline,
} from "@/domain/schemas/offline";

const databaseName = "gestor-actas-escrutino.db";
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initializePromise: Promise<void> | null = null;

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(databaseName);
  }
  return databasePromise;
}

async function createSchema(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS operaciones_offline (
      id TEXT PRIMARY KEY NOT NULL,
      tipo TEXT NOT NULL,
      payload TEXT NOT NULL,
      foto_uri TEXT,
      estado TEXT NOT NULL
        CHECK (estado IN ('pendiente', 'en_proceso', 'guardado', 'fallado')),
      intentos INTEGER NOT NULL DEFAULT 0,
      ultimo_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS operaciones_offline_estado_idx
      ON operaciones_offline (estado, created_at);
    CREATE TABLE IF NOT EXISTS cache_local (
      clave TEXT PRIMARY KEY NOT NULL,
      valor TEXT NOT NULL,
      actualizado_en TEXT NOT NULL
    );
  `);
  // Migración: cada operación guarda la cuenta que la creó, para que una
  // cuenta no vea ni envíe las actas de otra en el mismo teléfono.
  const columns = await database.getAllAsync<{ name: string }>(
    `PRAGMA table_info(operaciones_offline)`,
  );
  if (!columns.some((column) => column.name === "usuario_id")) {
    await database.execAsync(`ALTER TABLE operaciones_offline ADD COLUMN usuario_id TEXT`);
  }

  // Una operación "en_proceso" al arrancar quedó a medias porque la app se
  // cerró durante el envío. Vuelve a la cola; el UUID evita duplicados.
  await database.runAsync(
    `UPDATE operaciones_offline
     SET estado = 'pendiente', updated_at = $now
     WHERE estado = 'en_proceso'`,
    { $now: new Date().toISOString() },
  );
  await repairInvalidOperationIds(database);
}

/**
 * Versiones anteriores generaban identificadores como "offline-123-abc"
 * cuando el motor no tenía crypto.randomUUID (Hermes). El servidor exige un
 * UUID y rechazaba esas actas. El servidor nunca registró esas operaciones,
 * así que es seguro darles un UUID nuevo y volver a encolarlas.
 */
async function repairInvalidOperationIds(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const rows = await database.getAllAsync<{ id: string }>(
    `SELECT id FROM operaciones_offline WHERE estado <> 'guardado'`,
  );
  for (const row of rows) {
    if (esUuid(row.id)) continue;
    await database.runAsync(
      `UPDATE operaciones_offline
       SET id = $nuevo, estado = 'pendiente', ultimo_error = NULL, updated_at = $now
       WHERE id = $anterior`,
      { $nuevo: crearUuid(), $anterior: row.id, $now: new Date().toISOString() },
    );
  }
}

interface OfflineRow {
  id: string;
  tipo: string;
  payload: string;
  foto_uri: string | null;
  estado: EstadoOperacionOffline;
  intentos: number;
  ultimo_error: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: OfflineRow): OperacionActaOffline {
  return {
    id: row.id,
    tipo: "guardar_acta",
    payload: row.payload,
    fotoUri: row.foto_uri,
    estado: row.estado,
    intentos: row.intentos,
    ultimoError: row.ultimo_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface EntradaCache {
  valor: string;
  actualizadoEn: string;
}

export class OfflineDatabase {
  /** Crea las tablas una sola vez por ejecución de la app. */
  initialize(): Promise<void> {
    if (!initializePromise) {
      initializePromise = createSchema().catch((error: unknown) => {
        initializePromise = null;
        throw error;
      });
    }
    return initializePromise;
  }

  async insert(operation: OperacionActaOffline, usuarioId: string): Promise<void> {
    await this.initialize();
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO operaciones_offline (
        id, tipo, payload, foto_uri, estado, intentos,
        ultimo_error, created_at, updated_at, usuario_id
      ) VALUES (
        $id, $tipo, $payload, $fotoUri, $estado, $intentos,
        $ultimoError, $createdAt, $updatedAt, $usuarioId
      )`,
      {
        $usuarioId: usuarioId,
        $id: operation.id,
        $tipo: operation.tipo,
        $payload: operation.payload,
        $fotoUri: operation.fotoUri,
        $estado: operation.estado,
        $intentos: operation.intentos,
        $ultimoError: operation.ultimoError,
        $createdAt: operation.createdAt,
        $updatedAt: operation.updatedAt,
      },
    );
  }

  /** Operaciones de una cuenta (todas sus actas encoladas, enviadas o no). */
  async listAll(usuarioId: string): Promise<OperacionActaOffline[]> {
    await this.initialize();
    const database = await getDatabase();
    const rows = await database.getAllAsync<OfflineRow>(
      `SELECT id, tipo, payload, foto_uri, estado, intentos,
              ultimo_error, created_at, updated_at
       FROM operaciones_offline
       WHERE usuario_id = $usuarioId
       ORDER BY created_at ASC`,
      { $usuarioId: usuarioId },
    );
    return rows.map(mapRow);
  }

  /** Operaciones de una cuenta que aún deben enviarse. */
  async listPending(usuarioId: string): Promise<OperacionActaOffline[]> {
    await this.initialize();
    const database = await getDatabase();
    const rows = await database.getAllAsync<OfflineRow>(
      `SELECT id, tipo, payload, foto_uri, estado, intentos,
              ultimo_error, created_at, updated_at
       FROM operaciones_offline
       WHERE estado IN ('pendiente', 'fallado') AND usuario_id = $usuarioId
       ORDER BY created_at ASC`,
      { $usuarioId: usuarioId },
    );
    return rows.map(mapRow);
  }

  /**
   * Las operaciones creadas antes de guardar la cuenta no tienen dueño. Solo
   * los veedores crean actas nuevas, así que las adopta el veedor que ingresa.
   */
  async adoptOrphanOperations(usuarioId: string): Promise<void> {
    await this.initialize();
    const database = await getDatabase();
    await database.runAsync(
      `UPDATE operaciones_offline SET usuario_id = $usuarioId WHERE usuario_id IS NULL`,
      { $usuarioId: usuarioId },
    );
  }

  async findOperation(id: string, usuarioId: string): Promise<OperacionActaOffline | null> {
    await this.initialize();
    const database = await getDatabase();
    const row = await database.getFirstAsync<OfflineRow>(
      `SELECT id, tipo, payload, foto_uri, estado, intentos,
              ultimo_error, created_at, updated_at
       FROM operaciones_offline
       WHERE id = $id AND usuario_id = $usuarioId`,
      { $id: id, $usuarioId: usuarioId },
    );
    return row ? mapRow(row) : null;
  }

  async updateState(
    id: string,
    estado: EstadoOperacionOffline,
    message: string | null = null,
  ): Promise<void> {
    await this.initialize();
    const database = await getDatabase();
    await database.runAsync(
      `UPDATE operaciones_offline
       SET estado = $estado,
           intentos = intentos + $increment,
           ultimo_error = $ultimoError,
           updated_at = $updatedAt
       WHERE id = $id`,
      {
        $estado: estado,
        $increment: estado === "en_proceso" ? 1 : 0,
        $ultimoError: message,
        $updatedAt: new Date().toISOString(),
        $id: id,
      },
    );
  }

  async deleteOperation(id: string): Promise<void> {
    await this.initialize();
    const database = await getDatabase();
    await database.runAsync(`DELETE FROM operaciones_offline WHERE id = $id`, {
      $id: id,
    });
  }

  async getCache(clave: string): Promise<EntradaCache | null> {
    await this.initialize();
    const database = await getDatabase();
    const row = await database.getFirstAsync<{
      valor: string;
      actualizado_en: string;
    }>(`SELECT valor, actualizado_en FROM cache_local WHERE clave = $clave`, {
      $clave: clave,
    });
    return row ? { valor: row.valor, actualizadoEn: row.actualizado_en } : null;
  }

  async setCache(clave: string, valor: string): Promise<void> {
    await this.initialize();
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO cache_local (clave, valor, actualizado_en)
       VALUES ($clave, $valor, $ahora)
       ON CONFLICT(clave) DO UPDATE SET
         valor = excluded.valor,
         actualizado_en = excluded.actualizado_en`,
      { $clave: clave, $valor: valor, $ahora: new Date().toISOString() },
    );
  }

  /** Borra las copias locales (al cerrar sesión). No toca la cola de actas. */
  async clearCache(): Promise<void> {
    await this.initialize();
    const database = await getDatabase();
    await database.runAsync(`DELETE FROM cache_local`);
  }
}
