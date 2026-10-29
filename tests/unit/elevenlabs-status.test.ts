import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElevenLabsClient } from "@/server/integrations/elevenlabs/client";
import { ElevenLabsError } from "@/server/integrations/elevenlabs/errors";
import { checkElevenLabs } from "@/server/integrations/elevenlabs/status";

const stub = (impl: () => Promise<void>) => ({ verifyAuth: vi.fn(impl) }) as unknown as ElevenLabsClient;

describe("checkElevenLabs", () => {
  beforeEach(() => { delete (globalThis as { __elStatus?: unknown }).__elStatus; });
  afterEach(() => vi.unstubAllEnvs());

  it("is not_configured without a key and makes no request", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    const c = stub(async () => undefined);
    const s = await checkElevenLabs({ client: c, force: true });
    expect(s.state).toBe("not_configured");
    expect(c.verifyAuth).not.toHaveBeenCalled();
  });

  it("is connected only after a successful real check", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "k");
    expect((await checkElevenLabs({ client: stub(async () => undefined), force: true })).state).toBe("connected");
  });

  it.each([
    ["auth_invalid", "auth_failed"],
    ["permission_denied", "permission_denied"],
    ["rate_limited", "rate_limited"],
    ["network", "unavailable"],
    ["timeout", "unavailable"],
    ["malformed_response", "error"],
  ] as const)("maps %s to %s", async (k, state) => {
    vi.stubEnv("ELEVENLABS_API_KEY", "k");
    const s = await checkElevenLabs({ client: stub(async () => { throw new ElevenLabsError(k, "x"); }), force: true });
    expect(s.state).toBe(state);
  });

  it("caches a result briefly and honours force", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "k");
    const c = stub(async () => undefined);
    await checkElevenLabs({ client: c, force: true });
    await checkElevenLabs({ client: c });
    expect(c.verifyAuth).toHaveBeenCalledTimes(1);
    await checkElevenLabs({ client: c, force: true });
    expect(c.verifyAuth).toHaveBeenCalledTimes(2);
  });
});
