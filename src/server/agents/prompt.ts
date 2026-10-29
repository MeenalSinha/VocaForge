import type { AgentConfig } from "./config-schema";
import type { AgentRemotePayload } from "../integrations/elevenlabs/schemas";

const bullets = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
const section = (title: string, body: string) => (body.trim() ? `# ${title}\n${body.trim()}\n\n` : "");

/** Deterministically assembles the agent's system prompt from configuration. It adds no business facts. */
export function composeSystemPrompt(c: AgentConfig): string {
  const unavailable = c.capabilities; // every capability is unavailable or needs information until an integration exists
  const extraLanguages = c.language.additional.length ? `Also be able to converse in: ${c.language.additional.join(", ")}. Reply in the language the caller uses when it is one of these.` : "";
  return (
    section("Personality", `You are ${c.identity.name}. ${c.identity.role}\nTone: ${c.behavior.tone}.${c.behavior.responseStyle ? `\nResponse style: ${c.behavior.responseStyle}` : ""}`) +
    section("Purpose", c.behavior.purpose) +
    section("Goals", bullets(c.behavior.goals)) +
    section("Instructions", c.behavior.instructions) +
    section("Languages", `Primary language: ${c.language.primary}. ${extraLanguages}`) +
    section("Information you may use", c.knowledge.sources.length ? bullets(c.knowledge.sources) : "Only information the caller gives you during the call.") +
    section("Never invent", `Never make up facts, prices, availability, policies or hours. ${c.knowledge.mustNotInvent.length ? "Specifically:\n" + bullets(c.knowledge.mustNotInvent) : ""}`) +
    section("Never do", bullets(c.guardrails.prohibitedActions)) +
    section("Restricted information", bullets(c.guardrails.restrictedInformation)) +
    section("Escalate to a human when", bullets(c.guardrails.escalationConditions)) +
    section("When you are unsure", c.guardrails.uncertaintyRules || "Say you do not know and offer to pass the question to a human colleague.") +
    section(
      "Things you cannot do",
      unavailable.length
        ? "You are not able to perform the following. Do not claim you did, and do not pretend. Tell the caller plainly and offer a human follow-up:\n" + bullets(unavailable.map((u) => `${u.name}${u.description ? `: ${u.description}` : ""}`))
        : "",
    )
  ).trim();
}

export interface RemoteOptions {
  agentLlm?: string;
  agentTtsModel?: string;
}

/** Maps configuration to the documented ElevenLabs conversation_config subset. */
export function buildRemotePayload(c: AgentConfig, o: RemoteOptions = {}): AgentRemotePayload {
  const payload: AgentRemotePayload = {
    name: c.identity.name,
    conversation_config: {
      agent: {
        language: c.language.primary,
        first_message: c.behavior.welcomeMessage,
        prompt: { prompt: composeSystemPrompt(c), ...(o.agentLlm ? { llm: o.agentLlm } : {}) },
      },
    },
  };
  if (c.voice.voiceId) {
    payload.conversation_config.tts = {
      voice_id: c.voice.voiceId,
      ...(o.agentTtsModel ? { model_id: o.agentTtsModel } : {}),
      ...(c.voice.stability !== undefined ? { stability: c.voice.stability } : {}),
      ...(c.voice.speed !== undefined ? { speed: c.voice.speed } : {}),
    };
  }
  return payload;
}

/** Fields that are stored locally but are NOT sent as dedicated ElevenLabs settings. Shown in the UI so nothing is overstated. */
export function localOnlyNotes(c: AgentConfig): string[] {
  const notes: string[] = [];
  if (c.language.additional.length) notes.push("Additional languages are described in the prompt only. They are not set as separate ElevenLabs language presets.");
  if (c.capabilities.length) notes.push("Requested capabilities are not connected. They are written into the prompt as things the agent cannot do.");
  notes.push("Guardrails and escalation rules are instructions to the model, not enforced by separate technical controls.");
  return notes;
}
