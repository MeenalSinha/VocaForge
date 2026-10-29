import { AppError } from "../errors";

export type GenerationErrorKind = "not_configured" | "auth" | "rate_limited" | "timeout" | "network" | "upstream" | "malformed" | "invalid_output";

export class GenerationError extends AppError {
  constructor(public readonly kind: GenerationErrorKind, message: string) {
    super(`generation_${kind}`, kind === "not_configured" ? 503 : kind === "rate_limited" ? 429 : kind === "timeout" ? 504 : kind === "invalid_output" || kind === "malformed" ? 502 : 502, message);
  }
}

export interface StructuredRequest {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  /** JSON Schema for the structured result. */
  schema: Record<string, unknown>;
}

/** Any model backend that can return JSON matching a schema. Output is always re-validated by the caller. */
export interface GenerationProvider {
  generate(req: StructuredRequest): Promise<unknown>;
}
