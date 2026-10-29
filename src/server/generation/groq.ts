import { GenerationError, type GenerationProvider, type StructuredRequest } from "./provider";

export interface GroqOptions {
  apiKey: string | undefined;
  model: string | undefined;
  baseUrl?: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

/** Groq OpenAI-compatible Chat Completions API with forced tool call. Server-side only. */
export class GroqProvider implements GenerationProvider {
  constructor(private readonly o: GroqOptions) {}

  async generate(req: StructuredRequest): Promise<unknown> {
    if (!this.o.apiKey) {
      throw new GenerationError(
        "not_configured",
        "The generation provider is not configured. Set GROQ_API_KEY and GENERATION_MODEL on the server.",
      );
    }
    const model = this.o.model || "openai/gpt-oss-120b";
    const baseUrl = (this.o.baseUrl || "https://api.groq.com/openai").replace(/\/+$/, "");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.o.timeoutMs);
    let res: Response;
    try {
      res = await (this.o.fetchImpl ?? fetch)(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.o.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: req.toolName,
                description: req.toolDescription,
                parameters: req.schema,
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: req.toolName },
          },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new GenerationError("timeout", "The Groq generation provider did not respond in time.");
      }
      throw new GenerationError("network", "Could not reach the Groq generation provider.");
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401 || res.status === 403) {
      throw new GenerationError("auth", "Groq rejected the configured API key.");
    }
    if (res.status === 429) {
      throw new GenerationError("rate_limited", "Groq is rate limiting requests. Try again shortly.");
    }
    if (!res.ok) {
      throw new GenerationError("upstream", `Groq returned an error (HTTP ${res.status}).`);
    }

    let body: {
      choices?: Array<{
        message?: {
          tool_calls?: Array<{
            function?: {
              name?: string;
              arguments?: string;
            };
          }>;
        };
      }>;
    };

    try {
      body = await res.json();
    } catch {
      throw new GenerationError("malformed", "Groq returned a response that is not valid JSON.");
    }

    const toolCall = body.choices?.[0]?.message?.tool_calls?.find((t) => t.function?.name === req.toolName);
    if (!toolCall?.function?.arguments) {
      throw new GenerationError("malformed", "Groq did not return a structured tool result.");
    }

    try {
      return JSON.parse(toolCall.function.arguments);
    } catch {
      throw new GenerationError("malformed", "Groq returned a tool call with invalid JSON arguments.");
    }
  }
}

