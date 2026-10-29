import { NextResponse } from "next/server";
import { loadConfig } from "@/server/config/env";
import { appliedMigrations, pendingMigrations } from "@/server/db/migrate";
import { checkDatabase, getPool } from "@/server/db/pool";

export const dynamic = "force-dynamic";

/** Real health check: runs a query and compares applied migrations. Returns no secrets. */
export async function GET() {
  const config = loadConfig();
  const db = await checkDatabase();
  let migrations: { pending: string[] } | null = null;
  if (db.ok) {
    try {
      migrations = { pending: pendingMigrations(await appliedMigrations(getPool())) };
    } catch {
      migrations = null;
    }
  }
  const healthy = db.ok && migrations !== null && migrations.pending.length === 0;
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database: db.ok ? "connected" : db.error,
      migrations: migrations ? (migrations.pending.length === 0 ? "up to date" : `pending: ${migrations.pending.join(", ")}`) : "unknown",
      elevenlabsConfigured: config.elevenlabs.configured,
      configIssues: config.issues,
    },
    { status: healthy ? 200 : 503 },
  );
}
