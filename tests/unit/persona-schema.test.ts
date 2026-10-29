import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  PERSONA_CATEGORIES,
  PERSONA_STATUSES,
  SCENARIO_PRIORITIES,
  SCENARIO_STATUSES,
  createPersonaInputSchema,
  createScenarioInputSchema,
  emptyPersonaConfig,
  emptyScenarioConfig,
  personaConfigSchema,
  scenarioConfigSchema,
} from "@/server/personas/schema";
import { evaluatePersonaReadiness, evaluateScenarioReadiness } from "@/server/personas/readiness";
import { PERSONA_TEMPLATES } from "@/server/personas/templates";
import type { AgentConfig } from "@/server/agents/config-schema";
import { sampleConfig } from "../sample-config";

describe("Persona & Scenario Schemas", () => {
  describe("personaConfigSchema", () => {
    it("accepts a well-formed persona configuration", () => {
      const config = emptyPersonaConfig();
      config.background = "Loyal customer for over 5 years. Expects fast support.";
      config.personality.traits = ["analytical", "detail-oriented", "patient"];
      config.personality.communicationStyle = "Polite and measured";
      config.personality.patienceLevel = 4;
      config.personality.assertivenessLevel = 3;
      config.personality.familiarityLevel = 4;
      config.knowledge.level = "intermediate";
      config.language.primary = "en";
      config.defaultObjective.intent = "Clarify billing charge";

      const parsed = personaConfigSchema.safeParse(config);
      expect(parsed.success).toBe(true);
    });

    it("rejects personality levels outside 1-5 range", () => {
      const config = emptyPersonaConfig();
      config.personality.patienceLevel = 6; // Max 5
      const parsedHigh = personaConfigSchema.safeParse(config);
      expect(parsedHigh.success).toBe(false);

      config.personality.patienceLevel = 0; // Min 1
      const parsedLow = personaConfigSchema.safeParse(config);
      expect(parsedLow.success).toBe(false);
    });

    it("rejects invalid mind change probability outside 0-100", () => {
      const config = emptyPersonaConfig();
      config.personality.mindChangeProbability = 150; // Max 100
      const parsedHigh = personaConfigSchema.safeParse(config);
      expect(parsedHigh.success).toBe(false);

      config.personality.mindChangeProbability = -5; // Min 0
      const parsedLow = personaConfigSchema.safeParse(config);
      expect(parsedLow.success).toBe(false);
    });

    it("rejects invalid knowledge level", () => {
      const config = emptyPersonaConfig();
      (config.knowledge as unknown as Record<string, unknown>).level = "genius";
      const parsed = personaConfigSchema.safeParse(config);
      expect(parsed.success).toBe(false);
    });

    it("validates createPersonaInputSchema with required fields and valid UUID", () => {
      const valid = createPersonaInputSchema.safeParse({
        projectId: randomUUID(),
        name: "Test Customer",
        category: "customer_experience",
        config: emptyPersonaConfig(),
      });
      expect(valid.success).toBe(true);

      const emptyName = createPersonaInputSchema.safeParse({
        projectId: randomUUID(),
        name: "   ",
        category: "customer_experience",
        config: emptyPersonaConfig(),
      });
      expect(emptyName.success).toBe(false);

      const invalidCategory = createPersonaInputSchema.safeParse({
        projectId: randomUUID(),
        name: "Test Customer",
        category: "invalid_category",
        config: emptyPersonaConfig(),
      });
      expect(invalidCategory.success).toBe(false);
    });
  });

  describe("scenarioConfigSchema", () => {
    it("accepts a well-formed scenario configuration", () => {
      const config = emptyScenarioConfig();
      config.objective.primaryGoal = "Reschedule missed appointment";
      config.evaluation.successCriteria = ["New appointment time is confirmed"];
      config.evaluation.failureConditions = ["Agent hangs up without resolution"];
      config.executionLimits.maxTurns = 15;
      config.executionLimits.timeoutSeconds = 180;

      const parsed = scenarioConfigSchema.safeParse(config);
      expect(parsed.success).toBe(true);
    });

    it("enforces maxTurns bounds (3 to 60)", () => {
      const config = emptyScenarioConfig();
      config.executionLimits.maxTurns = 2; // Min 3
      expect(scenarioConfigSchema.safeParse(config).success).toBe(false);

      config.executionLimits.maxTurns = 70; // Max 60
      expect(scenarioConfigSchema.safeParse(config).success).toBe(false);

      config.executionLimits.maxTurns = 25;
      expect(scenarioConfigSchema.safeParse(config).success).toBe(true);
    });

    it("enforces timeout bounds (30 to 600 seconds)", () => {
      const config = emptyScenarioConfig();
      config.executionLimits.timeoutSeconds = 10; // Min 30
      expect(scenarioConfigSchema.safeParse(config).success).toBe(false);

      config.executionLimits.timeoutSeconds = 1000; // Max 600
      expect(scenarioConfigSchema.safeParse(config).success).toBe(false);

      config.executionLimits.timeoutSeconds = 240;
      expect(scenarioConfigSchema.safeParse(config).success).toBe(true);
    });

    it("validates createScenarioInputSchema with required fields and valid UUIDs", () => {
      const valid = createScenarioInputSchema.safeParse({
        projectId: randomUUID(),
        personaId: randomUUID(),
        name: "Test Scenario",
        priority: "high",
        config: emptyScenarioConfig(),
      });
      expect(valid.success).toBe(true);

      const invalidPriority = createScenarioInputSchema.safeParse({
        projectId: randomUUID(),
        personaId: randomUUID(),
        name: "Test Scenario",
        priority: "urgent_super",
        config: emptyScenarioConfig(),
      });
      expect(invalidPriority.success).toBe(false);
    });
  });

  describe("Readiness Evaluations", () => {
    it("evaluates persona readiness correctly", () => {
      const config = emptyPersonaConfig();
      // Empty config -> not ready
      const notReady = evaluatePersonaReadiness("", config, "draft");
      expect(notReady.isReady).toBe(false);
      expect(notReady.missing).toContain("Persona name is required");
      expect(notReady.missing).toContain("Default objective intent is missing");
      expect(notReady.missing).toContain("Starting situation context is missing");

      // Complete config -> ready
      config.personality.traits = ["calm", "patient"];
      config.personality.communicationStyle = "Courteous and clear";
      config.startingContext.situation = "Inquiring about monthly invoice charges";
      config.defaultObjective.intent = "Understand discrepancy in line item 3";
      const ready = evaluatePersonaReadiness("Arthur Pendelton", config, "draft");
      expect(ready.isReady).toBe(true);
      expect(ready.missing).toHaveLength(0);
      expect(ready.status).toBe("ready_for_testing");
    });

    it("evaluates scenario readiness and generates capability compatibility warnings", () => {
      const config = emptyScenarioConfig();
      config.objective.primaryGoal = "Book emergency plumbing visit";
      config.evaluation.successCriteria = ["Booking reference provided"];
      config.evaluation.failureConditions = ["Refusal without triage"];
      config.compatibility.requiredCapabilities = ["calendar_booking", "payment_capture"];
      config.compatibility.language = "en";

      const mockAgentConfig: AgentConfig = {
        ...sampleConfig(),
        language: { primary: "en", additional: ["es"] },
        capabilities: [
          { name: "calendar_booking", description: "", status: "unavailable", note: "" },
        ],
      };

      const result = evaluateScenarioReadiness("Urgent Service Call", config, "draft", mockAgentConfig);
      expect(result.isReady).toBe(true);
      // Warnings: calendar_booking is unavailable; payment_capture is not declared
      expect(result.warnings.some((w) => w.includes("payment_capture"))).toBe(true);
      expect(result.warnings.some((w) => w.includes("calendar_booking"))).toBe(true);
    });

    it("generates language mismatch warning when target agent does not speak scenario language", () => {
      const config = emptyScenarioConfig();
      config.objective.primaryGoal = "Demander de l'aide";
      config.evaluation.successCriteria = ["Réponse en français"];
      config.evaluation.failureConditions = ["Refus de parler français"];
      config.compatibility.language = "fr";

      const mockAgentConfig: AgentConfig = {
        ...sampleConfig(),
        language: { primary: "en", additional: ["es"] },
        capabilities: [],
      };

      const result = evaluateScenarioReadiness("French Inquiry", config, "draft", mockAgentConfig);
      expect(result.warnings.some((w) => w.includes("fr"))).toBe(true);
    });
  });

  describe("Curated Starter Templates", () => {
    it("contains exactly 10 high-fidelity starter templates", () => {
      expect(PERSONA_TEMPLATES.length).toBe(10);
    });

    it("verifies all templates pass personaConfigSchema and have valid metadata", () => {
      for (const t of PERSONA_TEMPLATES) {
        expect(t.id).toBeTruthy();
        expect(t.name).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(PERSONA_CATEGORIES).toContain(t.category);
        expect(t.tags.length).toBeGreaterThan(0);

        const parsed = personaConfigSchema.safeParse(t.initialConfig);
        expect(parsed.success, `Template "${t.name}" failed schema validation: ${JSON.stringify(parsed)}`).toBe(true);

        const readiness = evaluatePersonaReadiness(t.name, t.initialConfig, "ready_for_testing");
        expect(readiness.isReady, `Template "${t.name}" should be ready out of the box (missing: ${readiness.missing.join(", ")})`).toBe(true);
      }
    });

    it("covers the core functional categories", () => {
      const categories = new Set(PERSONA_TEMPLATES.map((t) => t.category));
      expect(categories.has("customer_experience")).toBe(true);
      expect(categories.has("pricing_policies")).toBe(true);
      expect(categories.has("communication")).toBe(true);
      expect(categories.has("support")).toBe(true);
    });
  });

  describe("Enums & Status Constants", () => {
    it("has valid persona categories and statuses", () => {
      expect(PERSONA_CATEGORIES).toEqual([
        "customer_experience",
        "pricing_policies",
        "communication",
        "support",
        "custom",
      ]);
      expect(PERSONA_STATUSES).toEqual([
        "draft",
        "needs_configuration",
        "ready_for_testing",
        "archived",
      ]);
      expect(SCENARIO_PRIORITIES).toEqual(["low", "medium", "high", "critical"]);
      expect(SCENARIO_STATUSES).toEqual([
        "draft",
        "needs_configuration",
        "ready_for_testing",
        "archived",
      ]);
    });
  });
});


