import { describe, expect, it, vi } from "vitest";
import { GroqProvider } from "@/server/generation/groq";
import { GenerationError } from "@/server/generation/provider";

const fail = (p: Promise<unknown>) => p.catch((x) => x) as Promise<GenerationError>;

describe("GroqProvider", () => {
  const opts = {
    apiKey: "gsk_secret_123",
    model: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai",
    timeoutMs: 500,
  };
  const req = {
    system: "You are an agent generator",
    user: "Create a dental receptionist",
    toolName: "save_draft",
    toolDescription: "Saves the generated draft",
    schema: { type: "object", properties: { name: { type: "string" } } },
  };
  const f = (status: number, body: unknown) =>
    vi.fn(async (_u: unknown, _i?: RequestInit) => new Response(JSON.stringify(body), { status }));

  it("builds a Chat Completions API request with tool_choice and returns the tool arguments", async () => {
    const fx = f(200, {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  name: "save_draft",
                  arguments: JSON.stringify({ name: "DentalCare Receptionist" }),
                },
              },
            ],
          },
        },
      ],
    });

    const res = await new GroqProvider({ ...opts, fetchImpl: fx as unknown as typeof fetch }).generate(req);
    expect(res).toEqual({ name: "DentalCare Receptionist" });

    const [url, init] = fx.mock.calls[0]!;
    expect(String(url)).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((init?.headers as Record<string, string>)["Authorization"]).toBe("Bearer gsk_secret_123");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "llama-3.3-70b-versatile",
      tool_choice: { type: "function", function: { name: "save_draft" } },
      tools: [
        {
          type: "function",
          function: { name: "save_draft", parameters: req.schema },
        },
      ],
    });
  });

  it.each([
    [401, "auth"],
    [429, "rate_limited"],
    [500, "upstream"],
  ] as const)("maps HTTP %i to %s", async (s, kind) => {
    const e = (await new GroqProvider({
      ...opts,
      fetchImpl: f(s, {}) as unknown as typeof fetch,
    })
      .generate(req)
      .catch((x) => x)) as GenerationError;
    expect(e.kind).toBe(kind);
    expect(e.message).not.toContain("gsk_secret_123");
  });

  it("reports not_configured without a network call, and malformed responses", async () => {
    const fx = f(200, {});
    expect(
      (
        await fail(
          new GroqProvider({ ...opts, apiKey: undefined, fetchImpl: fx as unknown as typeof fetch }).generate(req),
        )
      ).kind,
    ).toBe("not_configured");
    expect(fx).not.toHaveBeenCalled();

    expect(
      (
        await fail(
          new GroqProvider({
            ...opts,
            fetchImpl: f(200, { choices: [{ message: { content: "No tools" } }] }) as unknown as typeof fetch,
          }).generate(req),
        )
      ).kind,
    ).toBe("malformed");
  });

  it("reports network failure and timeout", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("Connection refused");
    });
    expect((await fail(new GroqProvider({ ...opts, fetchImpl: down as unknown as typeof fetch }).generate(req))).kind).toBe(
      "network",
    );

    const hang = vi.fn(
      (_u: unknown, i?: RequestInit) =>
        new Promise<Response>((_r, rej) =>
          i?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))),
        ),
    );
    expect((await fail(new GroqProvider({ ...opts, fetchImpl: hang as unknown as typeof fetch }).generate(req))).kind).toBe(
      "timeout",
    );
  });
});
