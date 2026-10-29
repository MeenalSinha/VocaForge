import { beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createMemoryStore } from "./helpers";
import { createProject } from "@/server/projects/service";
import { createAgent, saveAgentConfig } from "@/server/agents/service";
import { createPersona, createScenario } from "@/server/personas/service";
import { emptyPersonaConfig, emptyScenarioConfig } from "@/server/personas/schema";
import { sampleConfig } from "../sample-config";
import {
  startSimulationBatch,
  type SimulationRemote,
} from "@/server/simulations/service";
import { updateRun, findRun } from "@/server/simulations/repository";
import {
  analyzeRun,
  getFindingsForRun,
  createFixProposal,
  getFixProposal,
  approveFixProposal,
  applyFixProposal,
  retestFixProposal,
  buildAndStoreComparison,
  getComparisonForRun,
} from "@/server/analysis/service";
import type { GenerationProvider, StructuredRequest } from "@/server/generation/provider";

let pool: Pool;
beforeAll(async () => {
  pool = await createMemoryStore();
});

describe("Phase 5: Intelligence & Closed-Loop Refinement (pg-mem)", () => {
  const ownerId = "owner_phase5_test";
  let projectId: string;
  let agentId: string;
  let personaId: string;
  let scenarioId: string;
  let runId: string;

  const mockRemote: SimulationRemote = {
    async createSimulationTest() {
      return { testId: "test_remote_mock" };
    },
    async runTests() {
      return { id: "inv_mock", test_runs: [] };
    },
    async getTestInvocation() {
      return { id: "inv_mock", test_runs: [] };
    },
  };

  const mockProvider: GenerationProvider = {
    async generate(_req: StructuredRequest): Promise<unknown> {
      return {
        proposedConfig: {
          ...sampleConfig(),
          behavior: {
            ...sampleConfig().behavior,
            instructions: sampleConfig().behavior.instructions + "\nAlways answer politely.",
          },
        },
        changeSummary: "Updated agent instructions to guarantee polite responses.",
        rationale: "Failure was caused by blunt refusals.",
        expectedImprovement: "Customer will receive polite explanations.",
        potentialRisks: "None.",
      };
    },
  };

  it("sets up project, agent, persona, and failing simulation run", async () => {
    const project = await createProject({ name: "Phase 5 Suite Project" }, { store: pool, ownerId });
    projectId = project.id;

    const agentRes = await createAgent(
      {
        projectId,
        config: sampleConfig(),
        idempotencyKey: "idem_key_phase5_agent",
      },
      {
        store: pool,
        ownerId,
        remote: {
          async createAgentFromPayload() {
            return { agentId: "remote_agent_123" };
          },
          async getAgent() {
            return {
              agent_id: "remote_agent_123",
              name: "Desk",
              conversation_config: {},
            };
          },
          async updateAgent() {},
          async deleteAgent() {},
          async getSignedUrl() {
            return "https://api.elevenlabs.io/signed-url";
          },
        },
      }
    );
    agentId = agentRes.agent.id;

    const pConfig = emptyPersonaConfig();
    pConfig.personality.traits = ["skeptical", "inquisitive"];
    pConfig.personality.communicationStyle = "Direct";
    pConfig.startingContext.situation = "Customer asking about refund policy";
    pConfig.defaultObjective.intent = "Get full refund";

    const personaRes = await createPersona(
      { projectId, name: "Frustrated Customer", config: pConfig },
      { store: pool, ownerId }
    );
    personaId = personaRes.persona.id;

    const scConfig = emptyScenarioConfig();
    scConfig.objective.primaryGoal = "Understand refund timeline";
    scConfig.objective.expectedOutcome = "Agent explains 5-7 business days";
    scConfig.startingConditions.situation = "Inquiring about credit card refund";
    scConfig.startingConditions.initialCustomerUtterance = "When will I see the refund in my bank?";
    scConfig.evaluation.successCriteria = ["Agent explicitly mentions 5-7 business days"];
    scConfig.evaluation.failureConditions = ["Agent promises instant cash refund"];
    scConfig.evaluation.prohibitedOutcomes = ["Promising instant cash refund"];

    const scenarioRes = await createScenario(
      { projectId, personaId, name: "Billing Dispute", config: scConfig },
      { store: pool, ownerId }
    );
    scenarioId = scenarioRes.scenario.id;

    // Start simulation batch
    const batchRes = await startSimulationBatch(
      {
        projectId,
        name: "Initial Failure Run",
        targetAgentId: agentId,
        scenarioIds: [scenarioId],
      },
      { store: pool, ownerId, remote: mockRemote }
    );

    const firstRun = batchRes.runs[0];
    expect(firstRun).toBeDefined();
    if (!firstRun) return;
    runId = firstRun.id;

    // Mark run as failed_evaluation with realistic evaluation details
    await updateRun(
      pool,
      ownerId,
      runId,
      {
        status: "failed_evaluation",
        evaluationResult: "failed",
        evaluationRationale: "The agent hung up prematurely after only 1 turn.",
        transcript: [{ role: "agent", message: "Goodbye.", timeInCallSecs: 1 }],
        metrics: { turnsCount: 1, durationSecs: 2 },
      }
    );

    const updated = await findRun(pool, ownerId, runId);
    expect(updated?.status).toBe("failed_evaluation");
  });

  it("analyzes the failure and creates a persistent FailureFindingRecord", async () => {
    const findings = await analyzeRun(
      runId,
      { forceRegenerate: false },
      { store: pool, ownerId, generationProvider: mockProvider }
    );

    expect(findings.length).toBeGreaterThan(0);
    const finding = findings[0];
    expect(finding).toBeDefined();
    if (!finding) return;

    expect(finding.id).toBeDefined();
    expect(finding.targetAgentId).toBe(agentId);
    expect(finding.category).toBe("premature_end");
    expect(finding.isActionable).toBe(true);

    const fetchedFindings = await getFindingsForRun(runId, { store: pool, ownerId });
    expect(fetchedFindings.length).toBe(1);
    expect(fetchedFindings[0]?.id).toBe(finding.id);
  });

  it("generates an evidence-backed fix proposal and supports review cycle (approve/reject)", async () => {
    const findings = await getFindingsForRun(runId, { store: pool, ownerId });
    const finding = findings[0];
    expect(finding).toBeDefined();
    if (!finding) return;

    // Create Proposal
    const proposal = await createFixProposal(
      finding.id,
      { store: pool, ownerId, generationProvider: mockProvider }
    );

    expect(proposal.id).toBeDefined();
    expect(proposal.baseVersion).toBe(1);
    expect(proposal.status).toBe("pending_review");
    expect(proposal.fieldChanges.length).toBeGreaterThan(0);

    // Approve proposal
    const approved = await approveFixProposal(proposal.id, { store: pool, ownerId });
    expect(approved.status).toBe("approved");

    const fetched = await getFixProposal(proposal.id, { store: pool, ownerId });
    expect(fetched?.status).toBe("approved");
  });

  it("applies the fix proposal, increments agent version to v2, and tracks status", async () => {
    const findings = await getFindingsForRun(runId, { store: pool, ownerId });
    const finding = findings[0];
    expect(finding).toBeDefined();
    if (!finding) return;

    const proposal = await createFixProposal(
      finding.id,
      { store: pool, ownerId, generationProvider: mockProvider }
    );

    // Apply proposal
    const result = await applyFixProposal(proposal.id, { reconcileStale: false }, { store: pool, ownerId });
    expect(result.newVersion).toBe(2);
    expect(["applied_locally", "synced_remotely", "sync_failed"]).toContain(result.proposal.status);
  });

  it("detects stale base version and rejects conflicting applications without reconcile flag", async () => {
    const findings = await getFindingsForRun(runId, { store: pool, ownerId });
    const finding = findings[0];
    expect(finding).toBeDefined();
    if (!finding) return;

    const proposal = await createFixProposal(
      finding.id,
      { store: pool, ownerId, generationProvider: mockProvider }
    );

    // Manually bump agent version to v3
    const updatedCfg = {
      ...sampleConfig(),
      identity: { ...sampleConfig().identity, name: "Desk Agent Renamed" },
    };
    await saveAgentConfig(
      agentId,
      { config: updatedCfg, baseVersion: 2, summary: "manual update" },
      { store: pool, ownerId }
    );

    // Attempting to apply proposal without reconcileStale throws ConflictError
    await expect(
      applyFixProposal(proposal.id, { reconcileStale: false }, { store: pool, ownerId })
    ).rejects.toThrow("Agent has been modified");

    // Applying with reconcileStale: true succeeds
    const reconciled = await applyFixProposal(
      proposal.id,
      { reconcileStale: true },
      { store: pool, ownerId }
    );
    expect(reconciled.newVersion).toBe(4);
  });

  it("executes retest and records before-and-after RetestComparisonRecord", async () => {
    const findings = await getFindingsForRun(runId, { store: pool, ownerId });
    const finding = findings[0];
    expect(finding).toBeDefined();
    if (!finding) return;

    const proposal = await createFixProposal(
      finding.id,
      { store: pool, ownerId, generationProvider: mockProvider }
    );
    await applyFixProposal(proposal.id, { reconcileStale: true }, { store: pool, ownerId });

    // Retest
    const retestResult = await retestFixProposal(proposal.id, [], { store: pool, ownerId, simulationRemote: mockRemote });
    expect(retestResult.retestBatchId).toBeDefined();

    // Create a retest run with valid UUID
    const retestRunId = "a0000000-0000-0000-0000-000000000001";
    await pool.query(
      `INSERT INTO simulation_runs (
        id, batch_id, project_id, owner_id, target_agent_id, scenario_id, persona_id,
        scenario_name, persona_name, scenario_snapshot, persona_snapshot, status,
        evaluation_result, evaluation_rationale, transcript, metrics
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )`,
      [
        retestRunId,
        retestResult.retestBatchId,
        projectId,
        ownerId,
        agentId,
        scenarioId,
        personaId,
        "Billing Dispute",
        "Frustrated Customer",
        JSON.stringify(emptyScenarioConfig()),
        JSON.stringify(emptyPersonaConfig()),
        "passed",
        "passed",
        "Agent handled all instructions properly and resolved the call.",
        JSON.stringify([
          { role: "agent", message: "Hello! How can I help you today?", timeInCallSecs: 1 },
          { role: "user", message: "I have a billing issue.", timeInCallSecs: 3 },
          { role: "agent", message: "I would be happy to resolve your billing inquiry.", timeInCallSecs: 5 },
        ]),
        JSON.stringify({ turnsCount: 3, durationSecs: 6 }),
      ]
    );

    // Build and store comparison
    const comp = await buildAndStoreComparison(proposal.id, runId, retestRunId, { store: pool, ownerId });
    expect(comp.failureResolved).toBe(true);
    expect(comp.outcomeChanged).toBe(true);
    expect(comp.comparisonSummary).toContain("Fixed!");

    // Retrieve comparison by original run ID
    const retrieved = await getComparisonForRun(runId, { store: pool, ownerId });
    expect(retrieved?.id).toBe(comp.id);
    expect(retrieved?.failureResolved).toBe(true);
  });
});
