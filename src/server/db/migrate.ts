import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Pool } from "pg";

export const MIGRATIONS_DIR = path.join(process.cwd(), "src/server/db/migrations");

export interface MigrationResult {
  applied: string[];
  alreadyApplied: string[];
}

function loadFiles(dir: string): { name: string; sql: string }[] {
  return readdirSync(dir)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(dir, name), "utf8") }));
}

export async function ensureMigrationsTable(pool: Pool) {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
}

export async function appliedMigrations(pool: Pool): Promise<string[]> {
  await ensureMigrationsTable(pool);
  const res = await pool.query<{ name: string }>("SELECT name FROM schema_migrations ORDER BY name");
  return res.rows.map((r) => r.name);
}

export async function runMigrations(pool: Pool, dir = MIGRATIONS_DIR): Promise<MigrationResult> {
  const done = new Set(await appliedMigrations(pool));
  const result: MigrationResult = { applied: [], alreadyApplied: [] };
  for (const file of loadFiles(dir)) {
    if (done.has(file.name)) {
      result.alreadyApplied.push(file.name);
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(file.sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file.name]);
      await client.query("COMMIT");
      result.applied.push(file.name);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw new Error(`Migration ${file.name} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
  return result;
}

export function pendingMigrations(applied: string[], dir = MIGRATIONS_DIR): string[] {
  const have = new Set(applied);
  return loadFiles(dir).map((f) => f.name).filter((n) => !have.has(n));
}
