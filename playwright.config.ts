import { defineConfig } from "@playwright/test";

// Browser tests need a running app with a migrated database (see README).
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run build && npm run start", url: "http://localhost:3000/api/health", reuseExistingServer: true, timeout: 180000 },
});
