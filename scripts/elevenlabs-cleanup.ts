import { loadEnvFiles } from "./_env";
loadEnvFiles();

import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { loadConfig } from "../src/server/config/env";
import { ElevenLabsClient } from "../src/server/integrations/elevenlabs";

/** Deletes ONLY the agent and test recorded by the last smoke run. Never lists or deletes anything else. */
async function main() {
  const file = ".vocaforge/smoke-resources.json";
  if (!existsSync(file)) {
    console.log("Nothing to clean up: no smoke resources recorded.");
    return;
  }
  const { agentId, testId } = JSON.parse(readFileSync(file, "utf8")) as { agentId?: string; testId?: string };
  const cfg = loadConfig().elevenlabs;
  const client = new ElevenLabsClient({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, timeoutMs: 30000 });
  let failed = false;
  for (const [label, id, del] of [
    ["test", testId, (i: string) => client.deleteTest(i)],
    ["agent", agentId, (i: string) => client.deleteAgent(i)],
  ] as const) {
    if (!id) continue;
    try {
      await del(id);
      console.log(`Deleted ${label} ${id}`);
    } catch (err) {
      failed = true;
      console.error(`Could not delete ${label} ${id}: ${(err as Error).message}`);
    }
  }
  if (!failed) unlinkSync(file);
  process.exit(failed ? 1 : 0);
}

main();
