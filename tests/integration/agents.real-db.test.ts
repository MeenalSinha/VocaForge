import { afterAll, beforeAll, describe } from "vitest";
import { Pool } from "pg";
import { runMigrations } from "@/server/db/migrate";
import { agentServiceSuite } from "./agents-suite";

// Opt-in: the agent service suite against REAL PostgreSQL (TEST_DATABASE_URL). Tables are dropped.
const url = process.env.TEST_DATABASE_URL;
let pool: Pool;

describe.skipIf(!url)("agents against real PostgreSQL", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    await pool.query("DROP TABLE IF EXISTS agent_operations, agent_versions, agents, activity_events, projects, schema_migrations CASCADE");
    await runMigrations(pool);
  });
  afterAll(async () => {
    await pool.query("DROP TABLE IF EXISTS agent_operations, agent_versions, agents, activity_events, projects, schema_migrations CASCADE");
    await pool.end();
  });
  agentServiceSuite(() => pool);
});
