import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Runs tests against a REAL PostgreSQL instance (TEST_DATABASE_URL). Opt-in.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["tests/integration/**/*.real-db.test.ts"], testTimeout: 20000 },
});
