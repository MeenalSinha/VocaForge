import { describe, expect, it } from "vitest";
import { evaluateReleaseReadiness } from "@/server/deployments/readiness";
import type { Agent } from "@/server/agents/repository";
import type { SimulationRunRecord } from "@/server/simulations/schema";
import type { FailureFindingRecord } from "@/server/analysis/schema";
import { sampleConfig } from "../sample-config";
import { emptyPersonaConfig, emptyScenarioConfig } from "@/server/personas/schema";

function mockAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    projectId: "project-1",
    projectName: "Test Project",
    name: "Customer Support Agent",
    description: "Support specialist",
    useCase: "Support",
    creationPrompt: null,
    status: "active",
    configVersion: 1,
    syncedVersion: 1,
    voiceId: "voice-123",
    primaryLanguage: "en",
    remoteAgentId: "remote-agent-abc",
    remoteCheckedAt: null,
    remoteStatusNote: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config: sampleConfig(),
    ...overrides,
  };
}

function mockRun(id: string, status: "passed" | "failed_evaluation"): SimulationRunRecord {
  return {
    id,
    batchId: "batch-1",
    projectId: "project-1",
    ownerId: null,
    targetAgentId: "agent-1",
    scenarioId: "scenario-1",
    personaId: "persona-1",
    scenarioName: "Account Inquiry",
    personaName: "Sarah Connor",
    status,
    evaluationResult: status === "passed" ? "passed" : "failed",
    evaluationRationale: "Rationale",
    transcript: [],
    metrics: {},
    errorMessage: null,
    scenarioSnapshot: emptyScenarioConfig(),
    personaSnapshot: emptyPersonaConfig(),
    remoteTestId: null,
    remoteTestRunId: null,
    remoteInvocationId: null,
    rawResult: null,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mockFinding(id: string, severity: "critical" | "major" | "minor"): FailureFindingRecord {
  return {
    id,
    runId: "run-1",
    batchId: "batch-1",
    projectId: "project-1",
    ownerId: null,
    targetAgentId: "agent-1",
    testedVersion: 1,
    category: "policy_violation",
    severity,
    title: `Sample ${severity} finding`,
    description: "Detailed description",
    evidenceReferences: [],
    expectedBehavior: "Expected behavior",
    observedBehavior: "Observed behavior",
    discrepancyExplanation: "Discrepancy explanation",
    confidence: "proven",
    isActionable: true,
    suggestedAction: "Update guardrails",
    analysisMetadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("evaluateReleaseReadiness", () => {
  it("passes when agent is valid, synced, has >=80% pass rate, and zero critical findings", () => {
    const agent = mockAgent();
    const runs = [mockRun("r1", "passed"), mockRun("r2", "passed")];
    const findings: FailureFindingRecord[] = [];

    const snapshot = evaluateReleaseReadiness(agent, null, runs, findings);

    expect(snapshot.isReady).toBe(true);
    expect(snapshot.blockers).toHaveLength(0);
    expect(snapshot.passRatePercentage).toBe(100);
    expect(snapshot.score).toBe(100);
    expect(snapshot.isSyncedRemotely).toBe(true);
  });

  it("blocks release when agent is not synced remotely with ElevenLabs", () => {
    const agent = mockAgent({ syncedVersion: 0 }); // out of sync: configVersion is 1
    const runs = [mockRun("r1", "passed")];

    const snapshot = evaluateReleaseReadiness(agent, null, runs, []);

    expect(snapshot.isReady).toBe(false);
    expect(snapshot.isSyncedRemotely).toBe(false);
    expect(snapshot.blockers.some((b) => b.includes("differs from ElevenLabs synced version"))).toBe(true);
  });

  it("blocks release when zero simulation runs have been recorded", () => {
    const agent = mockAgent();
    const runs: SimulationRunRecord[] = [];

    const snapshot = evaluateReleaseReadiness(agent, null, runs, []);

    expect(snapshot.isReady).toBe(false);
    expect(snapshot.testedRunsCount).toBe(0);
    expect(snapshot.blockers.some((b) => b.includes("At least one completed simulation scenario"))).toBe(true);
  });

  it("blocks release when evaluation pass rate is below 80%", () => {
    const agent = mockAgent();
    // 1 passed, 2 failed -> 33% pass rate
    const runs = [
      mockRun("r1", "passed"),
      mockRun("r2", "failed_evaluation"),
      mockRun("r3", "failed_evaluation"),
    ];

    const snapshot = evaluateReleaseReadiness(agent, null, runs, []);

    expect(snapshot.isReady).toBe(false);
    expect(snapshot.passRatePercentage).toBe(33);
    expect(snapshot.blockers.some((b) => b.includes("below the required 80% threshold"))).toBe(true);
  });

  it("blocks release when an actionable critical failure finding exists", () => {
    const agent = mockAgent();
    const runs = [
      mockRun("r1", "passed"),
      mockRun("r2", "passed"),
      mockRun("r3", "passed"),
      mockRun("r4", "passed"),
      mockRun("r5", "passed"),
    ];
    const findings = [mockFinding("f1", "critical")];

    const snapshot = evaluateReleaseReadiness(agent, null, runs, findings);

    expect(snapshot.isReady).toBe(false);
    expect(snapshot.hasCriticalFindings).toBe(true);
    expect(snapshot.blockers.some((b) => b.includes("critical failure finding(s) detected"))).toBe(true);
  });

  it("produces warnings rather than blockers for major findings and side-effect capabilities", () => {
    const agent = mockAgent({
      config: {
        ...mockAgent().config,
        capabilities: [
          {
            name: "book_appointment",
            description: "Books an appointment on caller calendar",
            status: "unavailable",
            note: "needs review",
          },
        ],
      },
    });
    const runs = [mockRun("r1", "passed")];
    const findings = [mockFinding("f1", "major")];

    const snapshot = evaluateReleaseReadiness(agent, null, runs, findings);

    expect(snapshot.isReady).toBe(true); // not blocked!
    expect(snapshot.blockers).toHaveLength(0);
    expect(snapshot.warnings.some((w) => w.includes("major finding(s) identified"))).toBe(true);
    expect(snapshot.warnings.some((w) => w.includes("book_appointment"))).toBe(true);
  });
});
