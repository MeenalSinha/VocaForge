import { afterAll, beforeAll, describe } from "vitest";
import { Pool } from "pg";
import { runMigrations } from "@/server/db/migrate";
import { projectServiceSuite } from "./suite";

// Opt-in: runs the same suite against a REAL PostgreSQL database (TEST_DATABASE_URL).
const url = process.env.TEST_DATABASE_URL;
let pool: Pool;

describe.skipIf(!url)("projects against real PostgreSQL", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    await pool.query("DROP TABLE IF EXISTS agent_operations, agent_versions, agents, activity_events, projects, schema_migrations CASCADE");
    await runMigrations(pool);
  });
  afterAll(async () => {
    await pool.query("DROP TABLE IF EXISTS agent_operations, agent_versions, agents, activity_events, projects, schema_migrations CASCADE");
    await pool.end();
  });
  projectServiceSuite(() => pool);
});
