import { z } from "zod";
import { agentConfigSchema, draftToConfig, mergeCapabilities, fieldErrorsOf, generatedDraftSchema, type AgentConfig } from "../agents/config-schema";
import { diffConfig, type ConfigChange } from "../agents/diff";
import { getStarter } from "../agents/starters";
import { loadConfig } from "../config/env";
import { ValidationError } from "../errors";
import { logger } from "../logger";
import { AnthropicProvider } from "./anthropic";
import { GenerationError, type GenerationProvider } from "./provider";

export function getProvider(): GenerationProvider {
  const g = loadConfig().generation;
  return new AnthropicProvider({ apiKey: g.apiKey, model: g.model, baseUrl: g.baseUrl, timeoutMs: g.timeoutMs });
}

const DRAFT_JSON_SCHEMA = () => z.toJSONSchema(generatedDraftSchema) as Record<string, unknown>;

const RULES = `You turn a business owner's plain-language description into a voice agent configuration.
Rules:
- Use only facts the user wrote. Never invent prices, hours, policies, addresses, names of staff or availability. If the agent needs a fact that was not given, do NOT make one up: write an item in openQuestions and tell the agent in its instructions to say it does not know and offer a human follow-up.
- Capture every language the user asked for as a language code (primary plus additional). If none was named, use "en".
- If the user wants the agent to do something that needs a connected system (booking, payments, sending messages, looking up records), list it in requestedCapabilities. Do not write instructions that claim the agent can already do it.
- Put urgent or sensitive situations the user mentioned in guardrails.escalationConditions.
- Write the welcomeMessage as the first thing the agent says. Keep it short and natural.
- Write instructions in second person, clear enough for a language model to follow.
- Do not choose a voice.`;

function check(raw: unknown): ReturnType<typeof generatedDraftSchema.parse> {
  const parsed = generatedDraftSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn("generation output failed validation", { paths: parsed.error.issues.map((i) => i.path.join(".")) });
    throw new GenerationError("invalid_output", "The model returned a configuration that did not pass validation. Nothing was saved. Try again or rephrase your description.");
  }
  return parsed.data;
}

export interface GenerateInput {
  prompt: string;
  useCase?: string;
}

export async function generateAgentConfig(input: GenerateInput, provider: GenerationProvider = getProvider()): Promise<{ config: AgentConfig; openQuestions: string[] }> {
  const max = loadConfig().generation.promptMaxChars;
  const prompt = (input.prompt ?? "").trim();
  if (!prompt) throw new ValidationError("Describe the agent you want.", { prompt: ["Required."] });
  if (prompt.length > max) throw new ValidationError(`Description is too long (limit ${max} characters).`, { prompt: [`Must be ${max} characters or fewer.`] });
  const starter = getStarter(input.useCase);
  if (input.useCase && !starter) throw new ValidationError("Unknown use case.", { useCase: ["Choose one of the listed starters."] });

  const raw = await provider.generate({
    system: RULES + (starter ? `\n\nUse-case guidance (${starter.label}): ${starter.guidance}` : ""),
    user: `Business owner's description:\n"""\n${prompt}\n"""`,
    toolName: "submit_agent_configuration",
    toolDescription: "Submit the structured voice agent configuration.",
    schema: DRAFT_JSON_SCHEMA(),
  });
  const draft = check(raw);
  const config = draftToConfig(draft);
  const final = agentConfigSchema.safeParse(config);
  if (!final.success) throw new GenerationError("invalid_output", "The generated configuration failed validation.");
  return { config: final.data, openQuestions: draft.openQuestions };
}

export interface RefineResult {
  proposed: AgentConfig;
  changes: ConfigChange[];
  openQuestions: string[];
}

export async function proposeRefinement(input: { config: unknown; instruction: string }, provider: GenerationProvider = getProvider()): Promise<RefineResult> {
  const instruction = (input.instruction ?? "").trim();
  if (!instruction) throw new ValidationError("Describe the change you want.", { instruction: ["Required."] });
  if (instruction.length > 1000) throw new ValidationError("Instruction is too long.", { instruction: ["Must be 1000 characters or fewer."] });
  const current = agentConfigSchema.safeParse(input.config);
  if (!current.success) throw new ValidationError("The current configuration is invalid.", fieldErrorsOf(current.error));

  const raw = await provider.generate({
    system: RULES + "\n\nYou are REVISING an existing configuration. Return the complete revised configuration. Change only what the instruction requires and keep every other field exactly as it is. If the instruction is ambiguous, make the smallest reasonable change and add a question to openQuestions.",
    user: `Current configuration (JSON):\n${JSON.stringify({ ...current.data, voice: undefined, capabilities: undefined, requestedCapabilities: current.data.capabilities.map((c) => ({ name: c.name, description: c.description, needsMoreInformation: c.status === "needs_information" })) })}\n\nRequested change:\n"""\n${instruction}\n"""`,
    toolName: "submit_agent_configuration",
    toolDescription: "Submit the revised structured voice agent configuration.",
    schema: DRAFT_JSON_SCHEMA(),
  });
  const draft = check(raw);
  const proposed = agentConfigSchema.parse({ ...draftToConfig(draft, current.data.voice), capabilities: mergeCapabilities(current.data.capabilities, draft.requestedCapabilities) });
  return { proposed, changes: diffConfig(current.data, proposed), openQuestions: draft.openQuestions };
}
