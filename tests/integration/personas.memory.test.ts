import { beforeAll } from "vitest";
import type { Pool } from "pg";
import { createMemoryStore } from "./helpers";
import { personaServiceSuite } from "./personas-suite";

let pool: Pool;
beforeAll(async () => {
  pool = await createMemoryStore();
});

personaServiceSuite(() => pool);
