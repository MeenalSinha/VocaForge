/** Minimal structured logger that redacts secrets before anything is written. */
type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSITIVE_KEY = /key|token|password|secret|authorization|cookie|database_url|connection/i;
const URL_CREDENTIALS = /(\w+:\/\/)([^:@/\s]+):([^@/\s]+)@/g;

export function redactString(value: string): string {
  return value.replace(URL_CREDENTIALS, "$1$2:[redacted]@");
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[truncated]";
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1),
      ]),
    );
  }
  return value;
}

export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: redactString(err.message), stack: err.stack ? redactString(err.stack) : undefined };
  }
  return { value: redact(err) };
}

function threshold(): number {
  const level = (process.env.LOG_LEVEL ?? "info") as Level;
  return order[level] ?? order.info;
}

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (order[level] < threshold() || process.env.VITEST) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...(redact(fields ?? {}) as object) });
  (level === "error" || level === "warn" ? console.error : console.log)(line);
}

export const logger = {
  debug: (msg: string, f?: Record<string, unknown>) => emit("debug", msg, f),
  info: (msg: string, f?: Record<string, unknown>) => emit("info", msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => emit("warn", msg, f),
  error: (msg: string, f?: Record<string, unknown>) => emit("error", msg, f),
};
