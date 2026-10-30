import { z } from "zod";
import type { SimulationRunRecord } from "../simulations/schema";
import type { Agent } from "../agents/repository";
import {
  structuredFindingOutputSchema,
  type FailureFindingRecord,
  type StructuredFindingOutput,
} from "./schema";
import { getProvider } from "../generation/service";
import type { GenerationProvider } from "../generation/provider";
import { ConflictError, ValidationError } from "../errors";
import { logger } from "../logger";

const FINDING_JSON_SCHEMA = () =>
  z.toJSONSchema(structuredFindingOutputSchema) as Record<string, unknown>;

const ANALYSIS_RULES = `You are an expert voice AI agent evaluation specialist and conversational analyst.
Your task is to analyze a simulation test run where an AI voice agent was tested by a simulated customer persona and failed.

Rules:
1. ONLY use facts directly present in the provided transcript, scenario objective, and remote evaluation rationale. NEVER invent utterances, tool outputs, or customer details.
2. Formulate findings backed by concrete evidence. Fill 'evidenceReferences' with exact message excerpts, roles, and message indices from the transcript.
3. Choose the most specific failure category among:
   - unsupported_answer (agent gave factually incorrect/hallucinated info)
   - objective_failed (agent failed customer's primary mission)
   - unnecessary_repetition (agent repeatedly asked for already provided info)
   - missing_information (agent didn't handle required/withheld info correctly)
   - policy_violation (agent breached business guardrails or unauthorized promises)
   - incorrect_tool_usage (wrong tool parameters or inappropriate tool call)
   - tool_execution_failed (external system error)
   - language_barrier (miscomprehension of language/accent)
   - premature_end (agent hung up/ended call abruptly)
   - excessive_turns (agent spun in circles without resolving)
   - contradictory_response (agent contradicted itself across turns)
   - insufficient_evidence (rationale says failed but transcript does not show why)
4. Distinguish proven causality ('proven') from likely inferences ('hypothesis'). If the transcript lacks detail, use 'inconclusive'.
5. Clearly articulate:
   - Expected behavior (what the agent should have done based on instructions and scenario goals).
   - Observed behavior (what the agent actually said or did in the transcript).
   - Discrepancy explanation (why this caused the failure).
   - Suggested action (specific guidance on what to adjust in the agent instructions or guardrails).
6. Do NOT misclassify network/infrastructure failures as agent incompetence.`;

/**
 * Deterministic checks before AI analysis.
 */
function runDeterministicChecks(
  run: SimulationRunRecord,
  _agent: Agent,
): StructuredFindingOutput | null {
  const rationale = run.evaluationRationale || "";
  const transcript = run.transcript || [];
  const sc = run.scenarioSnapshot;

  // 1. Check for premature termination
  if (transcript.length <= 1 && run.status === "failed_evaluation") {
    return {
      category: "premature_end",
      severity: "critical",
      title: "Conversation terminated prematurely",
      description: "The conversation ended after only 1 turn before the customer inquiry could be addressed.",
      evidenceReferences: transcript.map((m, idx) => ({
        messageIndex: idx,
        role: m.role,
        excerpt: m.message,
        timeInCallSecs: m.timeInCallSecs,
      })),
      expectedBehavior: "Agent should maintain the call flow and gather inquiry details.",
      observedBehavior: `Conversation ended after ${transcript.length} turns.`,
      discrepancyExplanation: "Agent terminated or failed to keep the conversational session open.",
      confidence: "proven",
      isActionable: true,
      suggestedAction: "Check agent instructions to ensure welcome message invites dialogue and does not hang up immediately.",
    };
  }

  // 2. Check for prohibited negative conditions in rationale
  const prohibited = sc.evaluation?.prohibitedOutcomes || [];
  for (const p of prohibited) {
    if (rationale.toLowerCase().includes(p.toLowerCase())) {
      const matchingTurn = transcript.find((t) => t.role === "agent" && t.message.toLowerCase().includes(p.toLowerCase().slice(0, 20)));
      return {
        category: "policy_violation",
        severity: "critical",
        title: `Prohibited condition violated: ${p.slice(0, 60)}`,
        description: `The agent triggered a documented prohibited condition during evaluation: "${p}".`,
        evidenceReferences: matchingTurn
          ? [
              {
                role: matchingTurn.role,
                excerpt: matchingTurn.message,
                timeInCallSecs: matchingTurn.timeInCallSecs,
              },
            ]
          : [],
        expectedBehavior: `The agent must not: ${p}`,
        observedBehavior: `Evaluation report explicitly noted violation: "${rationale}"`,
        discrepancyExplanation: "The agent took an action or made a statement strictly forbidden by scenario criteria.",
        confidence: "proven",
        isActionable: true,
        suggestedAction: `Add an explicit prohibition rule under guardrails.prohibitedActions prohibiting "${p}".`,
      };
    }
  }

  // 3. Insufficient evidence check (empty transcript with failed evaluation)
  if (transcript.length === 0 && run.status === "failed_evaluation") {
    return {
      category: "insufficient_evidence",
      severity: "minor",
      title: "Evaluation failed without transcript dialogue",
      description: "Remote evaluation reported failure, but no conversational turns were recorded in the session.",
      evidenceReferences: [],
      expectedBehavior: "Transcript evidence should be present to analyze agent dialogue.",
      observedBehavior: "Empty transcript returned from remote execution.",
      discrepancyExplanation: "Insufficient evidence exists to diagnose a specific conversational defect.",
      confidence: "inconclusive",
      isActionable: false,
      suggestedAction: "Rerun the simulation test with verification of audio connection.",
    };
  }

  return null;
}

/**
 * Analyzes a completed simulation run and produces structured failure findings.
 */
export async function analyzeSimulationRun(
  run: SimulationRunRecord,
  agent: Agent,
  provider: GenerationProvider = getProvider(),
): Promise<Omit<FailureFindingRecord, "id" | "ownerId" | "createdAt" | "updatedAt">> {
  // Validate eligibility
  if (run.status === "pending" || run.status === "running") {
    throw new ConflictError("Cannot analyze an in-progress or pending simulation run.");
  }

  if (run.status === "passed") {
    throw new ConflictError("Cannot perform failure analysis on a passing simulation run.");
  }

  if (run.status === "infrastructure_error" || run.status === "timed_out") {
    // Produce an infrastructure-specific non-agent finding without blaming the agent
    return {
      runId: run.id,
      batchId: run.batchId,
      projectId: run.projectId,
      targetAgentId: run.targetAgentId,
      testedVersion: agent.configVersion,
      category: "insufficient_evidence",
      severity: "minor",
      title: run.status === "timed_out" ? "Test timed out before completion" : "Infrastructure or transport failure",
      description:
        run.errorMessage ||
        "The test failed due to an external network, timeout, or ElevenLabs infrastructure error rather than agent behavior.",
      evidenceReferences: [],
      expectedBehavior: "Remote execution environment operates without timeouts or transport interruptions.",
      observedBehavior: `Execution terminated with status: ${run.status}`,
      discrepancyExplanation: "External execution environment failed before or during test processing.",
      confidence: "proven",
      isActionable: false,
      suggestedAction: "Retry the simulation test. If issues persist, verify ElevenLabs API credentials and service health.",
      analysisMetadata: {
        analysisType: "infrastructure_limitation",
        rawStatus: run.status,
      },
    };
  }

  // 1. Run deterministic checks first
  const deterministic = runDeterministicChecks(run, agent);
  if (deterministic) {
    return {
      runId: run.id,
      batchId: run.batchId,
      projectId: run.projectId,
      targetAgentId: run.targetAgentId,
      testedVersion: agent.configVersion,
      category: deterministic.category,
      severity: deterministic.severity,
      title: deterministic.title,
      description: deterministic.description,
      evidenceReferences: deterministic.evidenceReferences,
      expectedBehavior: deterministic.expectedBehavior,
      observedBehavior: deterministic.observedBehavior,
      discrepancyExplanation: deterministic.discrepancyExplanation,
      confidence: deterministic.confidence,
      isActionable: deterministic.isActionable,
      suggestedAction: deterministic.suggestedAction,
      analysisMetadata: {
        analysisType: "deterministic_rule",
      },
    };
  }

  // 2. Format inputs for AI interpretation
  const formattedTranscript = run.transcript
    .map(
      (m, idx) =>
        `Turn ${idx + 1} [${m.role.toUpperCase()}${m.timeInCallSecs != null ? ` at ${m.timeInCallSecs}s` : ""}]: "${m.message}"`,
    )
    .join("\n");

  const prompt = `Analyze this failed voice agent simulation test:

=== TARGET AGENT INSTRUCTIONS ===
Agent Name: ${agent.name}
Role: ${agent.config.identity.role || "Voice Assistant"}
Instructions:
${agent.config.behavior.instructions || "(None)"}

=== TESTED PERSONA ===
Name: ${run.personaName}
Category: ${(run.personaSnapshot?.personality?.traits || []).join(", ") || "Standard"}
Patience Level: ${run.personaSnapshot?.personality?.patienceLevel ?? 3}/5

=== SCENARIO & OBJECTIVES ===
Scenario: ${run.scenarioName}
Primary Goal: ${run.scenarioSnapshot?.objective?.primaryGoal || "Complete scenario objective"}
Expected Outcome: ${run.scenarioSnapshot?.objective?.expectedOutcome || "Scenario succeeds"}
Success Criteria:
${(run.scenarioSnapshot?.evaluation?.successCriteria || []).map((c) => `- ${c}`).join("\n") || "- Scenario completed"}
Failure Conditions:
${(run.scenarioSnapshot?.evaluation?.failureConditions || []).map((c) => `- ${c}`).join("\n") || "- Scenario failed"}

=== REMOTE EVALUATION RATIONALE ===
${run.evaluationRationale || "Remote condition evaluation failed criteria."}

=== CONVERSATION TRANSCRIPT ===
${formattedTranscript || "(No transcript recorded)"}
`;

  try {
    const raw = await provider.generate({
      system: ANALYSIS_RULES,
      user: prompt,
      toolName: "submit_failure_analysis",
      toolDescription: "Submit structured failure analysis finding with evidence references.",
      schema: FINDING_JSON_SCHEMA(),
    });

    const parsed = structuredFindingOutputSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn("Failure analysis output failed validation", { errors: parsed.error.issues });
      throw new ValidationError("Failed to validate analysis findings.", {
        analysis: ["Analysis output did not conform to the required schema."],
      });
    }

    const finding = parsed.data;

    return {
      runId: run.id,
      batchId: run.batchId,
      projectId: run.projectId,
      targetAgentId: run.targetAgentId,
      testedVersion: agent.configVersion,
      category: finding.category,
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
      evidenceReferences: finding.evidenceReferences,
      expectedBehavior: finding.expectedBehavior,
      observedBehavior: finding.observedBehavior,
      discrepancyExplanation: finding.discrepancyExplanation,
      confidence: finding.confidence,
      isActionable: finding.isActionable,
      suggestedAction: finding.suggestedAction,
      analysisMetadata: {
        analysisType: "ai_interpretation",
        model: "configured_generation_provider",
      },
    };
  } catch (err: unknown) {
    if (err instanceof ValidationError || err instanceof ConflictError) {
      throw err;
    }
    logger.error("AI Failure analysis failed", { error: (err as Error).message });
    // Graceful fallback to heuristic finding if provider fails
    return {
      runId: run.id,
      batchId: run.batchId,
      projectId: run.projectId,
      targetAgentId: run.targetAgentId,
      testedVersion: agent.configVersion,
      category: "objective_failed",
      severity: "major",
      title: `Simulation failed: ${run.scenarioName}`,
      description:
        run.evaluationRationale ||
        "The conversation did not meet the documented scenario objectives and success criteria.",
      evidenceReferences: run.transcript.slice(-2).map((m, idx) => ({
        messageIndex: run.transcript.length - 2 + idx,
        role: m.role,
        excerpt: m.message,
        timeInCallSecs: m.timeInCallSecs,
      })),
      expectedBehavior: run.scenarioSnapshot?.objective?.expectedOutcome || "Complete scenario goal.",
      observedBehavior: "Conversation failed remote evaluation criteria.",
      discrepancyExplanation: run.evaluationRationale || "Scenario requirements were not satisfied by the agent.",
      confidence: "hypothesis",
      isActionable: true,
      suggestedAction: `Update agent behavior instructions to handle ${run.scenarioSnapshot?.objective?.primaryGoal || "scenario objective"}.`,
      analysisMetadata: {
        analysisType: "heuristic_fallback",
        error: (err as Error).message,
      },
    };
  }
}
