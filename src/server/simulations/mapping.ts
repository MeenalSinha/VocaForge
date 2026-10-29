import { createHash } from "node:crypto";
import type { PersonaRecord, ScenarioRecord } from "../personas/schema";
import {
  createSimulationTestInputSchema,
  type CreateSimulationTestInput,
} from "../integrations/elevenlabs/schemas";

/**
 * Builds a natural-language simulation scenario instruction for ElevenLabs.
 * Synthesizes caller identity, traits, emotional reactions, knowledge limits,
 * starting situation, and mission objectives into a cohesive prompt.
 */
export function buildSimulationScenario(
  persona: PersonaRecord,
  scenario: ScenarioRecord,
): string {
  const p = persona.config.personality;
  const k = persona.config.knowledge;
  const sc = scenario.config;

  const sections: string[] = [];

  // 1. Caller Persona & Identity
  sections.push(
    `You are roleplaying as "${persona.name}".\n` +
      `Background: ${persona.config.background || persona.description || "Inbound customer"}\n` +
      `Personality Traits: ${p.traits.join(", ") || "neutral"}\n` +
      `Communication Style: ${p.communicationStyle || "conversational"}\n` +
      `Patience Level: ${p.patienceLevel}/5 | Assertiveness Level: ${p.assertivenessLevel}/5 | Familiarity with Service: ${p.familiarityLevel}/5`,
  );

  // 2. Emotional Reaction Rules
  if (p.emotionalResponses) {
    sections.push(
      `Emotional Behaviors:\n` +
        `- When confused: ${p.emotionalResponses.onConfusion}\n` +
        `- When facing delays or long pauses: ${p.emotionalResponses.onDelays}\n` +
        `- When asked to repeat information: ${p.emotionalResponses.onRepetition}`,
    );
  }

  // 3. Knowledge & Information Boundaries
  const knowledgeLines: string[] = [`Knowledge Level: ${k.level}`];
  if (k.assumptions && k.assumptions.length > 0) {
    knowledgeLines.push(`Assumptions: ${k.assumptions.join("; ")}`);
  }
  if (k.withheldInfo && k.withheldInfo.length > 0) {
    knowledgeLines.push(`Withheld Info (do not disclose unless asked): ${k.withheldInfo.join("; ")}`);
  }
  if (sc.objective.deliberatelyWithheld && sc.objective.deliberatelyWithheld.length > 0) {
    knowledgeLines.push(
      `Scenario Withheld Info: ${sc.objective.deliberatelyWithheld.join("; ")}`,
    );
  }
  sections.push(`Information & Boundaries:\n${knowledgeLines.join("\n")}`);

  // 4. Starting Context & Opening
  const startingSit = sc.startingConditions.situation || persona.config.startingContext.situation;
  const startingUtterance =
    sc.startingConditions.initialCustomerUtterance || persona.config.startingContext.initialUtterance;

  if (startingSit || startingUtterance) {
    sections.push(
      `Starting Scenario Context:\n` +
        (startingSit ? `Current Situation: ${startingSit}\n` : "") +
        (startingUtterance ? `Your Opening Utterance: "${startingUtterance}"` : ""),
    );
  }

  // 5. Test Mission Objectives & Rules
  const missionLines: string[] = [];
  if (sc.objective.primaryGoal) {
    missionLines.push(`Primary Goal: ${sc.objective.primaryGoal}`);
  }
  if (sc.objective.expectedOutcome) {
    missionLines.push(`Expected Outcome: ${sc.objective.expectedOutcome}`);
  }
  if (sc.objective.requiredInformation && sc.objective.requiredInformation.length > 0) {
    missionLines.push(`Required Information to Obtain: ${sc.objective.requiredInformation.join(", ")}`);
  }
  if (persona.config.behavioralConstraints?.rules && persona.config.behavioralConstraints.rules.length > 0) {
    missionLines.push(`Behavioral Rules: ${persona.config.behavioralConstraints.rules.join("; ")}`);
  }
  if (persona.config.behavioralConstraints?.stopConditions && persona.config.behavioralConstraints.stopConditions.length > 0) {
    missionLines.push(`Stop Conditions: ${persona.config.behavioralConstraints.stopConditions.join("; ")}`);
  }

  if (missionLines.length > 0) {
    sections.push(`Mission Objectives & Constraints:\n${missionLines.join("\n")}`);
  }

  return sections.join("\n\n");
}

/**
 * Extracts and maps concrete success conditions for ElevenLabs evaluation.
 * Combines positive success criteria with negative prohibited outcomes.
 */
export function buildSimulationSuccessConditions(scenario: ScenarioRecord): string[] {
  const criteria = scenario.config.evaluation.successCriteria || [];
  const prohibited = scenario.config.evaluation.prohibitedOutcomes || [];

  const conditions: string[] = [];

  for (const c of criteria) {
    const trimmed = c.trim();
    if (trimmed && !conditions.includes(trimmed)) {
      conditions.push(trimmed);
    }
  }

  for (const p of prohibited) {
    const trimmed = p.trim();
    if (trimmed) {
      const negativeCondition = trimmed.toLowerCase().startsWith("the agent must not")
        ? trimmed
        : `The agent must not: ${trimmed}`;
      if (!conditions.includes(negativeCondition)) {
        conditions.push(negativeCondition);
      }
    }
  }

  // ElevenLabs API requires between 1 and 10 conditions
  if (conditions.length === 0) {
    conditions.push(
      scenario.config.objective.primaryGoal
        ? `The agent successfully addresses: ${scenario.config.objective.primaryGoal}`
        : "The agent provides a helpful, polite, and accurate response.",
    );
  }

  return conditions.slice(0, 10);
}

/**
 * Bounds the simulation max turns between 3 and 50 turns.
 */
export function buildSimulationMaxTurns(scenario: ScenarioRecord): number {
  const raw = scenario.config.executionLimits.maxTurns;
  if (typeof raw !== "number" || isNaN(raw)) return 10;
  return Math.min(Math.max(raw, 3), 50);
}

/**
 * Computes a deterministic SHA-256 fingerprint for caching remote test definitions.
 */
export function computeSimulationConfigHash(
  persona: PersonaRecord,
  scenario: ScenarioRecord,
): string {
  const payload = {
    personaName: persona.name,
    personaCategory: persona.category,
    personaConfig: persona.config,
    scenarioName: scenario.name,
    scenarioConfig: scenario.config,
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Produces a validated ElevenLabs CreateSimulationTestInput object.
 */
export function mapToElevenLabsTestInput(
  persona: PersonaRecord,
  scenario: ScenarioRecord,
): CreateSimulationTestInput {
  const name = `${scenario.name} [${persona.name}]`.slice(0, 100);
  const simulation_scenario = buildSimulationScenario(persona, scenario);
  const success_conditions = buildSimulationSuccessConditions(scenario);
  const simulation_max_turns = buildSimulationMaxTurns(scenario);

  return createSimulationTestInputSchema.parse({
    name,
    scenario: simulation_scenario,
    successConditions: success_conditions,
    maxTurns: simulation_max_turns,
  });
}
