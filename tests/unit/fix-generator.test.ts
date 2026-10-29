import { describe, expect, it } from "vitest";
import { generateRemediationFix } from "@/server/analysis/fix-generator";
import type { FailureFindingRecord } from "@/server/analysis/schema";
import type { Agent } from "@/server/agents/repository";
import type { SimulationRunRecord } from "@/server/simulations/schema";
import { sampleConfig } from "../sample-config";
import type { GenerationProvider, StructuredRequest } from "@/server/generation/provider";
import { agentConfigSchema } from "@/server/agents/config-schema";
import { emptyPersonaConfig, emptyScenarioConfig } from "@/server/personas/schema";

describe("AI Remediation Fix Generator", () => {
  const dummyAgent: Agent = {
    id: "agent_456",
    projectId: "proj_456",
    name: "Reservations Agent",
    description: "Hotel bookings",
    useCase: "hotel",
    creationPrompt: null,
    config: sampleConfig(),
    configVersion: 1,
    syncedVersion: 1,
    voiceId: "voice_1",
    primaryLanguage: "en",
    remoteAgentId: "remote_agent_xyz",
    status: "active",
    remoteCheckedAt: new Date().toISOString(),
    remoteStatusNote: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const dummyRun: SimulationRunRecord = {
    id: "run_1",
    batchId: "batch_1",
    projectId: "proj_456",
    ownerId: "owner_456",
    targetAgentId: "agent_456",
    personaId: "persona_1",
    scenarioId: "scenario_1",
    scenarioName: "Cancellation Test",
    personaName: "Caller",
    remoteTestId: "test_1",
    remoteTestRunId: "run_remote_1",
    remoteInvocationId: "inv_1",
    status: "failed_evaluation",
    transcript: [],
    evaluationResult: "failed",
    evaluationRationale: "Hallucinated free cancellation.",
    metrics: { durationSecs: 5, turnsCount: 2 },
    rawResult: null,
    errorMessage: null,
    startedAt: new Date().toISOString(),
    scenarioSnapshot: emptyScenarioConfig(),
    personaSnapshot: emptyPersonaConfig(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };

  const createDummyFinding = (overrides: Partial<FailureFindingRecord> = {}): FailureFindingRecord => ({
    id: "finding_1",
    runId: "run_1",
    batchId: "batch_1",
    projectId: "proj_456",
    ownerId: "owner_456",
    targetAgentId: "agent_456",
    testedVersion: 1,
    category: "unsupported_answer",
    severity: "major",
    title: "Hallucinated free cancellation policy",
    description: "The agent promised free cancellation anytime, which violates policy.",
    evidenceReferences: [
      {
        messageIndex: 3,
        role: "agent",
        excerpt: "Yes, you can cancel at any time free of charge.",
      },
    ],
    expectedBehavior: "State that cancellations within 24 hours incur a one-night fee.",
    observedBehavior: "Promised unconditional free cancellation.",
    discrepancyExplanation: "Breaches standard hotel cancellation terms.",
    confidence: "proven",
    isActionable: true,
    suggestedAction: "Add cancellation policy constraint to guardrails and instructions.",
    analysisMetadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  it("rejects non-actionable findings", async () => {
    const nonActionable = createDummyFinding({ isActionable: false });
    await expect(generateRemediationFix(nonActionable, dummyRun, dummyAgent)).rejects.toThrow(
      "marked as non-actionable"
    );
  });

  it("generates a validated remediation proposal with targeted diff", async () => {
    const finding = createDummyFinding();
    const updatedConfig = {
      ...sampleConfig(),
      guardrails: {
        ...sampleConfig().guardrails,
        prohibitedActions: [
          ...sampleConfig().guardrails.prohibitedActions,
          "Never promise free cancellation within 24 hours of check-in.",
        ],
      },
    };

    const mockProvider: GenerationProvider = {
      async generate(_req: StructuredRequest): Promise<unknown> {
        return {
          proposedConfig: updatedConfig,
          changeSummary: "Added prohibited action to prevent unauthorized free cancellation promises.",
          rationale: "Aligns agent promises directly with official cancellation policy constraints.",
          expectedImprovement: "Customer inquiries regarding cancellations will receive correct policy details.",
          potentialRisks: "None; adds clarity without restricting genuine booking assistance.",
        };
      },
    };

    const proposal = await generateRemediationFix(finding, dummyRun, dummyAgent, mockProvider);

    expect(proposal.changeSummary).toContain("Added prohibited action");
    expect(proposal.rationale).toBeDefined();
    expect(proposal.expectedImprovement).toBeDefined();
    expect(proposal.potentialRisks).toBeDefined();

    // Verify proposedConfig is a strictly valid AgentConfig
    const parseResult = agentConfigSchema.safeParse(proposal.proposedConfig);
    expect(parseResult.success).toBe(true);

    // Verify calculated fieldChanges
    expect(proposal.fieldChanges.length).toBeGreaterThan(0);
    const guardrailChange = proposal.fieldChanges.find((c) => c.path.includes("guardrails"));
    expect(guardrailChange).toBeDefined();
    expect(guardrailChange?.after).toContain("Never promise free cancellation");
  });
});
