import { GenerationError, type GenerationProvider, type StructuredRequest } from "./provider";

export interface AnthropicOptions {
  apiKey: string | undefined;
  model: string | undefined;
  baseUrl: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

/** Anthropic Messages API with a forced tool call, which returns schema-shaped JSON. Server-side only. */
export class AnthropicProvider implements GenerationProvider {
  constructor(private readonly o: AnthropicOptions) {}

  async generate(req: StructuredRequest): Promise<unknown> {
    if (!this.o.apiKey || !this.o.model) {
      throw new GenerationError("not_configured", "The generation provider is not configured. Set ANTHROPIC_API_KEY and GENERATION_MODEL on the server.");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.o.timeoutMs);
    let res: Response;
    try {
      res = await (this.o.fetchImpl ?? fetch)(`${this.o.baseUrl}/v1/messages`, {
        method: "POST",
        headers: { "x-api-key": this.o.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: this.o.model,
          max_tokens: 4096,
          system: req.system,
          messages: [{ role: "user", content: req.user }],
          tools: [{ name: req.toolName, description: req.toolDescription, input_schema: req.schema }],
          tool_choice: { type: "tool", name: req.toolName },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") throw new GenerationError("timeout", "The generation provider did not respond in time.");
      throw new GenerationError("network", "Could not reach the generation provider.");
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401 || res.status === 403) throw new GenerationError("auth", "The generation provider rejected the configured API key.");
    if (res.status === 429) throw new GenerationError("rate_limited", "The generation provider is rate limiting requests. Try again shortly.");
    if (!res.ok) throw new GenerationError("upstream", `The generation provider returned an error (HTTP ${res.status}).`);
    let body: { content?: { type: string; name?: string; input?: unknown }[] };
    try {
      body = await res.json();
    } catch {
      throw new GenerationError("malformed", "The generation provider returned a response that is not valid JSON.");
    }
    const block = body.content?.find((b) => b.type === "tool_use" && b.name === req.toolName);
    if (!block) throw new GenerationError("malformed", "The generation provider did not return a structured result.");
    return block.input;
  }
}
