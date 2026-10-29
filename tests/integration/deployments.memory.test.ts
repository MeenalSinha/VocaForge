import { beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createMemoryStore } from "./helpers";
import { createProject } from "@/server/projects/service";
import { createAgent, saveAgentConfig, type AgentContext } from "@/server/agents/service";
import { createPersona, createScenario } from "@/server/personas/service";
import { emptyPersonaConfig, emptyScenarioConfig } from "@/server/personas/schema";
import { sampleConfig } from "../sample-config";
import {
  startSimulationBatch,
  type SimulationRemote,
} from "@/server/simulations/service";
import { updateRun } from "@/server/simulations/repository";
import {
  checkAgentReleaseReadiness,
  createDeployment,
  promoteDeployment,
  rollbackAgent,
  listDeployments,
  getDeployment,
} from "@/server/deployments/service";
import {
  getObservabilityMetrics,
  getExecutionHistory,
} from "@/server/observability/service";

let pool: Pool;
beforeAll(async () => {
  pool = await createMemoryStore();
});

describe("Phase 6: Deployment, Observability & Reliability (pg-mem)", () => {
  const ownerId = "owner_phase6_test";
  let projectId: string;
  let agentId: string;
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

  const mockAgentRemote: NonNullable<AgentContext["remote"]> = {
    async createAgentFromPayload() {
      return { agentId: "remote_123" };
    },
    async getAgent() {
      return { agent_id: "remote_123", name: "Desk", conversation_config: {} };
    },
    async updateAgent() {
      return undefined;
    },
    async deleteAgent() {
      return undefined;
    },
    async getSignedUrl() {
      return "wss://example.invalid";
    },
  };

  beforeAll(async () => {
    // 1. Create Project
    const project = await createProject({ name: "Phase 6 Production Voice Portal" }, { store: pool, ownerId });
    projectId = project.id;

    // 2. Create Agent
    const agentRes = await createAgent(
      {
        projectId,
        config: sampleConfig(),
        idempotencyKey: "idem_key_phase6_agent",
      },
      { store: pool, ownerId, remote: mockAgentRemote },
    );
    agentId = agentRes.agent.id;

    // Simulate remote provisioning
    await pool.query(
      "UPDATE agents SET remote_agent_id = 'remote_123', synced_version = 1 WHERE id = $1",
      [agentId],
    );

    // 3. Create Persona & Scenario
    const pConfig = emptyPersonaConfig();
    pConfig.personality.traits = ["professional", "focused"];
    pConfig.personality.communicationStyle = "Direct";
    pConfig.startingContext.situation = "Inquiring about account security settings";
    pConfig.defaultObjective.intent = "Verify security credentials";

    const personaRes = await createPersona(
      {
        projectId,
        name: "Enterprise Caller",
        config: pConfig,
      },
      { store: pool, ownerId },
    );
    const personaId = personaRes.persona.id;

    const scConfig = emptyScenarioConfig();
    scConfig.objective.primaryGoal = "Security verification check";
    scConfig.objective.expectedOutcome = "Agent verifies caller identity securely";
    scConfig.startingConditions.situation = "Caller requires identity check";
    scConfig.startingConditions.initialCustomerUtterance = "Hello, I need to verify my account.";
    scConfig.evaluation.successCriteria = ["Agent verifies caller identity securely"];
    scConfig.evaluation.failureConditions = ["Agent shares info without verification"];

    const scenarioRes = await createScenario(
      {
        projectId,
        personaId,
        targetAgentId: agentId,
        name: "Security Verification",
        config: scConfig,
      },
      { store: pool, ownerId },
    );
    const scenarioId = scenarioRes.scenario.id;

    // 4. Run Simulation
    const batch = await startSimulationBatch(
      {
        projectId,
        name: "Phase 6 Test Batch",
        targetAgentId: agentId,
        scenarioIds: [scenarioId],
      },
      { store: pool, ownerId, remote: mockRemote },
    );

    runId = batch.runs[0]!.id;

    // Mark run as passed
    await updateRun(pool, ownerId, runId, {
      status: "passed",
      evaluationResult: "passed",
      evaluationRationale: "Completed without policy deviation.",
      completedAt: new Date(),
    });
  });

  it("checks release readiness and identifies passing status for a fully-tested agent", async () => {
    const result = await checkAgentReleaseReadiness(agentId, { store: pool, ownerId });

    expect(result.agent).not.toBeNull();
    expect(result.agent!.id).toBe(agentId);
    expect(result.readiness.isReady).toBe(true);
    expect(result.readiness.passRatePercentage).toBe(100);
    expect(result.readiness.testedRunsCount).toBe(1);
    expect(result.readiness.blockers).toHaveLength(0);
    expect(result.readiness.checks.length).toBeGreaterThanOrEqual(4);
  });

  it("creates a release candidate and promotes it to deployed status in production", async () => {
    // Create candidate
    const candidate = await createDeployment(
      {
        projectId,
        agentId,
        agentVersion: 1,
        environment: "production",
        notes: "Initial v1 release candidate for production",
      },
      { store: pool, ownerId },
    );

    expect(candidate.id).toBeDefined();
    expect(candidate.status).toBe("ready_for_release");
    expect(candidate.environment).toBe("production");
    expect(candidate.deployedAt).toBeNull();

    // Verify candidate is retrievable
    const fetched = await getDeployment(candidate.id, { store: pool, ownerId });
    expect(fetched.id).toBe(candidate.id);
    expect(fetched.agentName).toBe("Desk");

    // Promote candidate to production
    const promoted = await promoteDeployment(
      candidate.id,
      { notes: "Promoted to live callers" },
      { store: pool, ownerId, agentRemote: mockAgentRemote },
    );

    expect(promoted.status).toBe("deployed");
    expect(promoted.deployedAt).not.toBeNull();
    expect(promoted.notes).toBe("Promoted to live callers");

    // Active deployment query reflects new release
    const list = await listDeployments(projectId, "production", { store: pool, ownerId });
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some((d) => d.id === candidate.id && d.status === "deployed")).toBe(true);
  });

  it("safely archives older active deployments when a new deployment is promoted", async () => {
    // Create v2 configuration
    const modifiedConfig = {
      ...sampleConfig(),
      behavior: {
        ...sampleConfig().behavior,
        instructions: "v2 instructions with upgraded capabilities",
      },
    };
    await saveAgentConfig(
      agentId,
      {
        config: modifiedConfig,
        baseVersion: 1,
        summary: "Upgraded instructions for v2",
      },
      { store: pool, ownerId },
    );

    // Sync remote v2
    await pool.query(
      "UPDATE agents SET synced_version = 2 WHERE id = $1",
      [agentId],
    );

    // Create and promote v2 deployment
    const v2Candidate = await createDeployment(
      {
        projectId,
        agentId,
        agentVersion: 2,
        environment: "production",
      },
      { store: pool, ownerId },
    );

    const v2Promoted = await promoteDeployment(
      v2Candidate.id,
      { forceDeploy: true },
      { store: pool, ownerId, agentRemote: mockAgentRemote },
    );

    expect(v2Promoted.status).toBe("deployed");
    expect(v2Promoted.agentVersion).toBe(2);

    // Check previous deployment is archived
    const deployments = await listDeployments(projectId, "production", { store: pool, ownerId });
    const active = deployments.filter((d) => d.status === "deployed");
    expect(active.length).toBe(1);
    expect(active[0]!.id).toBe(v2Candidate.id);

    const archived = deployments.filter((d) => d.status === "archived");
    expect(archived.length).toBeGreaterThanOrEqual(1);
  });

  it("performs safe non-destructive rollback, creating an immutable new version and deployment record", async () => {
    // Current version is v2. Rollback to v1!
    const rollbackResult = await rollbackAgent(
      agentId,
      1,
      {
        environment: "production",
        reason: "Regressed prompt quality in v2; rolling back to verified v1 baseline",
      },
      { store: pool, ownerId, agentRemote: mockAgentRemote },
    );

    expect(rollbackResult.newVersion).toBe(3);
    expect(rollbackResult.deployment.status).toBe("rolled_back");
    expect(rollbackResult.deployment.agentVersion).toBe(3);
    expect(rollbackResult.agent).not.toBeNull();
    expect(rollbackResult.agent!.configVersion).toBe(3);
    expect(rollbackResult.agent!.config.behavior.instructions).toBe(
      sampleConfig().behavior.instructions,
    );
  });

  it("computes accurate observability telemetry and metrics without fabrication", async () => {
    const metrics = await getObservabilityMetrics(projectId, { store: pool, ownerId });

    expect(metrics.totalRuns).toBe(1);
    expect(metrics.completedEvaluations).toBe(1);
    expect(metrics.passedEvaluations).toBe(1);
    expect(metrics.failedEvaluations).toBe(0);
    expect(metrics.infrastructureErrors).toBe(0);
    expect(metrics.passingRatePercentage).toBe(100);
    expect(metrics.deployedAgentsCount).toBe(1);
    expect(metrics.categoryDistribution).toBeDefined();

    // Verify filterable execution history
    const history = await getExecutionHistory(
      projectId,
      {
        status: "passed",
        search: "Security",
      },
      { store: pool, ownerId },
    );

    expect(history.length).toBe(1);
    expect(history[0]!.scenarioName).toBe("Security Verification");
    expect(history[0]!.personaName).toBe("Enterprise Caller");
    expect(history[0]!.status).toBe("passed");
  });
});
