import { z } from "zod";

export const PERSONA_CATEGORIES = [
  "customer_experience",
  "pricing_policies",
  "communication",
  "support",
  "custom",
] as const;
export type PersonaCategory = (typeof PERSONA_CATEGORIES)[number];

export const PERSONA_STATUSES = [
  "draft",
  "needs_configuration",
  "ready_for_testing",
  "archived",
] as const;
export type PersonaStatus = (typeof PERSONA_STATUSES)[number];

export const SCENARIO_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type ScenarioPriority = (typeof SCENARIO_PRIORITIES)[number];

export const SCENARIO_STATUSES = [
  "draft",
  "needs_configuration",
  "ready_for_testing",
  "archived",
] as const;
export type ScenarioStatus = (typeof SCENARIO_STATUSES)[number];

const langCode = z
  .string()
  .trim()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Use a 2-letter language code like 'en' or 'en-US'.");

export const personaConfigSchema = z.object({
  background: z.string().trim().max(2000, "Background is too long (limit 2000 characters).").default(""),
  personality: z
    .object({
      traits: z.array(z.string().trim().min(1)).max(20).default([]),
      communicationStyle: z.string().trim().max(500).default("direct and conversational"),
      patienceLevel: z.number().int().min(1).max(5).default(3),
      assertivenessLevel: z.number().int().min(1).max(5).default(3),
      familiarityLevel: z.number().int().min(1).max(5).default(2),
      emotionalResponses: z
        .object({
          onConfusion: z.string().trim().max(300).default("Asks for clarification politely"),
          onDelays: z.string().trim().max(300).default("Waits a moment, then repeats question"),
          onRepetition: z.string().trim().max(300).default("Expresses annoyance if asked twice"),
        })
        .default({
          onConfusion: "Asks for clarification politely",
          onDelays: "Waits a moment, then repeats question",
          onRepetition: "Expresses annoyance if asked twice",
        }),
      mindChangeProbability: z.number().min(0).max(100).default(10),
    })
    .default({
      traits: [],
      communicationStyle: "direct and conversational",
      patienceLevel: 3,
      assertivenessLevel: 3,
      familiarityLevel: 2,
      emotionalResponses: {
        onConfusion: "Asks for clarification politely",
        onDelays: "Waits a moment, then repeats question",
        onRepetition: "Expresses annoyance if asked twice",
      },
      mindChangeProbability: 10,
    }),
  knowledge: z
    .object({
      level: z.enum(["none", "basic", "intermediate", "expert"]).default("basic"),
      assumptions: z.array(z.string().trim().min(1)).max(20).default([]),
      withheldInfo: z.array(z.string().trim().min(1)).max(20).default([]),
    })
    .default({
      level: "basic",
      assumptions: [],
      withheldInfo: [],
    }),
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
      mustAchieve: z.array(z.string().trim().min(1)).max(20).default([]),
    })
    .default({ intent: "", mustAchieve: [] }),
  behavioralConstraints: z
    .object({
      rules: z.array(z.string().trim().min(1)).max(30).default([]),
      stopConditions: z.array(z.string().trim().min(1)).max(20).default([]),
    })
    .default({ rules: [], stopConditions: [] }),
});

export type PersonaConfig = z.infer<typeof personaConfigSchema>;

export const emptyPersonaConfig = (): PersonaConfig => personaConfigSchema.parse({});

export const createPersonaInputSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  name: z.string().trim().min(1, "Name is required.").max(120, "Name must be 120 characters or fewer."),
  description: z.string().trim().max(2000).optional().default(""),
  category: z.enum(PERSONA_CATEGORIES).default("custom"),
  templateId: z.string().trim().max(80).optional().nullable(),
  config: personaConfigSchema.default(emptyPersonaConfig()),
});
export type CreatePersonaInput = z.infer<typeof createPersonaInputSchema>;

export const updatePersonaInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120, "Name must be 120 characters or fewer.").optional(),
  description: z.string().trim().max(2000).optional(),
  category: z.enum(PERSONA_CATEGORIES).optional(),
  status: z.enum(PERSONA_STATUSES).optional(),
  config: personaConfigSchema.optional(),
});
export type UpdatePersonaInput = z.infer<typeof updatePersonaInputSchema>;

export const scenarioConfigSchema = z.object({
  objective: z
    .object({
      primaryGoal: z.string().trim().max(500).default(""),
      expectedOutcome: z.string().trim().max(500).default(""),
      requiredInformation: z.array(z.string().trim().min(1)).max(20).default([]),
      deliberatelyWithheld: z.array(z.string().trim().min(1)).max(20).default([]),
    })
    .default({
      primaryGoal: "",
      expectedOutcome: "",
      requiredInformation: [],
      deliberatelyWithheld: [],
    }),
  startingConditions: z
    .object({
      situation: z.string().trim().max(1000).default(""),
      initialCustomerUtterance: z.string().trim().max(500).default(""),
    })
    .default({ situation: "", initialCustomerUtterance: "" }),
  evaluation: z
    .object({
      successCriteria: z.array(z.string().trim().min(1)).max(30).default([]),
      failureConditions: z.array(z.string().trim().min(1)).max(30).default([]),
      prohibitedOutcomes: z.array(z.string().trim().min(1)).max(30).default([]),
    })
    .default({ successCriteria: [], failureConditions: [], prohibitedOutcomes: [] }),
  executionLimits: z
    .object({
      maxTurns: z.number().int().min(3, "Min 3 turns.").max(60, "Max 60 turns.").default(15),
      timeoutSeconds: z.number().int().min(30, "Min 30 seconds.").max(600, "Max 600 seconds.").default(180),
    })
    .default({ maxTurns: 15, timeoutSeconds: 180 }),
  compatibility: z
    .object({
      requiredCapabilities: z.array(z.string().trim().min(1)).max(20).default([]),
      language: langCode.default("en"),
    })
    .default({ requiredCapabilities: [], language: "en" }),
});

export type ScenarioConfig = z.infer<typeof scenarioConfigSchema>;

export const emptyScenarioConfig = (): ScenarioConfig => scenarioConfigSchema.parse({});

export const createScenarioInputSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  personaId: z.string().uuid("Invalid persona ID."),
  targetAgentId: z.string().uuid("Invalid target agent ID.").optional().nullable(),
  name: z.string().trim().min(1, "Name is required.").max(140, "Name must be 140 characters or fewer."),
  description: z.string().trim().max(2000).optional().default(""),
  priority: z.enum(SCENARIO_PRIORITIES).default("medium"),
  config: scenarioConfigSchema.default(emptyScenarioConfig()),
});
export type CreateScenarioInput = z.infer<typeof createScenarioInputSchema>;

export const updateScenarioInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(140, "Name must be 140 characters or fewer.").optional(),
  description: z.string().trim().max(2000).optional(),
  personaId: z.string().uuid("Invalid persona ID.").optional(),
  targetAgentId: z.string().uuid("Invalid target agent ID.").optional().nullable(),
  status: z.enum(SCENARIO_STATUSES).optional(),
  priority: z.enum(SCENARIO_PRIORITIES).optional(),
  config: scenarioConfigSchema.optional(),
});
export type UpdateScenarioInput = z.infer<typeof updateScenarioInputSchema>;

export interface PersonaRecord {
  id: string;
  projectId: string;
  ownerId: string | null;
  name: string;
  description: string;
  category: PersonaCategory;
  templateId: string | null;
  status: PersonaStatus;
  version: number;
  config: PersonaConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioRecord {
  id: string;
  projectId: string;
  ownerId: string | null;
  personaId: string;
  targetAgentId: string | null;
  name: string;
  description: string;
  status: ScenarioStatus;
  priority: ScenarioPriority;
  config: ScenarioConfig;
  createdAt: string;
  updatedAt: string;
}

export interface PersonaCollectionRecord {
  id: string;
  projectId: string;
  ownerId: string | null;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
}

