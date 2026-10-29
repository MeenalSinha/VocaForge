import { afterAll, beforeAll, describe } from "vitest";
import { Pool } from "pg";
import { runMigrations } from "@/server/db/migrate";
import { projectServiceSuite } from "./suite";

// Opt-in: runs the same suite against a REAL PostgreSQL database (TEST_DATABASE_URL).
const url = process.env.TEST_DATABASE_URL;
let pool: Pool;

describe.skipIf(!url)("projects against real PostgreSQL", () => {
  const dropTables = () =>
    pool.query(
      "DROP TABLE IF EXISTS agent_deployments, retest_comparisons, fix_proposals, failure_findings, remote_test_definitions, simulation_runs, simulation_batches, persona_collection_items, persona_collections, scenarios, personas, agent_operations, agent_versions, agents, activity_events, projects, schema_migrations CASCADE",
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
  projectServiceSuite(() => pool);
});
