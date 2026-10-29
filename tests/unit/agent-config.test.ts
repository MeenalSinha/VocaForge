import { describe, expect, it } from "vitest";
import { agentConfigSchema, draftToConfig, emptyConfig, generatedDraftSchema, resolveCapabilities } from "@/server/agents/config-schema";
import { diffConfig, sameConfig, summarize } from "@/server/agents/diff";
import { buildRemotePayload, composeSystemPrompt, localOnlyNotes } from "@/server/agents/prompt";
import { getStarter, STARTERS } from "@/server/agents/starters";

export const sampleConfig = () => agentConfigSchema.parse({
  identity: { name: "Desk", description: "", role: "A front desk assistant." },
  behavior: { purpose: "Answer calls.", goals: ["Answer questions"], welcomeMessage: "Hello, how can I help?", instructions: "Be brief.", tone: "warm", responseStyle: "" },
  knowledge: { sources: ["Owner supplied notes"], mustNotInvent: ["prices"] },
  guardrails: { prohibitedActions: ["Give medical advice"], restrictedInformation: [], escalationConditions: ["Caller reports an emergency"], uncertaintyRules: "" },
  language: { primary: "en", additional: ["hi"] },
  voice: {},
  capabilities: [{ name: "Book appointments", description: "", status: "unavailable", note: "" }],
});

describe("agent configuration schema", () => {
  it("accepts a complete configuration and rejects an empty one with path-level errors", () => {
    expect(agentConfigSchema.safeParse(sampleConfig()).success).toBe(true);
    const r = agentConfigSchema.safeParse(emptyConfig());
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path.join("."))).toEqual(expect.arrayContaining(["identity.name", "behavior.goals", "behavior.welcomeMessage"]));
  });
  it("enforces limits: language code, voice speed range, list sizes", () => {
    const c = sampleConfig();
    expect(agentConfigSchema.safeParse({ ...c, language: { primary: "English", additional: [] } }).success).toBe(false);
    expect(agentConfigSchema.safeParse({ ...c, voice: { speed: 3 } }).success).toBe(false);
    expect(agentConfigSchema.safeParse({ ...c, behavior: { ...c.behavior, goals: Array(11).fill("x") } }).success).toBe(false);
  });
  it("rejects an invalid capability status", () => {
    expect(agentConfigSchema.safeParse({ ...sampleConfig(), capabilities: [{ name: "x", description: "", status: "available", note: "" }] }).success).toBe(false);
  });
});

describe("capabilities are never reported as available", () => {
  it("marks every requested capability unavailable or needing information", () => {
    const r = resolveCapabilities([{ name: "Book appointments", description: "", needsMoreInformation: false }, { name: "Send SMS", description: "", needsMoreInformation: true }]);
    expect(r.map((c) => c.status)).toEqual(["unavailable", "needs_information"]);
  });
  it("rejects model output that tries to set a voice or capability status", () => {
    const c = sampleConfig();
    const draft = { ...c, requestedCapabilities: [], openQuestions: [] };
    const parsed = generatedDraftSchema.parse({ ...draft, voice: { voiceId: "x" } });
    expect("voice" in parsed).toBe(false);
    expect(draftToConfig(parsed).voice).toEqual({});
  });
});

describe("prompt and remote payload", () => {
  it("builds the documented conversation_config shape from configuration only", () => {
    const c = { ...sampleConfig(), voice: { voiceId: "voice_abc123", stability: 0.5, speed: 1 } };
    const p = buildRemotePayload(c, { agentLlm: "some-llm", agentTtsModel: "some-tts" });
    expect(p).toMatchObject({ name: "Desk", conversation_config: { agent: { language: "en", first_message: "Hello, how can I help?", prompt: { llm: "some-llm" } }, tts: { voice_id: "voice_abc123", model_id: "some-tts", stability: 0.5, speed: 1 } } });
  });
  it("omits tts when no voice is chosen and llm when not configured", () => {
    const p = buildRemotePayload(sampleConfig());
    expect(p.conversation_config.tts).toBeUndefined();
    expect(p.conversation_config.agent.prompt.llm).toBeUndefined();
  });
  it("tells the agent what it cannot do and never to invent facts", () => {
    const s = composeSystemPrompt(sampleConfig());
    expect(s).toMatch(/Book appointments/);
    expect(s).toMatch(/Do not claim you did/);
    expect(s).toMatch(/Never make up facts/);
    expect(s).toMatch(/Caller reports an emergency/);
  });
  it("is derived from the configuration, so different configurations differ", () => {
    const a = sampleConfig();
    const b = { ...a, identity: { ...a.identity, name: "Menu Bot" }, guardrails: { ...a.guardrails, escalationConditions: ["Allergy question"] } };
    expect(composeSystemPrompt(a)).not.toEqual(composeSystemPrompt(b));
  });
  it("states plainly which fields are local-only", () => {
    expect(localOnlyNotes(sampleConfig()).join(" ")).toMatch(/Additional languages/);
  });
});

describe("diff and versions", () => {
  it("reports no changes for identical configurations regardless of key order", () => {
    const a = sampleConfig();
    const rev = (v: unknown): unknown => Array.isArray(v) ? v.map(rev) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, rev(x)])) : v;
    const reordered = rev(a);
    expect(sameConfig(a, reordered)).toBe(true);
    expect(diffConfig(a, a)).toEqual([]);
  });
  it("lists exactly the changed fields with before and after", () => {
    const a = sampleConfig();
    const b = { ...a, behavior: { ...a.behavior, welcomeMessage: "Hi!" }, language: { primary: "en", additional: ["hi", "ta"] } };
    const d = diffConfig(a, b);
    expect(d.map((x) => x.path).sort()).toEqual(["behavior.welcomeMessage", "language.additional"]);
    expect(d.find((x) => x.path === "behavior.welcomeMessage")).toMatchObject({ before: "Hello, how can I help?", after: "Hi!" });
    expect(summarize(d)).toMatch(/welcome message/);
  });
});

describe("use-case starters", () => {
  it("provides unique, general starters without business facts", () => {
    expect(new Set(STARTERS.map((s) => s.id)).size).toBe(STARTERS.length);
    expect(STARTERS.length).toBeGreaterThanOrEqual(7);
    expect(getStarter("customer-support")?.label).toBe("Customer support");
    expect(getStarter("nope")).toBeUndefined();
    expect(JSON.stringify(STARTERS)).not.toMatch(/dental|Arogya|₹|\$\d/i);
  });
});
