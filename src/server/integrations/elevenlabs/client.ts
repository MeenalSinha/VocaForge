import type { ZodType } from "zod";
import { ElevenLabsError } from "./errors";
import {
  agentCreatedSchema,
  remoteAgentSchema,
  signedUrlSchema,
  voicesPageSchema,
  type AgentRemotePayload,
  type RemoteAgent,
  type VoicesPage,
  createAgentInputSchema,
  createSimulationTestInputSchema,
  invocationSchema,
  objectSchema,
  testCreatedSchema,
  type CreateAgentInput,
  type CreateSimulationTestInput,
  type TestInvocation,
} from "./schemas";

export interface ElevenLabsClientOptions {
  apiKey: string | undefined;
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface RequestOptions<T> {
  query?: Record<string, string | number>;
  body?: unknown;
  schema: ZodType<T>;
}

/**
 * Thin, typed wrapper over the documented ElevenLabs Agents REST API.
 * Server-side only: the API key is sent in the `xi-api-key` header and never logged or returned.
 */
export class ElevenLabsClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly opts: ElevenLabsClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 15000;
  }

  private scrub(text: string): string {
    const key = this.opts.apiKey;
    let out = key ? text.split(key).join("[redacted]") : text;
    out = out.replace(/sk_[A-Za-z0-9]{8,}/g, "[redacted]");
    return out.slice(0, 500);
  }

  private async request<T>(method: string, path: string, o: RequestOptions<T>): Promise<T> {
    if (!this.opts.apiKey) {
      throw new ElevenLabsError("missing_credentials", "ELEVENLABS_API_KEY is not set on the server.");
    }
    const url = new URL(this.opts.baseUrl + path);
    for (const [k, v] of Object.entries(o.query ?? {})) url.searchParams.set(k, String(v));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers: { "xi-api-key": this.opts.apiKey, "content-type": "application/json", accept: "application/json" },
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new ElevenLabsError("timeout", `ElevenLabs did not respond within ${this.timeoutMs} ms.`);
      }
      throw new ElevenLabsError("network", "Could not reach the ElevenLabs API.", undefined, this.scrub(String((err as Error).message)));
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    if (!res.ok) throw this.toError(res, text);

    let json: unknown = {};
    if (text.trim()) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new ElevenLabsError("malformed_response", "ElevenLabs returned a response that is not valid JSON.", res.status);
      }
    }
    const parsed = o.schema.safeParse(json);
    if (!parsed.success) {
      throw new ElevenLabsError(
        "malformed_response",
        "ElevenLabs returned a response in an unexpected shape.",
        res.status,
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      );
    }
    return parsed.data;
  }

  private toError(res: Response, text: string): ElevenLabsError {
    let detail = text;
    try {
      const j = JSON.parse(text) as { detail?: unknown };
      detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j);
    } catch {
      /* keep raw text */
    }
    const details = this.scrub(detail);
    const s = res.status;
    if (s === 401) return new ElevenLabsError("auth_invalid", "ElevenLabs rejected the API key.", s, details);
    if (s === 403) return new ElevenLabsError("permission_denied", "The API key lacks permission for this operation, or the plan does not include it.", s, details);
    if (s === 404 || s === 405 || s === 410) return new ElevenLabsError("unsupported", "ElevenLabs does not support this operation at this endpoint (not found, or removed).", s, details);
    if (s === 429) {
      const retry = Number(res.headers.get("retry-after"));
      return new ElevenLabsError("rate_limited", "ElevenLabs rate limit or concurrency limit reached.", s, details, Number.isFinite(retry) && retry > 0 ? retry : undefined);
    }
    if (s === 400 || s === 422) return new ElevenLabsError("validation", "ElevenLabs rejected the request as invalid.", s, details);
    return new ElevenLabsError("upstream", `ElevenLabs returned an error (HTTP ${s}).`, s, details);
  }

  private async requestBinary(method: string, path: string, body: unknown): Promise<{ audio: ArrayBuffer; contentType: string }> {
    if (!this.opts.apiKey) throw new ElevenLabsError("missing_credentials", "ELEVENLABS_API_KEY is not set on the server.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(new URL(this.opts.baseUrl + path), {
        method,
        headers: { "xi-api-key": this.opts.apiKey, "content-type": "application/json", accept: "audio/mpeg" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") throw new ElevenLabsError("timeout", `ElevenLabs did not respond within ${this.timeoutMs} ms.`);
      throw new ElevenLabsError("network", "Could not reach the ElevenLabs API.", undefined, this.scrub(String((err as Error).message)));
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw this.toError(res, await res.text());
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("audio/")) throw new ElevenLabsError("malformed_response", "ElevenLabs did not return audio.", res.status);
    return { audio: await res.arrayBuffer(), contentType };
  }

  /** Lightweight authenticated read. Needs a key with agent read access. */
  async verifyAuth(): Promise<void> {
    await this.request("GET", "/v1/convai/agents", { query: { page_size: 1 }, schema: objectSchema });
  }

  async createAgent(input: CreateAgentInput): Promise<{ agentId: string }> {
    const v = createAgentInputSchema.parse(input);
    const body = {
      name: v.name,
      conversation_config: {
        agent: {
          language: v.language,
          ...(v.firstMessage ? { first_message: v.firstMessage } : {}),
          prompt: { prompt: v.prompt, ...(v.llm ? { llm: v.llm } : {}) },
        },
      },
    };
    const res = await this.request("POST", "/v1/convai/agents/create", { body, schema: agentCreatedSchema });
    return { agentId: res.agent_id };
  }

  async deleteAgent(agentId: string): Promise<void> {
    await this.request("DELETE", `/v1/convai/agents/${encodeURIComponent(agentId)}`, { schema: objectSchema });
  }

  async createSimulationTest(input: CreateSimulationTestInput): Promise<{ testId: string }> {
    const v = createSimulationTestInputSchema.parse(input);
    const body = {
      name: v.name,
      type: "simulation",
      simulation_scenario: v.scenario,
      success_conditions: v.successConditions,
      simulation_max_turns: v.maxTurns,
      ...(v.evaluationModel ? { evaluation_model: v.evaluationModel } : {}),
      ...(v.simulatedUserModel ? { simulated_user_model: v.simulatedUserModel } : {}),
    };
    const res = await this.request("POST", "/v1/convai/agent-testing/create", { body, schema: testCreatedSchema });
    return { testId: res.id };
  }

  async deleteTest(testId: string): Promise<void> {
    await this.request("DELETE", `/v1/convai/agent-testing/${encodeURIComponent(testId)}`, { schema: objectSchema });
  }

  async runTests(agentId: string, testIds: string[]): Promise<TestInvocation> {
    if (testIds.length === 0) throw new ElevenLabsError("validation", "At least one test id is required.");
    return this.request("POST", `/v1/convai/agents/${encodeURIComponent(agentId)}/run-tests`, {
      body: { tests: testIds.map((test_id) => ({ test_id })) },
      schema: invocationSchema,
    });
  }

  async getTestInvocation(invocationId: string): Promise<TestInvocation> {
    return this.request("GET", `/v1/convai/test-invocations/${encodeURIComponent(invocationId)}`, { schema: invocationSchema });
  }

  /** Create an agent from an already-built payload (see agents/remote-payload.ts). */
  async createAgentFromPayload(payload: AgentRemotePayload): Promise<{ agentId: string }> {
    const res = await this.request("POST", "/v1/convai/agents/create", { body: payload, schema: agentCreatedSchema });
    return { agentId: res.agent_id };
  }

  async getAgent(agentId: string): Promise<RemoteAgent> {
    return this.request("GET", `/v1/convai/agents/${encodeURIComponent(agentId)}`, { schema: remoteAgentSchema });
  }

  /** PATCH merges the provided conversation_config subset into the existing agent. */
  async updateAgent(agentId: string, payload: AgentRemotePayload): Promise<void> {
    await this.request("PATCH", `/v1/convai/agents/${encodeURIComponent(agentId)}`, { body: payload, schema: objectSchema });
  }

  async listVoices(q: { search?: string; pageToken?: string; pageSize?: number; category?: string } = {}): Promise<VoicesPage> {
    const query: Record<string, string | number> = { page_size: q.pageSize ?? 30 };
    if (q.search) query.search = q.search;
    if (q.pageToken) query.next_page_token = q.pageToken;
    if (q.category) query.category = q.category;
    return this.request("GET", "/v2/voices", { query, schema: voicesPageSchema });
  }

  /** Generates real speech for a voice preview. Consumes characters from the account quota. */
  async textToSpeech(voiceId: string, text: string, modelId?: string): Promise<{ audio: ArrayBuffer; contentType: string }> {
    return this.requestBinary("POST", `/v1/text-to-speech/${encodeURIComponent(voiceId)}`, { text, ...(modelId ? { model_id: modelId } : {}) });
  }

  async getSignedUrl(agentId: string): Promise<string> {
    const res = await this.request("GET", "/v1/convai/conversation/get-signed-url", { query: { agent_id: agentId }, schema: signedUrlSchema });
    return res.signed_url;
  }
}
