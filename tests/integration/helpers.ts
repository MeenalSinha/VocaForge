import { DataType, newDb } from "pg-mem";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { runMigrations } from "@/server/db/migrate";

/** In-memory PostgreSQL emulation (pg-mem). Test-only; never used by the application. */
export async function createMemoryStore(): Promise<Pool> {
  const mem = newDb();
  try {
    mem.public.registerFunction({ name: "gen_random_uuid", returns: DataType.uuid, implementation: () => randomUUID(), impure: true });
  } catch {
    /* already provided */
  }
  // pg-mem lacks btrim() and length(); emulate them so the real migration SQL can run unchanged.
  mem.public.registerFunction({ name: "btrim", args: [DataType.text], returns: DataType.text, implementation: (v: string) => v.trim() });
  mem.public.registerFunction({ name: "length", args: [DataType.text], returns: DataType.integer, implementation: (v: string) => v.length });
  const { Pool: MemPool } = mem.adapters.createPg();
  const pool = new MemPool() as unknown as Pool;
  await runMigrations(pool);
  return pool;
}
