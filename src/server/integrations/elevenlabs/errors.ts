export type ElevenLabsErrorKind =
  | "missing_credentials"
  | "auth_invalid"
  | "permission_denied"
  | "rate_limited"
  | "network"
  | "timeout"
  | "validation"
  | "unsupported"
  | "malformed_response"
  | "upstream";

/** Sanitized integration error. `details` never contains the API key. */
export class ElevenLabsError extends Error {
  constructor(
    public readonly kind: ElevenLabsErrorKind,
    message: string,
    public readonly status?: number,
    public readonly details?: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ElevenLabsError";
  }
}

export const isElevenLabsError = (e: unknown): e is ElevenLabsError => e instanceof ElevenLabsError;
