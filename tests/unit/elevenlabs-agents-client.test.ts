import { describe, expect, it, vi } from "vitest";
import { listVoices, normalizeVoice, previewVoice } from "@/server/agents/voices";
import { ElevenLabsClient } from "@/server/integrations/elevenlabs/client";

const ff = (status: number, body: unknown, headers: Record<string, string> = { "content-type": "application/json" }) =>
  vi.fn(async (_u: URL | string, _i?: RequestInit) => new Response(typeof body === "string" || body instanceof ArrayBuffer ? (body as BodyInit) : JSON.stringify(body), { status, headers }));
const mk = (f: unknown) => new ElevenLabsClient({ apiKey: "sk_key_abcdef12", baseUrl: "https://api.elevenlabs.io", fetchImpl: f as typeof fetch, timeoutMs: 200 });

describe("Phase 2 ElevenLabs client methods (request construction)", () => {
  it("listVoices calls GET /v2/voices with search and paging", async () => {
    const f = ff(200, { voices: [{ voice_id: "v1", name: "Ana" }], has_more: true, next_page_token: "tok" });
    const page = await mk(f).listVoices({ search: "ana", pageToken: "p2", pageSize: 10 });
    expect(String(f.mock.calls[0]![0])).toBe("https://api.elevenlabs.io/v2/voices?page_size=10&search=ana&next_page_token=p2");
    expect(page.voices[0]?.voice_id).toBe("v1");
  });
  it("getAgent, updateAgent, getSignedUrl use the documented paths", async () => {
    const f = ff(200, { agent_id: "a1", signed_url: "wss://x/y?token=1" });
    const c = mk(f);
    await c.getAgent("a1");
    await c.updateAgent("a1", { name: "n", conversation_config: { agent: { language: "en", first_message: "hi", prompt: { prompt: "p" } } } });
    expect(await c.getSignedUrl("a1")).toBe("wss://x/y?token=1");
    expect(f.mock.calls.map((x) => [x[1]?.method, String(x[0])])).toEqual([
      ["GET", "https://api.elevenlabs.io/v1/convai/agents/a1"],
      ["PATCH", "https://api.elevenlabs.io/v1/convai/agents/a1"],
      ["GET", "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=a1"],
    ]);
  });
  it("textToSpeech posts text and returns audio, rejecting non-audio responses", async () => {
    const audio = new Uint8Array([1, 2, 3]).buffer;
    const f = ff(200, audio, { "content-type": "audio/mpeg" });
    const r = await mk(f).textToSpeech("v1", "hello", "model_x");
    expect(JSON.parse(String(f.mock.calls[0]![1]?.body))).toEqual({ text: "hello", model_id: "model_x" });
    expect(new Uint8Array(r.audio)).toEqual(new Uint8Array([1, 2, 3]));
    const bad = await mk(ff(200, "<html>", { "content-type": "text/html" })).textToSpeech("v1", "x").catch((e) => e);
    expect(bad.kind).toBe("malformed_response");
  });
  it("surfaces auth failure on voices without leaking the key", async () => {
    const e = await mk(ff(401, { detail: "bad key sk_key_abcdef12" })).listVoices().catch((x) => x);
    expect(e.kind).toBe("auth_invalid");
    expect(`${e.message}${e.details}`).not.toContain("sk_key_abcdef12");
  });
});

describe("voice service", () => {
  it("normalises only metadata the API returned and never invents fields", () => {
    const v = normalizeVoice({ voice_id: "v1", name: "Ana", labels: { accent: "indian", language: "hi", n: 1 }, verified_languages: [{ language: "en", locale: "en-IN" }] });
    expect(v).toMatchObject({ voiceId: "v1", name: "Ana", category: null, description: null, previewUrl: null, labels: { accent: "indian", language: "hi" } });
    expect(v.languages.sort()).toEqual(["en", "hi"]);
  });
  it("filters by language on returned metadata and caches identical queries", async () => {
    const remote = { listVoices: vi.fn(async () => ({ voices: [{ voice_id: "v1", name: "A", labels: { language: "hi" } }, { voice_id: "v2", name: "B", labels: { language: "fr" } }], has_more: false })) };
    delete (globalThis as { __voiceCache?: unknown }).__voiceCache;
    const a = await listVoices({ language: "hi", search: "cachekey" }, remote as never);
    await listVoices({ language: "hi", search: "cachekey" }, remote as never);
    expect(a.voices.map((v) => v.voiceId)).toEqual(["v1"]);
    expect(a.filteredByLanguage).toBe(true);
    expect(remote.listVoices).toHaveBeenCalledTimes(1);
  });
  it("maps an ElevenLabs failure to a safe application error, not a fallback list", async () => {
    delete (globalThis as { __voiceCache?: unknown }).__voiceCache;
    const remote = { listVoices: vi.fn(async () => { const { ElevenLabsError } = await import("@/server/integrations/elevenlabs/errors"); throw new ElevenLabsError("rate_limited", "limit"); }) };
    await expect(listVoices({ search: "fail" }, remote as never)).rejects.toMatchObject({ code: "elevenlabs_rate_limited", status: 429 });
  });
  it("validates preview input before calling ElevenLabs", async () => {
    const remote = { textToSpeech: vi.fn() };
    await expect(previewVoice("bad id!", "hi", remote as never)).rejects.toThrow();
    await expect(previewVoice("voice_abc123", " ", remote as never)).rejects.toThrow();
    await expect(previewVoice("voice_abc123", "x".repeat(301), remote as never)).rejects.toThrow();
    expect(remote.textToSpeech).not.toHaveBeenCalled();
  });
});
