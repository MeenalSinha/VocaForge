import { loadEnvFiles } from "./_env";
loadEnvFiles();

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadConfig } from "../src/server/config/env";
import { ElevenLabsClient, isElevenLabsError } from "../src/server/integrations/elevenlabs";
import { newEvidence, runSmoke } from "../src/server/integrations/elevenlabs/smoke";

/**
 * Phase 0 proof of concept against the REAL ElevenLabs API.
 * Creates ONE agent and ONE simulation test and runs it. Billable. Requires explicit opt-in.
 */
async function main() {
  if (process.env.ELEVENLABS_SMOKE_OPT_IN !== "true") {
    console.error("Refusing to run: this script creates billable resources. Set ELEVENLABS_SMOKE_OPT_IN=true to opt in.");
    process.exit(2);
  }
  const cfg = loadConfig().elevenlabs;
  if (!cfg.configured) {
    console.error("ELEVENLABS_API_KEY is not set.");
    process.exit(2);
  }
  const configPath = process.env.SMOKE_CONFIG ?? "scripts/smoke/smoke.config.json";
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    console.error(`Cannot read ${configPath}. Copy scripts/smoke/smoke.config.example.json to ${configPath} and edit it.`);
    process.exit(2);
  }

  mkdirSync(".vocaforge", { recursive: true });
  const evidence = newEvidence();
  const client = new ElevenLabsClient({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, timeoutMs: 30000 });
  let exitCode = 0;
  try {
    await runSmoke(client, raw, { intervalMs: 3000, timeoutMs: 300000 }, undefined, evidence);
    const kinds = (evidence.outcomes ?? []).map((o) => o.kind);
    console.log("Outcome:", kinds.join(", "));
    exitCode = kinds.every((k) => k === "passed") ? 0 : 1;
  } catch (err) {
    console.error(isElevenLabsError(err) ? `[${err.kind}] ${err.message}${err.details ? ` -- ${err.details}` : ""}` : (err as Error).message);
    exitCode = 1;
  } finally {
    // Record created resource ids (not secrets) so cleanup only ever deletes what this script created.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(".vocaforge/smoke-resources.json", JSON.stringify({ agentId: evidence.agentId, testId: evidence.testId }, null, 2));
    writeFileSync(`.vocaforge/smoke-evidence-${stamp}.json`, JSON.stringify(evidence, null, 2));
    console.log(`Evidence written to .vocaforge/smoke-evidence-${stamp}.json`);
    console.log(JSON.stringify(evidence.steps, null, 2));
  }
  process.exit(exitCode);
}

main();
