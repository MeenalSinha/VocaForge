import { z } from "zod";

const text = (max: number) => z.string().trim().min(1, "Required.").max(max, `Must be ${max} characters or fewer.`);
const optionalText = (max: number) => z.string().trim().max(max, `Must be ${max} characters or fewer.`);
const list = (maxItems: number, maxLen: number) =>
  z.array(z.string().trim().min(1).max(maxLen, `Each item must be ${maxLen} characters or fewer.`)).max(maxItems, `At most ${maxItems} items.`);
export const languageCode = z.string().trim().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/, "Use a language code such as en or hi.");

/** The editable, validated agent configuration. One shape used by the generator, editor, database and remote mapper. */
export const agentConfigSchema = z.object({
  identity: z.object({ name: text(100), description: optionalText(500), role: text(300) }),
  behavior: z.object({
    purpose: text(500),
    goals: list(10, 300).min(1, "Add at least one goal."),
    welcomeMessage: text(500),
    instructions: text(6000),
    tone: text(200),
    responseStyle: optionalText(300),
  }),
  knowledge: z.object({ sources: list(15, 300), mustNotInvent: list(15, 300) }),
  guardrails: z.object({
    prohibitedActions: list(15, 300),
    restrictedInformation: list(15, 300),
    escalationConditions: list(15, 300),
    uncertaintyRules: optionalText(1000),
  }),
  language: z.object({ primary: languageCode, additional: z.array(languageCode).max(10) }),
  voice: z.object({
    voiceId: z.string().trim().min(1).max(100).optional(),
    stability: z.number().min(0).max(1).optional(),
    speed: z.number().min(0.7).max(1.2).optional(),
  }),
  capabilities: z
    .array(
      z.object({
        name: text(100),
        description: optionalText(300),
        // "unavailable": no integration exists for it. "needs_information": the user must supply details first.
        status: z.enum(["unavailable", "needs_information"]),
        note: optionalText(300),
      }),
    )
    .max(15),
});
export type AgentConfig = z.infer<typeof agentConfigSchema>;

/** What the generation model is asked to return. It never chooses a voice and never sets capability status. */
export const generatedDraftSchema = z.object({
  identity: agentConfigSchema.shape.identity,
  behavior: agentConfigSchema.shape.behavior,
  knowledge: agentConfigSchema.shape.knowledge,
  guardrails: agentConfigSchema.shape.guardrails,
  language: agentConfigSchema.shape.language,
  requestedCapabilities: z.array(z.object({ name: text(100), description: optionalText(300), needsMoreInformation: z.boolean() })).max(15),
  openQuestions: list(10, 300),
});
export type GeneratedDraft = z.infer<typeof generatedDraftSchema>;

export function emptyConfig(): AgentConfig {
  return {
    identity: { name: "", description: "", role: "" },
    behavior: { purpose: "", goals: [], welcomeMessage: "", instructions: "", tone: "", responseStyle: "" },
    knowledge: { sources: [], mustNotInvent: [] },
    guardrails: { prohibitedActions: [], restrictedInformation: [], escalationConditions: [], uncertaintyRules: "" },
    language: { primary: "en", additional: [] },
    voice: {},
    capabilities: [],
  };
}

/** Integrations VocaForge can actually perform today. Intentionally empty: none exist yet (Phase 2 has no tool integrations). */
export const IMPLEMENTED_CAPABILITIES: ReadonlySet<string> = new Set();

export function resolveCapabilities(requested: GeneratedDraft["requestedCapabilities"]): AgentConfig["capabilities"] {
  return requested.map((c) => ({
    name: c.name,
    description: c.description,
    status: c.needsMoreInformation ? "needs_information" : "unavailable",
    note: IMPLEMENTED_CAPABILITIES.has(c.name.toLowerCase())
      ? ""
      : "No integration exists for this yet. The agent will not perform it and will hand the request to a human.",
  }));
}

/** Keeps existing capability entries (and any note the user edited) when the model requests the same capability again. */
export function mergeCapabilities(existing: AgentConfig["capabilities"], requested: GeneratedDraft["requestedCapabilities"]): AgentConfig["capabilities"] {
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));
  return resolveCapabilities(requested).map((c) => byName.get(c.name.toLowerCase()) ?? c);
}

export function draftToConfig(d: GeneratedDraft, voice: AgentConfig["voice"] = {}): AgentConfig {
  return {
    identity: d.identity,
    behavior: d.behavior,
    knowledge: d.knowledge,
    guardrails: d.guardrails,
    language: d.language,
    voice,
    capabilities: resolveCapabilities(d.requestedCapabilities),
  };
}

export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const i of error.issues) (out[i.path.join(".") || "_form"] ??= []).push(i.message);
  return out;
}
