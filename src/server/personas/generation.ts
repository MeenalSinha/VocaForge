import { z } from "zod";
import { loadConfig } from "../config/env";
import { ValidationError } from "../errors";
import { logger } from "../logger";
import { getProvider } from "../generation/service";
import { GenerationError, type GenerationProvider } from "../generation/provider";
import {
  PERSONA_CATEGORIES,
  type PersonaCategory,
  type PersonaConfig,
  personaConfigSchema,
} from "./schema";
import { getPersonaTemplate } from "./templates";

const langCode = z
  .string()
  .trim()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Use a 2-letter language code like 'en' or 'en-US'.");

export const generatedPersonaDraftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(""),
  category: z.enum(PERSONA_CATEGORIES).default("custom"),
  background: z.string().trim().max(2000).default(""),
  personality: z
    .object({
      traits: z.array(z.string().trim()).max(20).default([]),
      communicationStyle: z.string().trim().max(500).default("conversational"),
      patienceLevel: z.number().int().min(1).max(5).default(3),
      assertivenessLevel: z.number().int().min(1).max(5).default(3),
      familiarityLevel: z.number().int().min(1).max(5).default(2),
      emotionalResponses: z
        .object({
          onConfusion: z.string().trim().max(300).default("Asks for clarification"),
          onDelays: z.string().trim().max(300).default("Follows up politely"),
          onRepetition: z.string().trim().max(300).default("Notes they already answered"),
        })
        .default({
          onConfusion: "Asks for clarification",
          onDelays: "Follows up politely",
          onRepetition: "Notes they already answered",
        }),
      mindChangeProbability: z.number().min(0).max(100).default(10),
    })
    .default({
      traits: [],
      communicationStyle: "conversational",
      patienceLevel: 3,
      assertivenessLevel: 3,
      familiarityLevel: 2,
      emotionalResponses: {
        onConfusion: "Asks for clarification",
        onDelays: "Follows up politely",
        onRepetition: "Notes they already answered",
      },
      mindChangeProbability: 10,
    }),
  knowledge: z
    .object({
      level: z.enum(["none", "basic", "intermediate", "expert"]).default("basic"),
      assumptions: z.array(z.string().trim()).max(20).default([]),
      withheldInfo: z.array(z.string().trim()).max(20).default([]),
    })
    .default({ level: "basic", assumptions: [], withheldInfo: [] }),
  language: z
    .object({
      primary: langCode.default("en"),
      additional: z.array(langCode).max(10).default([]),
      switchLanguageProbability: z.number().min(0).max(100).default(0),
    })
    .default({ primary: "en", additional: [], switchLanguageProbability: 0 }),
  startingContext: z
    .object({
      situation: z.string().trim().max(1000).default(""),
      initialUtterance: z.string().trim().max(500).default(""),
    })
    .default({ situation: "", initialUtterance: "" }),
  defaultObjective: z
    .object({
      intent: z.string().trim().max(500).default(""),
      mustAchieve: z.array(z.string().trim()).max(20).default([]),
    })
    .default({ intent: "", mustAchieve: [] }),
  behavioralConstraints: z
    .object({
      rules: z.array(z.string().trim()).max(30).default([]),
      stopConditions: z.array(z.string().trim()).max(20).default([]),
    })
    .default({ rules: [], stopConditions: [] }),
  openQuestions: z.array(z.string().trim()).max(10).default([]),
});

export type GeneratedPersonaDraft = z.infer<typeof generatedPersonaDraftSchema>;

const PERSONA_DRAFT_JSON_SCHEMA = () =>
  z.toJSONSchema(generatedPersonaDraftSchema) as Record<string, unknown>;

const PERSONA_GENERATION_RULES = `You turn a user's plain-language description of a simulated customer into a structured virtual customer persona configuration.
Rules:
- Capture realistic human personality traits (e.g. impatient, confused, analytical, bargain-hunting, price-sensitive).
- Provide patienceLevel (1=very low to 5=very patient), assertivenessLevel (1=passive to 5=very demanding), and familiarityLevel (1=first-timer to 5=expert).
- Specify communicationStyle with concrete speaking habits (e.g., interrupts, speaks slowly, uses slang).
- In startingContext, create a believable initial situation and a natural initialUtterance that the customer says when the call connects.
- In defaultObjective, clearly state what the customer is trying to accomplish (intent) and what concrete deliverables they must achieve.
- In behavioralConstraints, specify behavioral rules (e.g. "Do not disclose last name until asked", "Become annoyed if asked same question twice") and stop conditions.
- If the user mentioned specific language preferences or bilingual code-switching, configure primary and additional language codes.
- Never invent business facts (prices, doctor names, hours, policies). If the prompt assumes facts about a business, put questions in openQuestions.`;

function checkPersonaDraft(raw: unknown): GeneratedPersonaDraft {
  const parsed = generatedPersonaDraftSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn("persona generation output failed validation", {
      paths: parsed.error.issues.map((i) => i.path.join(".")),
    });
    throw new GenerationError(
      "invalid_output",
      "The model returned a persona configuration that did not pass validation. Nothing was saved. Try again or rephrase your description.",
    );
  }
  return parsed.data;
}

export interface GeneratePersonaInput {
  prompt: string;
  category?: PersonaCategory;
  templateId?: string;
}

export interface GeneratedPersonaResult {
  name: string;
  description: string;
  category: PersonaCategory;
  config: PersonaConfig;
  openQuestions: string[];
}

export async function generatePersonaConfig(
  input: GeneratePersonaInput,
  provider: GenerationProvider = getProvider(),
): Promise<GeneratedPersonaResult> {
  const max = loadConfig().generation.promptMaxChars;
  const prompt = (input.prompt ?? "").trim();
  if (!prompt) {
    throw new ValidationError("Describe the virtual customer you want.", {
      prompt: ["Required."],
    });
  }
  if (prompt.length > max) {
    throw new ValidationError(`Description is too long (limit ${max} characters).`, {
      prompt: [`Must be ${max} characters or fewer.`],
    });
  }

  const template = getPersonaTemplate(input.templateId);
  const templateContext = template
    ? `\nBase Template (${template.name} - ${template.category}): ${template.description}`
    : "";

  const raw = await provider.generate({
    system: PERSONA_GENERATION_RULES + templateContext,
    user: `User's requested virtual customer:\n"""\n${prompt}\n"""`,
    toolName: "submit_virtual_customer_persona",
    toolDescription: "Submit the structured virtual customer persona configuration.",
    schema: PERSONA_DRAFT_JSON_SCHEMA(),
  });

  const draft = checkPersonaDraft(raw);

  const config = personaConfigSchema.parse({
    background: draft.background,
    personality: draft.personality,
    knowledge: draft.knowledge,
    language: draft.language,
    startingContext: draft.startingContext,
    defaultObjective: draft.defaultObjective,
    behavioralConstraints: draft.behavioralConstraints,
  });

  return {
    name: draft.name,
    description: draft.description,
    category: input.category || draft.category || "custom",
    config,
    openQuestions: draft.openQuestions,
  };
}

