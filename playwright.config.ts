import { defineConfig } from "@playwright/test";
import { loadEnvFiles } from "./scripts/_env";
loadEnvFiles();

const token = process.env.VOCAFORGE_ACCESS_TOKEN?.trim() || process.env.E2E_ACCESS_TOKEN?.trim();

// Browser tests need a running app with a migrated database (see README).
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    httpCredentials: token ? { username: "vocaforge", password: token } : undefined,
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run build && npm run start", url: "http://localhost:3000/api/health", reuseExistingServer: true, timeout: 180000 },
});
