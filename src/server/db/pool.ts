import { Pool, type PoolClient } from "pg";
import { loadConfig, requireDatabaseUrl } from "../config/env";
import { ConflictError, DatabaseUnavailableError } from "../errors";
import { logger } from "../logger";

/** Anything that can run queries: the shared Pool, or a client inside a transaction. */
export type Db = Pick<Pool, "query">;
export type TxRunner = Pick<Pool, "connect">;

const globalForPool = globalThis as unknown as { __vocaforgePool?: Pool };

function sslFor(url: string, mode: "auto" | "require" | "disable") {
  if (mode === "disable") return undefined;
  if (mode === "require") return { rejectUnauthorized: false };
  const host = new URL(url).hostname;
  return ["localhost", "127.0.0.1", "::1", "db"].includes(host) ? undefined : { rejectUnauthorized: false };
}

export function getPool(): Pool {
  if (!globalForPool.__vocaforgePool) {
    const config = loadConfig();
    const url = requireDatabaseUrl(config);
    const pool = new Pool({
      connectionString: url,
      ssl: sslFor(url, config.database.ssl),
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on("error", (err) => logger.error("pg pool error", { err: err.message }));
    globalForPool.__vocaforgePool = pool;
  }
  return globalForPool.__vocaforgePool;
}

const CONNECTION_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN"]);

/** Translate low-level driver errors into application errors. Unknown errors are rethrown. */
export function mapDbError(err: unknown): never {
  const e = err as { code?: string; constraint?: string; message?: string };
  if (e?.code === "23505") {
    throw new ConflictError(
      "A record with these values already exists.",
      e.constraint?.includes("name") ? { name: ["A project with this name already exists."] } : undefined,
    );
  }
  if (
    e?.code &&
    (CONNECTION_CODES.has(e.code) || e.code.startsWith("08") || e.code.startsWith("57P") || e.code === "28P01" || e.code === "3D000")
  ) {
    logger.error("database unavailable", { code: e.code });
    throw new DatabaseUnavailableError();
  }
  if (e?.message?.includes("timeout exceeded when trying to connect")) throw new DatabaseUnavailableError();
  throw err;
}

export async function withTransaction<T>(pool: TxRunner, fn: (db: Db) => Promise<T>): Promise<T> {
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (err) {
    return mapDbError(err);
  }
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    return mapDbError(err);
  } finally {
    client.release();
  }
}

/** Real round trip to the database. A configured URL alone never counts as connected. */
export async function checkDatabase(getDb: () => Db = getPool): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await getDb().query("SELECT 1");
    return { ok: true };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    logger.warn("database check failed", { code: e.code, message: e.message });
    if (err instanceof Error && err.name === "ConfigError") return { ok: false, error: err.message };
    return { ok: false, error: "Could not run a query against the database." };
  }
}
