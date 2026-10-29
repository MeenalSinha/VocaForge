import { existsSync } from "node:fs";

/** Load .env.local then .env (first value wins). Uses Node's built-in loader; no extra dependency. */
export function loadEnvFiles() {
  for (const f of [".env.local", ".env"]) {
    if (existsSync(f)) process.loadEnvFile(f);
  }
}
