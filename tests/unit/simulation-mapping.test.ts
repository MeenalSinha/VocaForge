import { describe, expect, it } from "vitest";
import {
  buildSimulationScenario,
  buildSimulationSuccessConditions,
  buildSimulationMaxTurns,
  computeSimulationConfigHash,
  mapToElevenLabsTestInput,
} from "@/server/simulations/mapping";
import { createSimulationTestInputSchema } from "@/server/integrations/elevenlabs/schemas";
import {
  emptyPersonaConfig,
  emptyScenarioConfig,
  type PersonaRecord,
  type ScenarioRecord,
} from "@/server/personas/schema";

function createMockPersona(overrides?: Partial<PersonaRecord>): PersonaRecord {
  const config = emptyPersonaConfig();
  config.background = "Tech-savvy customer seeking API tier upgrade";
  config.personality.traits = ["direct", "demanding", "analytical"];
  config.personality.communicationStyle = "concise";
  config.personality.patienceLevel = 2;
  config.personality.assertivenessLevel = 4;
  config.personality.familiarityLevel = 5;
  config.personality.emotionalResponses = {
    onConfusion: "Demands immediate clarification without jargon",
    onDelays: "Expresses frustration after 5 seconds",
    onRepetition: "States that they already answered that question",
  };
  config.knowledge.level = "expert";
  config.knowledge.assumptions = ["Account has an active enterprise plan"];
  config.knowledge.withheldInfo = ["Internal customer account number: ACCT-9901"];
  config.startingContext.situation = "Caller is checking bill status";
  config.startingContext.initialUtterance = "Hi, I have a quick question about my invoice.";

  return {
    id: "persona-uuid-1",
    projectId: "proj-uuid-1",
    ownerId: "user-1",
    name: "Alex Vance (Dev Lead)",
    description: "Enterprise customer demanding rapid resolution",
    category: "support",
    templateId: null,
    status: "ready_for_testing",
    version: 1,
    config,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockScenario(overrides?: Partial<ScenarioRecord>): ScenarioRecord {
  const config = emptyScenarioConfig();
  config.objective.primaryGoal = "Request a credit for 3 hours of API downtime";
  config.objective.expectedOutcome = "Agent provides a billing adjustment or tickets it for finance review";
  config.objective.requiredInformation = ["Invoice number INV-2026", "Incident timestamp 14:00 UTC"];
  config.objective.deliberatelyWithheld = ["Secondary credit card details"];
  config.startingConditions.situation = "Alex is calling customer service during business hours";
  config.startingConditions.initialCustomerUtterance = "Hello, our production cluster went down yesterday due to your outage, and I need a bill credit.";
  config.executionLimits.maxTurns = 12;
  config.evaluation.successCriteria = ["Verify agent acknowledged downtime incident"];
  config.evaluation.prohibitedOutcomes = ["Claim 100% uptime SLA without checking records"];

  return {
    id: "scenario-uuid-1",
    projectId: "proj-uuid-1",
    ownerId: "user-1",
    personaId: "persona-uuid-1",
    targetAgentId: "agent-uuid-1",
    name: "Downtime Credit Escalation",
    description: "Tests agent response to downtime billing compensation request",
    status: "ready_for_testing",
    priority: "high",
    config,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Simulation Mapping Service", () => {
  describe("buildSimulationScenario", () => {
    it("synthesizes persona traits, emotional rules, knowledge boundaries, and objectives", () => {
      const persona = createMockPersona();
      const scenario = createMockScenario();

      const prompt = buildSimulationScenario(persona, scenario);

      // Persona & Identity
      expect(prompt).toContain('roleplaying as "Alex Vance (Dev Lead)"');
      expect(prompt).toContain("Patience Level: 2/5");
      expect(prompt).toContain("Assertiveness Level: 4/5");
      expect(prompt).toContain("direct, demanding, analytical");

      // Emotional Behaviors
      expect(prompt).toContain("Demands immediate clarification without jargon");
      expect(prompt).toContain("Expresses frustration after 5 seconds");

      // Boundaries & Knowledge
      expect(prompt).toContain("Knowledge Level: expert");
      expect(prompt).toContain("Internal customer account number: ACCT-9901");
      expect(prompt).toContain("Secondary credit card details");

      // Objectives & Goals
      expect(prompt).toContain("Primary Goal: Request a credit for 3 hours of API downtime");
      expect(prompt).toContain("Expected Outcome: Agent provides a billing adjustment or tickets it for finance review");
      expect(prompt).toContain("Invoice number INV-2026, Incident timestamp 14:00 UTC");

      // Starting Utterance
      expect(prompt).toContain("Hello, our production cluster went down yesterday");
    });
  });

  describe("buildSimulationSuccessConditions", () => {
    it("extracts and formats positive and negative criteria up to 10 max", () => {
      const scenario = createMockScenario();
      const conditions = buildSimulationSuccessConditions(scenario);

      expect(conditions.length).toBeGreaterThan(0);
      expect(conditions.length).toBeLessThanOrEqual(10);

      // Positive criteria included
      expect(conditions).toContain("Verify agent acknowledged downtime incident");

      // Negative condition prefixed with 'The agent must not'
      expect(conditions.some((c) => c.includes("The agent must not: Claim 100% uptime SLA"))).toBe(true);
    });

    it("caps condition list at 10 items even when scenario has many criteria", () => {
      const scenario = createMockScenario();
      scenario.config.evaluation.successCriteria = [
        "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10", "c11", "c12",
      ];
      const conditions = buildSimulationSuccessConditions(scenario);
      expect(conditions.length).toBe(10);
    });
  });

  describe("buildSimulationMaxTurns", () => {
    it("respects explicit scenario max turns when within 3 to 50 bounds", () => {
      const scenario = createMockScenario();
      expect(buildSimulationMaxTurns(scenario)).toBe(12);
    });

    it("clamps values exceeding max boundary to 50", () => {
      const scenario = createMockScenario();
      scenario.config.executionLimits.maxTurns = 55;
      expect(buildSimulationMaxTurns(scenario)).toBe(50);
    });

    it("clamps values below min boundary to 3", () => {
      const scenario = createMockScenario();
      scenario.config.executionLimits.maxTurns = 1;
      expect(buildSimulationMaxTurns(scenario)).toBe(3);
    });
  });

  describe("computeSimulationConfigHash", () => {
    it("returns a deterministic 64-character SHA-256 hex string", () => {
      const persona = createMockPersona();
      const scenario = createMockScenario();

      const hash1 = computeSimulationConfigHash(persona, scenario);
      const hash2 = computeSimulationConfigHash(persona, scenario);

      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
      expect(hash1).toBe(hash2);
    });

    it("changes hash when persona configuration changes", () => {
      const persona1 = createMockPersona();
      const persona2 = createMockPersona();
      persona2.config.personality.patienceLevel = 5;
      const scenario = createMockScenario();

      const hash1 = computeSimulationConfigHash(persona1, scenario);
      const hash2 = computeSimulationConfigHash(persona2, scenario);

      expect(hash1).not.toBe(hash2);
    });

    it("changes hash when scenario configuration changes", () => {
      const persona = createMockPersona();
      const scenario1 = createMockScenario();
      const scenario2 = createMockScenario();
      scenario2.config.objective.primaryGoal = "Completely different goal";

      const hash1 = computeSimulationConfigHash(persona, scenario1);
      const hash2 = computeSimulationConfigHash(persona, scenario2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("mapToElevenLabsTestInput", () => {
    it("produces a schema-compliant CreateSimulationTestInput payload", () => {
      const persona = createMockPersona();
      const scenario = createMockScenario();

      const input = mapToElevenLabsTestInput(persona, scenario);

      expect(input.name).toBe("Downtime Credit Escalation [Alex Vance (Dev Lead)]");
      expect(input.maxTurns).toBe(12);
      expect(input.successConditions.length).toBeGreaterThan(0);
      expect(input.successConditions.length).toBeLessThanOrEqual(10);
      expect(input.scenario.length).toBeGreaterThan(50);

      // Validates against official ElevenLabs test schema
      const parseResult = createSimulationTestInputSchema.safeParse(input);
      expect(parseResult.success).toBe(true);
    });
  });
});
