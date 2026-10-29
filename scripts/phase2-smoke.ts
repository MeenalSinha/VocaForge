import { loadEnvFiles } from "./_env";
loadEnvFiles();

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { agentConfigSchema } from "../src/server/agents/config-schema";
import { buildRemotePayload } from "../src/server/agents/prompt";
import { loadConfig } from "../src/server/config/env";
import { ElevenLabsClient, isElevenLabsError } from "../src/server/integrations/elevenlabs";

/**
 * Phase 2 proof against the REAL ElevenLabs API. Billable and externally visible. Requires explicit opt-in.
 * Steps: auth, list voices, create ONE agent, read it back, update it, issue a session URL, delete it, confirm it is gone.
 * It only ever deletes the single agent it created in this run.
 */
const fileSchema = z.object({ config: agentConfigSchema, updatedWelcomeMessage: z.string().min(1) });
type Step = { step: string; ok: boolean; detail?: string };

async function main() {
  if (process.env.ELEVENLABS_SMOKE_OPT_IN !== "true") { console.error("Refusing to run: set ELEVENLABS_SMOKE_OPT_IN=true to opt in."); process.exit(2); }
  const cfg = loadConfig().elevenlabs;
  if (!cfg.configured) { console.error("ELEVENLABS_API_KEY is not set."); process.exit(2); }
  const path = process.env.SMOKE_AGENT_CONFIG ?? "scripts/smoke/agent-smoke.config.json";
  let file: z.infer<typeof fileSchema>;
  try { file = fileSchema.parse(JSON.parse(readFileSync(path, "utf8"))); } catch (e) { console.error(`Cannot read a valid ${path}: copy scripts/smoke/agent-smoke.config.example.json and edit it. ${(e as Error).message.slice(0, 200)}`); process.exit(2); }

  const client = new ElevenLabsClient({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, timeoutMs: 30000 });
  const steps: Step[] = [];
  const run = async <T>(step: string, fn: () => Promise<T>, detail?: (v: T) => string): Promise<T> => {
    try { const v = await fn(); steps.push({ step, ok: true, detail: detail?.(v) }); return v; }
    catch (err) { steps.push({ step, ok: false, detail: isElevenLabsError(err) ? `[${err.kind}] ${err.message}` : (err as Error).message }); throw err; }
  };
  let agentId: string | undefined;
  try {
    await run("verify authentication", () => client.verifyAuth());
    const voices = await run("list voices", () => client.listVoices({ pageSize: 5 }), (p) => `${p.voices.length} returned`);
    const config = structuredClone(file.config);
    config.identity.name = `vocaforge-smoke-${Date.now().toString(36)}`;
    if (voices.voices[0]) config.voice.voiceId = voices.voices[0].voice_id;
    agentId = (await run("create agent", () => client.createAgentFromPayload(buildRemotePayload(config, { agentLlm: cfg.agentLlm, agentTtsModel: cfg.agentTtsModel })), (v) => v.agentId)).agentId;
    await run("read agent back", () => client.getAgent(agentId!), (a) => `name ${a.name ?? "(none)"}`);
    const updated = structuredClone(config);
    updated.behavior.welcomeMessage = file.updatedWelcomeMessage;
    await run("update agent", () => client.updateAgent(agentId!, buildRemotePayload(updated, { agentLlm: cfg.agentLlm, agentTtsModel: cfg.agentTtsModel })));
    const back = await run("confirm update", () => client.getAgent(agentId!));
    const fm = (back.conversation_config as { agent?: { first_message?: string } } | null | undefined)?.agent?.first_message;
    steps.push({ step: "welcome message changed remotely", ok: fm === file.updatedWelcomeMessage, detail: fm === file.updatedWelcomeMessage ? undefined : "remote value differs from the update" });
    await run("issue signed session URL", () => client.getSignedUrl(agentId!), () => "URL issued (not printed)");
  } catch (err) {
    console.error(isElevenLabsError(err) ? `[${err.kind}] ${err.message} ${err.details ?? ""}` : (err as Error).message);
  } finally {
    if (agentId) {
      try {
        await run("delete agent (own)", () => client.deleteAgent(agentId!));
        const gone = await client.getAgent(agentId).then(() => false, (e) => isElevenLabsError(e) && e.kind === "unsupported");
        steps.push({ step: "confirm agent is gone", ok: gone });
      } catch { console.error(`Could not delete ${agentId}. Delete it manually in ElevenLabs.`); }
    }
    mkdirSync(".vocaforge", { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(`.vocaforge/phase2-smoke-${stamp}.json`, JSON.stringify({ agentId, steps }, null, 2));
    console.log(JSON.stringify(steps, null, 2));
    process.exit(steps.every((s) => s.ok) ? 0 : 1);
  }
}
main();
