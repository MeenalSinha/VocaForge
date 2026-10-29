import { describe, expect, it, vi } from "vitest";
import { ElevenLabsClient } from "@/server/integrations/elevenlabs/client";
import { ElevenLabsError } from "@/server/integrations/elevenlabs/errors";

// Test double for fetch. It lives only in tests and returns exactly what each test specifies.
function fakeFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  return vi.fn(async (_url: URL | string, _init?: RequestInit) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers }),
  );
}
const make = (f: typeof fetch, apiKey: string | undefined = "sk_test_key_123456") =>
  new ElevenLabsClient({ apiKey, baseUrl: "https://api.elevenlabs.io", fetchImpl: f, timeoutMs: 200 });
const kind = async (p: Promise<unknown>) => (await p.catch((e) => e)) as ElevenLabsError;

describe("request construction", () => {
  it("verifyAuth sends an authenticated GET with page_size=1", async () => {
    const f = fakeFetch(200, { agents: [] });
    await make(f as unknown as typeof fetch).verifyAuth();
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe("https://api.elevenlabs.io/v1/convai/agents?page_size=1");
    expect(init?.method).toBe("GET");
    expect((init?.headers as Record<string, string>)["xi-api-key"]).toBe("sk_test_key_123456");
  });

  it("createAgent posts the documented conversation_config shape and returns the agent id", async () => {
    const f = fakeFetch(200, { agent_id: "agent_1" });
    const out = await make(f as unknown as typeof fetch).createAgent({ name: "a", prompt: "be kind", firstMessage: "Hi", language: "en", llm: "gpt-4.1" });
    expect(out).toEqual({ agentId: "agent_1" });
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe("https://api.elevenlabs.io/v1/convai/agents/create");
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "a",
      conversation_config: { agent: { language: "en", first_message: "Hi", prompt: { prompt: "be kind", llm: "gpt-4.1" } } },
    });
  });

  it("createSimulationTest posts a simulation test with success conditions", async () => {
    const f = fakeFetch(200, { id: "test_1" });
    const out = await make(f as unknown as typeof fetch).createSimulationTest({ name: "t", scenario: "caller asks", successConditions: ["says no"], maxTurns: 4 });
    expect(out).toEqual({ testId: "test_1" });
    expect(JSON.parse(String(f.mock.calls[0]![1]?.body))).toEqual({
      name: "t", type: "simulation", simulation_scenario: "caller asks", success_conditions: ["says no"], simulation_max_turns: 4,
    });
  });

  it("runTests posts the test ids and encodes the agent id in the path", async () => {
    const f = fakeFetch(200, { id: "inv_1", test_runs: [] });
    await make(f as unknown as typeof fetch).runTests("agent/odd id", ["t1", "t2"]);
    expect(String(f.mock.calls[0]![0])).toBe("https://api.elevenlabs.io/v1/convai/agents/agent%2Fodd%20id/run-tests");
    expect(JSON.parse(String(f.mock.calls[0]![1]?.body))).toEqual({ tests: [{ test_id: "t1" }, { test_id: "t2" }] });
  });

  it("rejects invalid input before any network call", async () => {
    const f = fakeFetch(200, {});
    const c = make(f as unknown as typeof fetch);
    await expect(c.createAgent({ name: "", prompt: "x" })).rejects.toThrow();
    await expect(c.createSimulationTest({ name: "t", scenario: "s", successConditions: [] })).rejects.toThrow();
    expect((await kind(c.runTests("a", []))).kind).toBe("validation");
    expect(f).not.toHaveBeenCalled();
  });
});

describe("error handling", () => {
  it("reports missing credentials without calling the network", async () => {
    const f = fakeFetch(200, {});
    const e = await kind(make(f as unknown as typeof fetch, "").verifyAuth());
    expect(e.kind).toBe("missing_credentials");
    expect(f).not.toHaveBeenCalled();
  });

  it.each([
    [401, "auth_invalid"],
    [403, "permission_denied"],
    [404, "unsupported"],
    [410, "unsupported"],
    [422, "validation"],
    [429, "rate_limited"],
    [500, "upstream"],
    [503, "upstream"],
  ] as const)("maps HTTP %i to %s", async (status, expected) => {
    const e = await kind(make(fakeFetch(status, { detail: "nope" }) as unknown as typeof fetch).verifyAuth());
    expect(e).toBeInstanceOf(ElevenLabsError);
    expect(e.kind).toBe(expected);
    expect(e.status).toBe(status);
  });

  it("exposes Retry-After on rate limiting", async () => {
    const e = await kind(make(fakeFetch(429, {}, { "retry-after": "12" }) as unknown as typeof fetch).verifyAuth());
    expect(e.retryAfterSeconds).toBe(12);
  });

  it("never leaks the API key through error details", async () => {
    const key = "sk_test_key_123456";
    const e = await kind(make(fakeFetch(401, { detail: `invalid key ${key}` }) as unknown as typeof fetch, key).verifyAuth());
    expect(`${e.message} ${e.details}`).not.toContain(key);
  });

  it("reports network failures and timeouts", async () => {
    const down = vi.fn(async () => { throw new TypeError("fetch failed"); });
    expect((await kind(make(down as unknown as typeof fetch).verifyAuth())).kind).toBe("network");
    const hang = vi.fn((_u: unknown, init?: RequestInit) => new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }));
    expect((await kind(make(hang as unknown as typeof fetch).verifyAuth())).kind).toBe("timeout");
  });

  it("reports malformed responses (non-JSON and wrong shape)", async () => {
    expect((await kind(make(fakeFetch(200, "<html>") as unknown as typeof fetch).verifyAuth())).kind).toBe("malformed_response");
    expect((await kind(make(fakeFetch(200, { nope: true }) as unknown as typeof fetch).createAgent({ name: "a", prompt: "p" }))).kind).toBe("malformed_response");
  });
});
