import { z } from "zod";
import { ConfigError } from "../errors";

/**
 * Validated, server-only configuration. Loading never throws and never returns secret
 * values in `issues`; features that need a missing setting call the require* helpers.
 */
const optionalString = z.string().trim().optional().transform((v) => (v ? v : undefined));

const schema = z.object({
  DATABASE_URL: optionalString.refine((v) => !v || /^postgres(ql)?:\/\//.test(v), "must start with postgresql://"),
  DATABASE_SSL: z.enum(["auto", "require", "disable"]).default("auto"),
  ELEVENLABS_API_KEY: optionalString,
  ELEVENLABS_API_BASE_URL: z
    .string()
    .trim()
    .default("https://api.elevenlabs.io")
    .refine((v) => {
      try {
        return new URL(v).protocol === "https:";
      } catch {
        return false;
      }
    }, "must be an https URL"),
  ELEVENLABS_AGENT_LLM: optionalString,
  ELEVENLABS_AGENT_TTS_MODEL: optionalString,
  ELEVENLABS_PREVIEW_MODEL: optionalString,
  GENERATION_PROVIDER: z.enum(["anthropic", "groq"]).default("anthropic"),
  ANTHROPIC_API_KEY: optionalString,
  GROQ_API_KEY: optionalString,
  GENERATION_MODEL: optionalString,
  GENERATION_BASE_URL: z.string().trim().optional().refine((v) => {
    if (!v) return true;
    try { return new URL(v).protocol === "https:"; } catch { return false; }
  }, "must be an https URL"),
  GENERATION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(60000),
  PROMPT_MAX_CHARS: z.coerce.number().int().min(200).max(20000).default(4000),
  VOCAFORGE_ACCESS_TOKEN: optionalString,
  VOCAFORGE_ALLOW_UNAUTHENTICATED: z.enum(["true", "false"]).default("false"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export interface ConfigIssue {
  key: string;
  message: string;
}

export interface AppConfig {
  database: { configured: boolean; url?: string; ssl: "auto" | "require" | "disable" };
  elevenlabs: { configured: boolean; apiKey?: string; baseUrl: string; agentLlm?: string; agentTtsModel?: string; previewModel?: string };
  generation: { provider: "anthropic" | "groq"; configured: boolean; apiKey?: string; model?: string; baseUrl: string; timeoutMs: number; promptMaxChars: number };
  access: { tokenConfigured: boolean; allowUnauthenticated: boolean };
  issues: ConfigIssue[];
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  const issues: ConfigIssue[] = [];
  let data: z.infer<typeof schema>;

  if (parsed.success) {
    data = parsed.data;
  } else {
    for (const i of parsed.error.issues) issues.push({ key: String(i.path[0] ?? "env"), message: i.message });
    // Fall back to defaults for invalid keys so unrelated features keep working.
    const bad = new Set(issues.map((i) => i.key));
    const cleaned = Object.fromEntries(Object.entries(env).filter(([k]) => !bad.has(k)));
    data = schema.parse(cleaned);
  }

  const isGroq = data.GENERATION_PROVIDER === "groq" || Boolean(data.GROQ_API_KEY && !data.ANTHROPIC_API_KEY);
  const genProvider: "anthropic" | "groq" = isGroq ? "groq" : "anthropic";
  const genKey = isGroq ? (data.GROQ_API_KEY || data.ANTHROPIC_API_KEY) : data.ANTHROPIC_API_KEY;
  const defaultModel = isGroq ? "llama-3.3-70b-versatile" : undefined;
  const defaultBaseUrl = isGroq ? "https://api.groq.com/openai" : "https://api.anthropic.com";
  const genModel = data.GENERATION_MODEL || defaultModel;
  const genBaseUrl = (data.GENERATION_BASE_URL || defaultBaseUrl).replace(/\/+$/, "");

  return {
    database: { configured: Boolean(data.DATABASE_URL), url: data.DATABASE_URL, ssl: data.DATABASE_SSL },
    elevenlabs: {
      configured: Boolean(data.ELEVENLABS_API_KEY),
      apiKey: data.ELEVENLABS_API_KEY,
      baseUrl: data.ELEVENLABS_API_BASE_URL.replace(/\/+$/, ""),
      agentLlm: data.ELEVENLABS_AGENT_LLM,
      agentTtsModel: data.ELEVENLABS_AGENT_TTS_MODEL,
      previewModel: data.ELEVENLABS_PREVIEW_MODEL,
    },
    generation: {
      provider: genProvider,
      configured: Boolean(genKey && genModel),
      apiKey: genKey,
      model: genModel,
      baseUrl: genBaseUrl,
      timeoutMs: data.GENERATION_TIMEOUT_MS,
      promptMaxChars: data.PROMPT_MAX_CHARS,
    },
    access: {
      tokenConfigured: Boolean(data.VOCAFORGE_ACCESS_TOKEN),
      allowUnauthenticated: data.VOCAFORGE_ALLOW_UNAUTHENTICATED === "true",
    },
    issues,
  };
}

export function requireDatabaseUrl(config: AppConfig = loadConfig()): string {
  if (config.issues.some((i) => i.key === "DATABASE_URL")) {
    throw new ConfigError("DATABASE_URL is invalid. It must be a postgresql:// connection string.");
  }
  if (!config.database.url) {
    throw new ConfigError("DATABASE_URL is not set. Copy .env.example to .env.local and set it.");
  }
  return config.database.url;
}
