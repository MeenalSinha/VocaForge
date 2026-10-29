import { afterAll, beforeAll, describe } from "vitest";
import { Pool } from "pg";
import { runMigrations } from "@/server/db/migrate";
import { agentServiceSuite } from "./agents-suite";

// Opt-in: the agent service suite against REAL PostgreSQL (TEST_DATABASE_URL). Tables are dropped.
const url = process.env.TEST_DATABASE_URL;
let pool: Pool;

describe.skipIf(!url)("agents against real PostgreSQL", () => {
  const dropTables = () =>
    pool.query(
      "DROP TABLE IF EXISTS retest_comparisons, fix_proposals, failure_findings, remote_test_definitions, simulation_runs, simulation_batches, persona_collection_items, persona_collections, scenarios, personas, agent_operations, agent_versions, agents, activity_events, projects, schema_migrations CASCADE",
    );

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    await dropTables();
    await runMigrations(pool);
  });
  afterAll(async () => {
    await dropTables();
    await pool.end();
  });
  agentServiceSuite(() => pool);
});
