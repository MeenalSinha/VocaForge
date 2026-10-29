import { z } from "zod";
import type { FailureFindingRecord, FieldChange, FixProposalRecord } from "./schema";
import type { SimulationRunRecord } from "../simulations/schema";
import type { Agent } from "../agents/repository";
import { diffConfig, summarize } from "../agents/diff";
import { agentConfigSchema } from "../agents/config-schema";
import { structuredFixProposalOutputSchema } from "./schema";
import { getProvider } from "../generation/service";
import type { GenerationProvider } from "../generation/provider";
import { ConflictError, ValidationError } from "../errors";
import { logger } from "../logger";

const FIX_JSON_SCHEMA = () =>
  z.toJSONSchema(structuredFixProposalOutputSchema) as Record<string, unknown>;

const FIX_PROPOSAL_RULES = `You are a voice AI agent optimization engineer and prompt architect.
Your job is to propose a targeted, minimal, safe remediation configuration for an AI voice agent that failed a simulation test.

Rules:
1. Target the smallest, highest-leverage change that directly addresses the documented failure finding.
2. Focus primarily on 'behavior.instructions' or 'guardrails.prohibitedActions' / 'guardrails.escalationConditions'.
3. NEVER invent business facts, prices, hours, or policies that are not present in the existing configuration or scenario.
4. DO NOT rewrite unrelated configuration sections (leave name, voice, language, and other untouched sections identical).
5. If the problem requires a missing backend capability (e.g. real database query or booking tool) rather than prompt instructions, clearly state this limitation in 'potentialRisks'.
6. Provide an honest 'expectedImprovement' explaining how this specific change will alter the agent's behavior during a retest.
7. Provide an honest 'potentialRisks' detailing any potential side effects or regressions this change might induce.
8. The output 'proposedConfig' must be a complete, valid AgentConfig object matching the existing configuration with only the targeted fields modified.`;

export async function generateRemediationFix(
  finding: FailureFindingRecord,
  run: SimulationRunRecord,
  agent: Agent,
  provider: GenerationProvider = getProvider(),
): Promise<
  Omit<
    FixProposalRecord,
    "id" | "ownerId" | "rejectionReason" | "appliedAgentVersion" | "remoteSyncError" | "createdAt" | "updatedAt"
  >
> {
  if (!finding.isActionable) {
    throw new ConflictError("This failure finding is marked as non-actionable (e.g. infrastructure or insufficient evidence).");
  }

  // Detect whether agent configuration has moved ahead of the tested version
  const isStale = agent.configVersion !== finding.testedVersion;
  const baseConfig = agent.config;

  const prompt = `Propose a targeted remediation fix for this voice agent test failure:

=== AGENT IDENTITY ===
Name: ${agent.name}
Current Version: v${agent.configVersion}
${isStale ? `(NOTE: The test was conducted against v${finding.testedVersion}, but agent is now at v${agent.configVersion}. Formulate fix against the current v${agent.configVersion} configuration.)` : ""}

=== DOCUMENTED FAILURE FINDING ===
Title: ${finding.title}
Category: ${finding.category}
Severity: ${finding.severity}
Description: ${finding.description}
Expected Behavior: ${finding.expectedBehavior}
Observed Behavior: ${finding.observedBehavior}
Discrepancy: ${finding.discrepancyExplanation}
Suggested Direction: ${finding.suggestedAction}

=== SUPPORTING TRANSCRIPT EVIDENCE ===
${finding.evidenceReferences.map((e) => `- [${e.role || "turn"}]: "${e.excerpt}" (${e.note || "evidence"})`).join("\n")}

=== CURRENT AGENT CONFIGURATION (JSON) ===
${JSON.stringify(baseConfig, null, 2)}
`;

  try {
    const raw = await provider.generate({
      system: FIX_PROPOSAL_RULES,
      user: prompt,
      toolName: "propose_configuration_fix",
      toolDescription: "Submit structured configuration fix proposal with full updated AgentConfig and rationale.",
      schema: FIX_JSON_SCHEMA(),
    });

    const parsed = structuredFixProposalOutputSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn("Fix proposal output failed validation", { errors: parsed.error.issues });
      throw new ValidationError("Failed to validate proposed fix configuration.", {
        proposal: ["Generated fix output did not conform to the required proposal schema."],
      });
    }

    const { proposedConfig, changeSummary, rationale, expectedImprovement, potentialRisks } =
      parsed.data;

    // Validate proposed configuration against strict AgentConfig schema
    const configParsed = agentConfigSchema.safeParse(proposedConfig);
    if (!configParsed.success) {
      logger.warn("Proposed configuration failed agentConfigSchema validation", {
        errors: configParsed.error.issues,
      });
      throw new ValidationError("Proposed agent configuration is invalid.", {
        config: configParsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }

    // Compute concrete field-level changes
    const rawDiffs = diffConfig(baseConfig, proposedConfig);
    const fieldChanges: FieldChange[] = rawDiffs.map((d) => ({
      path: d.path,
      label: d.label,
      before: d.before,
      after: d.after,
      explanation: `Updated to address: ${finding.title}`,
    }));

    const finalSummary =
      fieldChanges.length > 0 ? changeSummary || summarize(rawDiffs) : "Refined instructions based on failure analysis";

    return {
      projectId: agent.projectId,
      targetAgentId: agent.id,
      sourceRunId: run.id,
      sourceFindingId: finding.id,
      baseVersion: agent.configVersion,
      proposedConfig,
      changeSummary: finalSummary,
      fieldChanges,
      rationale,
      expectedImprovement,
      potentialRisks,
      status: "pending_review",
      remoteSyncStatus: "not_applied",
    };
  } catch (err: unknown) {
    if (err instanceof ValidationError || err instanceof ConflictError) {
      throw err;
    }
    logger.error("Fix generation failed", { error: (err as Error).message });

    // Fallback proposal: append targeted rule to instructions
    const fallbackInstructions = `${baseConfig.behavior.instructions.trim()}\n\n# Remediation Rule (Auto-Generated):\n- When interacting with customers: ${finding.suggestedAction}`;
    const fallbackConfig = {
      ...baseConfig,
      behavior: {
        ...baseConfig.behavior,
        instructions: fallbackInstructions,
      },
    };

    const diffs = diffConfig(baseConfig, fallbackConfig);
    const fieldChanges: FieldChange[] = diffs.map((d) => ({
      path: d.path,
      label: d.label,
      before: d.before,
      after: d.after,
      explanation: finding.suggestedAction,
    }));

    return {
      projectId: agent.projectId,
      targetAgentId: agent.id,
      sourceRunId: run.id,
      sourceFindingId: finding.id,
      baseVersion: agent.configVersion,
      proposedConfig: fallbackConfig,
      changeSummary: `Added targeted rule to instructions: "${finding.title}"`,
      fieldChanges,
      rationale: `Directly incorporated remediation guidance from failure finding: ${finding.discrepancyExplanation}`,
      expectedImprovement: `Prevents ${finding.category} by explicitly instructing the agent to follow: ${finding.expectedBehavior}`,
      potentialRisks: "Slightly increases prompt length. Verify that tone remains consistent.",
      status: "pending_review",
      remoteSyncStatus: "not_applied",
    };
  }
}

