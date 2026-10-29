import { beforeAll } from "vitest";
import type { Pool } from "pg";
import { createMemoryStore } from "./helpers";
import { agentServiceSuite } from "./agents-suite";

let pool: Pool;
beforeAll(async () => { pool = await createMemoryStore(); });
agentServiceSuite(() => pool);
