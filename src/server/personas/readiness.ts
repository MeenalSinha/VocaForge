import type { AgentConfig } from "../agents/config-schema";
import type { PersonaConfig, PersonaStatus, ScenarioConfig, ScenarioStatus } from "./schema";

export interface PersonaReadiness {
  isReady: boolean;
  status: PersonaStatus;
  missing: string[];
}

export function evaluatePersonaReadiness(
  name: string,
  config: PersonaConfig,
  currentStatus: PersonaStatus = "draft",
): PersonaReadiness {
  if (currentStatus === "archived") {
    return { isReady: false, status: "archived", missing: [] };
  }

  const missing: string[] = [];

  if (!name.trim()) missing.push("Persona name is required");
  if (!config.defaultObjective.intent.trim()) missing.push("Default objective intent is missing");
  if (!config.startingContext.situation.trim()) missing.push("Starting situation context is missing");
  if (!config.personality.communicationStyle.trim()) missing.push("Communication style is missing");
  if (!config.personality.traits || config.personality.traits.length === 0) {
    missing.push("At least one personality trait is recommended");
  }

  const isReady = missing.length === 0;
  const status: PersonaStatus = isReady ? "ready_for_testing" : "needs_configuration";

  return { isReady, status, missing };
}

export interface ScenarioReadiness {
  isReady: boolean;
  status: ScenarioStatus;
  missing: string[];
  warnings: string[];
}

export function evaluateScenarioReadiness(
  name: string,
  config: ScenarioConfig,
  currentStatus: ScenarioStatus = "draft",
  targetAgentConfig?: AgentConfig | null,
): ScenarioReadiness {
  if (currentStatus === "archived") {
    return { isReady: false, status: "archived", missing: [], warnings: [] };
  }

  const missing: string[] = [];
  const warnings: string[] = [];

  if (!name.trim()) missing.push("Scenario name is required");
  if (!config.objective.primaryGoal.trim()) missing.push("Primary goal is missing");
  if (!config.evaluation.successCriteria || config.evaluation.successCriteria.length === 0) {
    missing.push("At least one success criterion is required");
  }
  if (!config.evaluation.failureConditions || config.evaluation.failureConditions.length === 0) {
    missing.push("At least one failure condition is required");
  }

  // Check agent capability compatibility if an agent is attached
  if (targetAgentConfig) {
    const requiredCaps = config.compatibility?.requiredCapabilities || [];
    const agentCapMap = new Map(
      (targetAgentConfig.capabilities || []).map((c) => [c.name.toLowerCase(), c.status]),
    );

    for (const req of requiredCaps) {
      const status = agentCapMap.get(req.toLowerCase());
      if (!status) {
        warnings.push(`Target agent has not declared required capability: "${req}"`);
      } else if (status === "unavailable") {
        warnings.push(`Target agent marks capability "${req}" as currently unavailable`);
      } else if (status === "needs_information") {
        warnings.push(`Target agent capability "${req}" is missing required configuration`);
      }
    }

    if (
      config.compatibility?.language &&
      targetAgentConfig.language &&
      config.compatibility.language !== targetAgentConfig.language.primary &&
      !targetAgentConfig.language.additional?.includes(config.compatibility.language)
    ) {
      warnings.push(
        `Scenario language (${config.compatibility.language}) does not match target agent languages (${[
          targetAgentConfig.language.primary,
          ...(targetAgentConfig.language.additional || []),
        ].join(", ")})`,
      );
    }
  }

  const isReady = missing.length === 0;
  const status: ScenarioStatus = isReady ? "ready_for_testing" : "needs_configuration";

  return { isReady, status, missing, warnings };
}
