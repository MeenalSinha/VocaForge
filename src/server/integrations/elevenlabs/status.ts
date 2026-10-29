import { loadConfig } from "../../config/env";
import { ElevenLabsClient } from "./client";
import { isElevenLabsError, type ElevenLabsErrorKind } from "./errors";

export type IntegrationState =
  | "not_configured"
  | "unverified"
  | "connected"
  | "auth_failed"
  | "permission_denied"
  | "rate_limited"
  | "unavailable"
  | "error";

export interface IntegrationStatus {
  state: IntegrationState;
  message: string;
  checkedAt: string | null;
  baseUrl: string;
}

const MESSAGES: Record<IntegrationState, string> = {
  not_configured: "ELEVENLABS_API_KEY is not set. Add it to your server environment (see .env.example) and restart.",
  unverified: "A key is configured but has not been verified yet. Run a connection check.",
  connected: "Authenticated against the ElevenLabs Agents API.",
  auth_failed: "ElevenLabs rejected the configured API key. Create a new key and update ELEVENLABS_API_KEY.",
  permission_denied: "The key authenticated but lacks agent read permission, or the plan does not include the Agents platform.",
  rate_limited: "ElevenLabs is rate limiting requests. Try again shortly.",
  unavailable: "Could not reach ElevenLabs. Check network access and ELEVENLABS_API_BASE_URL.",
  error: "The connection check failed for an unexpected reason. See server logs.",
};

const KIND_TO_STATE: Record<ElevenLabsErrorKind, IntegrationState> = {
  missing_credentials: "not_configured",
  auth_invalid: "auth_failed",
  permission_denied: "permission_denied",
  rate_limited: "rate_limited",
  network: "unavailable",
  timeout: "unavailable",
  validation: "error",
  unsupported: "error",
  malformed_response: "error",
  upstream: "unavailable",
};

const TTL_MS = 60_000;
const cache = globalThis as unknown as { __elStatus?: IntegrationStatus & { at: number } };

export function configuredStatus(): IntegrationStatus {
  const cfg = loadConfig().elevenlabs;
  const state: IntegrationState = cfg.configured ? "unverified" : "not_configured";
  return { state, message: MESSAGES[state], checkedAt: null, baseUrl: cfg.baseUrl };
}

/** Performs a real authenticated request. Results are cached briefly to avoid hammering the API. */
export async function checkElevenLabs(opts: { force?: boolean; client?: ElevenLabsClient } = {}): Promise<IntegrationStatus> {
  const cfg = loadConfig().elevenlabs;
  if (!cfg.configured) return configuredStatus();
  const hit = cache.__elStatus;
  if (!opts.force && hit && Date.now() - hit.at < TTL_MS) return hit;

  const client = opts.client ?? new ElevenLabsClient({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, timeoutMs: 6000 });
  let state: IntegrationState;
  try {
    await client.verifyAuth();
    state = "connected";
  } catch (err) {
    state = isElevenLabsError(err) ? KIND_TO_STATE[err.kind] : "error";
  }
  const status = { state, message: MESSAGES[state], checkedAt: new Date().toISOString(), baseUrl: cfg.baseUrl, at: Date.now() };
  cache.__elStatus = status;
  return status;
}
