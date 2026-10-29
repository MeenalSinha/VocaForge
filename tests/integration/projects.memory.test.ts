import { beforeAll } from "vitest";
import type { Pool } from "pg";
import { createMemoryStore } from "./helpers";
import { projectServiceSuite } from "./suite";

let pool: Pool;
beforeAll(async () => { pool = await createMemoryStore(); });
projectServiceSuite(() => pool);
