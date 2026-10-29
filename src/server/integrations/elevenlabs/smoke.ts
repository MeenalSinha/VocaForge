import { z } from "zod";
import type { ElevenLabsClient } from "./client";
import { createAgentInputSchema, createSimulationTestInputSchema } from "./schemas";
import { waitForInvocation, type SimulationOutcome, type WaitOptions } from "./simulation";

/** Explicit, user-supplied configuration for the proof of concept. Lives in scripts/smoke/smoke.config.json. */
export const smokeConfigSchema = z.object({
  agent: createAgentInputSchema,
  test: createSimulationTestInputSchema,
});
export type SmokeConfig = z.input<typeof smokeConfigSchema>;

export const SMOKE_PREFIX = "vocaforge-smoke-";

export interface SmokeEvidence {
  startedAt: string;
  steps: { step: string; ok: boolean; detail?: string }[];
  agentId?: string;
  testId?: string;
  invocationId?: string;
  outcomes?: SimulationOutcome[];
}

export const newEvidence = (): SmokeEvidence => ({ startedAt: new Date().toISOString(), steps: [] });

/**
 * Creates one isolated agent and one simulation test, runs it, and reports the real outcome.
 * Resource names are prefixed so cleanup can only ever touch what this function created.
 */
export async function runSmoke(
  client: Pick<ElevenLabsClient, "verifyAuth" | "createAgent" | "createSimulationTest" | "runTests" | "getTestInvocation">,
  rawConfig: unknown,
  wait: WaitOptions = {},
  suffix = Date.now().toString(36),
  /** Caller-owned so partial evidence (e.g. a created agent id) survives a later failure. */
  evidence: SmokeEvidence = newEvidence(),
): Promise<SmokeEvidence> {
  const cfg = smokeConfigSchema.parse(rawConfig);
  const step = async <T>(name: string, fn: () => Promise<T>, detail?: (v: T) => string): Promise<T> => {
    try {
      const v = await fn();
      evidence.steps.push({ step: name, ok: true, detail: detail?.(v) });
      return v;
    } catch (err) {
      evidence.steps.push({ step: name, ok: false, detail: (err as Error).message });
      throw err;
    }
  };

  await step("verify authentication", () => client.verifyAuth());
  const { agentId } = await step(
    "create agent",
    () => client.createAgent({ ...cfg.agent, name: `${SMOKE_PREFIX}${suffix}-${cfg.agent.name}` }),
    (v) => v.agentId,
  );
  evidence.agentId = agentId;
  const { testId } = await step(
    "create simulation test",
    () => client.createSimulationTest({ ...cfg.test, name: `${SMOKE_PREFIX}${suffix}-${cfg.test.name}` }),
    (v) => v.testId,
  );
  evidence.testId = testId;
  const inv = await step("run test", () => client.runTests(agentId, [testId]), (v) => v.id);
  evidence.invocationId = inv.id;
  const settled = await step("poll for result", () => waitForInvocation(client, inv.id, wait), (v) => v.outcomes.map((o) => o.kind).join(","));
  evidence.outcomes = settled.outcomes;
  return evidence;
}
