import { loadEnvFiles } from "./_env";
loadEnvFiles();

import { appliedMigrations, pendingMigrations, runMigrations } from "../src/server/db/migrate";
import { getPool } from "../src/server/db/pool";

async function main() {
  const pool = getPool();
  try {
    if (process.argv.includes("--status")) {
      const applied = await appliedMigrations(pool);
      console.log("Applied:", applied.length ? applied.join(", ") : "(none)");
      console.log("Pending:", pendingMigrations(applied).join(", ") || "(none)");
      return;
    }
    const r = await runMigrations(pool);
    console.log(`Applied: ${r.applied.join(", ") || "(none)"}`);
    console.log(`Already applied: ${r.alreadyApplied.join(", ") || "(none)"}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", (err as Error).message);
  process.exit(1);
});
