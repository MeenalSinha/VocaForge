import { beforeAll } from "vitest";
import type { Pool } from "pg";
import { createMemoryStore } from "./helpers";
import { simulationServiceSuite } from "./simulations-suite";

let pool: Pool;
beforeAll(async () => {
  pool = await createMemoryStore();
});

simulationServiceSuite(() => pool);
