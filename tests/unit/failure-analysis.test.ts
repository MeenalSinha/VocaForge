import { describe, expect, it } from "vitest";
import { analyzeSimulationRun } from "@/server/analysis/analyzer";
import type { SimulationRunRecord } from "@/server/simulations/schema";
import type { Agent } from "@/server/agents/repository";
import { sampleConfig } from "../sample-config";
import type { GenerationProvider, StructuredRequest } from "@/server/generation/provider";
import { FAILURE_CATEGORIES, CATEGORY_DEFINITIONS } from "@/server/analysis/categories";
import { emptyPersonaConfig, emptyScenarioConfig } from "@/server/personas/schema";

describe("Failure Analysis Engine", () => {
  const dummyAgent: Agent = {
    id: "agent_123",
    projectId: "proj_123",
    name: "Front Desk Agent",
    description: "Hotel support",
    useCase: "hotel",
    creationPrompt: null,
    config: sampleConfig(),
    configVersion: 1,
    syncedVersion: 1,
    voiceId: "voice_1",
    primaryLanguage: "en",
    remoteAgentId: "remote_agent_abc",
    status: "active",
    remoteCheckedAt: new Date().toISOString(),
    remoteStatusNote: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const createBaseRun = (overrides: Partial<SimulationRunRecord> = {}): SimulationRunRecord => ({
    id: "run_test_1",
    batchId: "batch_test_1",
    projectId: "proj_123",
    ownerId: "owner_123",
    targetAgentId: "agent_123",
    personaId: "persona_1",
    scenarioId: "scenario_1",
    scenarioName: "Booking Inquiry",
    personaName: "Impatient Caller",
    remoteTestId: "test_remote_1",
    remoteTestRunId: "run_remote_1",
    remoteInvocationId: "inv_1",
    status: "failed_evaluation",
    transcript: [
      { role: "agent", message: "Hello! Welcome to our hotel. How may I help you?", timeInCallSecs: 1 },
      { role: "user", message: "I want to book a room for tonight.", timeInCallSecs: 3 },
      { role: "agent", message: "I cannot help you with that.", timeInCallSecs: 5 },
    ],
    evaluationResult: "failed",
    evaluationRationale: "The agent refused to take a booking and gave an unsupported answer.",
    metrics: { durationSecs: 6, turnsCount: 3 },
    rawResult: null,
    errorMessage: null,
    startedAt: new Date().toISOString(),
    scenarioSnapshot: {
      ...emptyScenarioConfig(),
      objective: {
        primaryGoal: "Book a hotel room for tonight",
        expectedOutcome: "Reservation confirmed",
        requiredInformation: ["dates"],
        deliberatelyWithheld: [],
      },
    },
    personaSnapshot: emptyPersonaConfig(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...overrides,
  });

  it("exposes all 12 defined failure categories with labels and descriptions", () => {
    expect(FAILURE_CATEGORIES.length).toBe(12);
    for (const cat of FAILURE_CATEGORIES) {
      expect(CATEGORY_DEFINITIONS[cat]).toBeDefined();
      expect(CATEGORY_DEFINITIONS[cat].label.length).toBeGreaterThan(0);
      expect(CATEGORY_DEFINITIONS[cat].description.length).toBeGreaterThan(0);
    }
  });

  it("rejects non-failed runs (pending, running, or passed)", async () => {
    const runningRun = createBaseRun({ status: "running" });
    await expect(analyzeSimulationRun(runningRun, dummyAgent)).rejects.toThrow(
      "Cannot analyze an in-progress or pending simulation run."
    );

    const passedRun = createBaseRun({ status: "passed", evaluationResult: "passed" });
    await expect(analyzeSimulationRun(passedRun, dummyAgent)).rejects.toThrow(
      "Cannot perform failure analysis on a passing simulation run."
    );
  });

  it("handles infrastructure errors without falsely blaming the agent", async () => {
    const infraRun = createBaseRun({
      status: "infrastructure_error",
      errorMessage: "ElevenLabs API gateway timed out during webhook dispatch.",
    });

    const finding = await analyzeSimulationRun(infraRun, dummyAgent);
    expect(finding.category).toBe("insufficient_evidence");
    expect(finding.isActionable).toBe(false);
    expect(finding.severity).toBe("minor");
    expect(finding.description).toContain("timed out");
  });

  it("uses deterministic diagnostics to detect premature call termination (< 2 turns)", async () => {
    const prematureRun = createBaseRun({
      transcript: [{ role: "agent", message: "Goodbye.", timeInCallSecs: 1 }],
      status: "failed_evaluation",
      evaluationRationale: "The agent disconnected prematurely before conversation started.",
    });

    const finding = await analyzeSimulationRun(prematureRun, dummyAgent);
    expect(finding.category).toBe("premature_end");
    expect(finding.severity).toBe("critical");
    expect(finding.confidence).toBe("proven");
    expect(finding.isActionable).toBe(true);
    expect(finding.evidenceReferences.length).toBeGreaterThanOrEqual(1);
  });

  it("uses model generation provider when deterministic rules do not trigger", async () => {
    const run = createBaseRun();

    const mockProvider: GenerationProvider = {
      async generate(_req: StructuredRequest): Promise<unknown> {
        return {
          category: "objective_failed",
          severity: "major",
          title: "Agent refused room booking request",
          description: "Customer asked to book for tonight, but agent stated 'I cannot help you with that.'",
          evidenceReferences: [
            {
              messageIndex: 2,
              role: "agent",
              excerpt: "I cannot help you with that.",
              note: "Direct refusal of hotel booking service.",
            },
          ],
          expectedBehavior: "Agent should ask for room type, guest count, and dates to complete booking.",
          observedBehavior: "Agent gave a flat refusal without providing booking alternatives.",
          discrepancyExplanation: "Refusing customers seeking bookings violates primary customer service goal.",
          confidence: "proven",
          isActionable: true,
          suggestedAction: "Update instructions with explicit procedure for accepting booking inquiries.",
        };
      },
    };

    const finding = await analyzeSimulationRun(run, dummyAgent, mockProvider);
    expect(finding.category).toBe("objective_failed");
    expect(finding.severity).toBe("major");
    expect(finding.confidence).toBe("proven");
    expect(finding.evidenceReferences).toHaveLength(1);
    expect(finding.evidenceReferences[0]?.excerpt).toBe("I cannot help you with that.");
    expect(finding.isActionable).toBe(true);
  });
});
