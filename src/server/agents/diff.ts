import type { AgentConfig } from "./config-schema";

export interface ConfigChange {
  path: string;
  label: string;
  before: string;
  after: string;
}

const LABELS: Record<string, string> = {
  "identity.name": "Name", "identity.description": "Description", "identity.role": "Role",
  "behavior.purpose": "Purpose", "behavior.goals": "Goals", "behavior.welcomeMessage": "Welcome message",
  "behavior.instructions": "Instructions", "behavior.tone": "Tone", "behavior.responseStyle": "Response style",
  "knowledge.sources": "Information sources", "knowledge.mustNotInvent": "Must not invent",
  "guardrails.prohibitedActions": "Prohibited actions", "guardrails.restrictedInformation": "Restricted information",
  "guardrails.escalationConditions": "Escalation conditions", "guardrails.uncertaintyRules": "Uncertainty rules",
  "language.primary": "Primary language", "language.additional": "Additional languages",
  "voice.voiceId": "Voice", "voice.stability": "Voice stability", "voice.speed": "Voice speed", "capabilities": "Requested capabilities",
};

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, stable(x)]));
  return v;
}
export const canonical = (c: unknown) => JSON.stringify(stable(c));
export const sameConfig = (a: unknown, b: unknown) => canonical(a) === canonical(b);

const show = (v: unknown): string => (v === undefined || v === null || v === "" ? "(empty)" : Array.isArray(v) ? (v.length ? v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("; ") : "(empty)") : String(v));

export function diffConfig(before: AgentConfig, after: AgentConfig): ConfigChange[] {
  const out: ConfigChange[] = [];
  const walk = (a: unknown, b: unknown, path: string) => {
    const leaf = path in LABELS || path === "capabilities";
    if (!leaf && a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k);
      return;
    }
    if (canonical(a) !== canonical(b)) out.push({ path, label: LABELS[path] ?? path, before: show(a), after: show(b) });
  };
  walk(before, after, "");
  return out;
}

export const summarize = (changes: ConfigChange[]): string =>
  changes.length === 0 ? "No changes" : `Changed ${changes.map((c) => c.label.toLowerCase()).slice(0, 6).join(", ")}${changes.length > 6 ? ` and ${changes.length - 6} more` : ""}`;
