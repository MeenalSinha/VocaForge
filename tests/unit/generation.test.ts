import { describe, expect, it, vi } from "vitest";
import { AnthropicProvider } from "@/server/generation/anthropic";
import { GenerationError, type GenerationProvider } from "@/server/generation/provider";
import { generateAgentConfig, proposeRefinement } from "@/server/generation/service";
import { ValidationError } from "@/server/errors";
import { sampleConfig } from "./agent-config.test";

const draftFor = (name: string, extra: object = {}) => {
  const c = sampleConfig();
  return { identity: { ...c.identity, name }, behavior: c.behavior, knowledge: c.knowledge, guardrails: c.guardrails, language: c.language, requestedCapabilities: [{ name: "Book appointments", description: "", needsMoreInformation: false }], openQuestions: ["What are the opening hours?"], ...extra };
};
// Test double: returns whatever the test specifies. It exists only under tests/.
const provider = (impl: (req: { user: string; system: string }) => unknown): GenerationProvider => ({ generate: vi.fn(async (req) => impl(req)) });

describe("generateAgentConfig", () => {
  it("returns a validated configuration derived from the provider output, with capabilities unavailable", async () => {
    const r = await generateAgentConfig({ prompt: "A friendly desk" }, provider(() => draftFor("Alpha")));
    expect(r.config.identity.name).toBe("Alpha");
    expect(r.config.capabilities[0]?.status).toBe("unavailable");
    expect(r.config.voice).toEqual({});
    expect(r.openQuestions).toEqual(["What are the opening hours?"]);
  });
  it("produces different configurations for different provider output (no fixed result)", async () => {
    const a = await generateAgentConfig({ prompt: "one" }, provider(() => draftFor("Alpha")));
    const b = await generateAgentConfig({ prompt: "two" }, provider(() => draftFor("Beta")));
    expect(a.config.identity.name).not.toBe(b.config.identity.name);
  });
  it("sends the user's description and starter guidance to the provider", async () => {
    const p = provider(() => draftFor("A"));
    await generateAgentConfig({ prompt: "Hello world pizza", useCase: "restaurant-information" }, p);
    const req = (p.generate as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(req.user).toContain("Hello world pizza");
    expect(req.system).toMatch(/venue information agent/);
    expect(req.schema).toHaveProperty("properties.requestedCapabilities");
  });
  it("rejects malformed model output instead of returning anything", async () => {
    const err = (await generateAgentConfig({ prompt: "x" }, provider(() => ({ identity: { name: "" } }))).catch((e) => e)) as GenerationError;
    expect(err).toBeInstanceOf(GenerationError);
    expect(err.kind).toBe("invalid_output");
  });
  it("propagates provider failure; it never fabricates a configuration", async () => {
    const down: GenerationProvider = { generate: async () => { throw new GenerationError("network", "Could not reach the generation provider."); } };
    await expect(generateAgentConfig({ prompt: "x" }, down)).rejects.toMatchObject({ kind: "network" });
  });
  it("validates the prompt: required, length limit, known use case", async () => {
    const p = provider(() => draftFor("A"));
    await expect(generateAgentConfig({ prompt: "  " }, p)).rejects.toBeInstanceOf(ValidationError);
    await expect(generateAgentConfig({ prompt: "x".repeat(4001) }, p)).rejects.toBeInstanceOf(ValidationError);
    await expect(generateAgentConfig({ prompt: "ok", useCase: "bogus" }, p)).rejects.toBeInstanceOf(ValidationError);
    expect(p.generate).not.toHaveBeenCalled();
  });
});

describe("proposeRefinement", () => {
  it("returns the validated revision, a change list, and preserves the voice", async () => {
    const current = { ...sampleConfig(), voice: { voiceId: "voice_abc123" } };
    const revised = draftFor("Desk", { behavior: { ...current.behavior, welcomeMessage: "Hi there!" }, requestedCapabilities: [{ name: "Book appointments", description: "", needsMoreInformation: false }] });
    const r = await proposeRefinement({ config: current, instruction: "Shorter welcome" }, provider(() => revised));
    expect(r.proposed.voice.voiceId).toBe("voice_abc123");
    expect(r.changes.map((c) => c.path)).toEqual(["behavior.welcomeMessage"]);
  });
  it("reports no changes when the model returns the same configuration", async () => {
    const c = sampleConfig();
    const same = { identity: c.identity, behavior: c.behavior, knowledge: c.knowledge, guardrails: c.guardrails, language: c.language, requestedCapabilities: [{ name: "Book appointments", description: "", needsMoreInformation: false }], openQuestions: [] };
    expect((await proposeRefinement({ config: c, instruction: "nothing" }, provider(() => same))).changes).toEqual([]);
  });
  it("rejects an invalid current configuration and empty instruction before calling the model", async () => {
    const p = provider(() => ({}));
    await expect(proposeRefinement({ config: {}, instruction: "x" }, p)).rejects.toBeInstanceOf(ValidationError);
    await expect(proposeRefinement({ config: sampleConfig(), instruction: " " }, p)).rejects.toBeInstanceOf(ValidationError);
    expect(p.generate).not.toHaveBeenCalled();
  });
});

const fail = (p: Promise<unknown>) => p.catch((x) => x) as Promise<GenerationError>;

describe("AnthropicProvider", () => {
  const opts = { apiKey: "sk-ant-secret", model: "m1", baseUrl: "https://api.anthropic.com", timeoutMs: 200 };
  const req = { system: "s", user: "u", toolName: "t", toolDescription: "d", schema: { type: "object" } };
  const f = (status: number, body: unknown) => vi.fn(async (_u: unknown, _i?: RequestInit) => new Response(JSON.stringify(body), { status }));

  it("builds a Messages API request with a forced tool call and returns the tool input", async () => {
    const fx = f(200, { content: [{ type: "tool_use", name: "t", input: { a: 1 } }] });
    expect(await new AnthropicProvider({ ...opts, fetchImpl: fx as unknown as typeof fetch }).generate(req)).toEqual({ a: 1 });
    const [url, init] = fx.mock.calls[0]!;
    expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("sk-ant-secret");
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: "m1", tool_choice: { type: "tool", name: "t" }, tools: [{ name: "t", input_schema: { type: "object" } }] });
  });
  it.each([[401, "auth"], [429, "rate_limited"], [500, "upstream"]] as const)("maps HTTP %i to %s", async (s, kind) => {
    const e = (await new AnthropicProvider({ ...opts, fetchImpl: f(s, {}) as unknown as typeof fetch }).generate(req).catch((x) => x)) as GenerationError;
    expect(e.kind).toBe(kind);
    expect(e.message).not.toContain("sk-ant-secret");
  });
  it("reports not configured without a network call, and malformed responses", async () => {
    const fx = f(200, {});
    expect((await fail(new AnthropicProvider({ ...opts, apiKey: undefined, fetchImpl: fx as unknown as typeof fetch }).generate(req))).kind).toBe("not_configured");
    expect(fx).not.toHaveBeenCalled();
    expect((await fail(new AnthropicProvider({ ...opts, fetchImpl: f(200, { content: [{ type: "text" }] }) as unknown as typeof fetch }).generate(req))).kind).toBe("malformed");
  });
  it("reports network failure and timeout", async () => {
    const down = vi.fn(async () => { throw new TypeError("x"); });
    expect((await fail(new AnthropicProvider({ ...opts, fetchImpl: down as unknown as typeof fetch }).generate(req))).kind).toBe("network");
    const hang = vi.fn((_u: unknown, i?: RequestInit) => new Promise<Response>((_r, rej) => i?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" })))));
    expect((await fail(new AnthropicProvider({ ...opts, fetchImpl: hang as unknown as typeof fetch }).generate(req))).kind).toBe("timeout");
  });
});
