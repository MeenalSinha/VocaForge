import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createProject } from "@/server/projects/service";
import { createAgent, type AgentContext } from "@/server/agents/service";
import { createPersona, createScenario } from "@/server/personas/service";
import { emptyPersonaConfig, emptyScenarioConfig } from "@/server/personas/schema";
import { sampleConfig } from "../sample-config";
import {
  getSimulationBatch,
  getSimulationRun,
  listSimulationBatches,
  pollSimulationBatch,
  rerunSimulationRun,
  runPreflightCheck,
  startSimulationBatch,
  type SimulationRemote,
} from "@/server/simulations/service";
import type {
  CreateSimulationTestInput,
  TestInvocation,
} from "@/server/integrations/elevenlabs/schemas";

export function simulationServiceSuite(getStore: () => Pool) {
  let projectId: string;
  let agentId: string;
  let personaId: string;
  let scenarioId: string;
  const ownerId = "test-owner-sim-1";

  // Mock remote implementation tracking calls
  let createTestCalls: CreateSimulationTestInput[] = [];
  let runTestsCalls: { agentId: string; testIds: string[] }[] = [];
  let currentInvocationResult: TestInvocation = {
    id: "inv_12345",
    test_runs: [],
  };

  const mockRemote: SimulationRemote = {
    async createSimulationTest(input: CreateSimulationTestInput): Promise<{ testId: string }> {
      createTestCalls.push(input);
      return { testId: `remote_test_${createTestCalls.length}` };
    },
    async runTests(targetAgentId: string, testIds: string[]): Promise<TestInvocation> {
      runTestsCalls.push({ agentId: targetAgentId, testIds });
      return { id: "inv_12345", test_runs: [] };
    },
    async getTestInvocation(_invocationId: string): Promise<TestInvocation> {
      return currentInvocationResult;
    },
  };

  const ctx = (customRemote: SimulationRemote = mockRemote) => ({
    store: getStore(),
    ownerId,
    remote: customRemote,
  });

  describe("Simulation & Execution Engine Integration Suite", () => {
    it("provisions project, synced agent, persona, and scenario", async () => {
      // 1. Create Project
      const project = await createProject(
        { name: `Sim Test Workspace ${Date.now()}`, description: "Simulation workspace" },
        { store: getStore(), ownerId },
      );
      projectId = project.id;

      // 2. Create Synced Agent
      const mockAgentRemote = {
        async createAgentFromPayload() {
          return { agentId: "el_agent_test_789" };
        },
        async getAgent() {
          return { agentId: "el_agent_test_789", name: "Support Agent" };
        },
        async updateAgentFromPayload() {
          return { agentId: "el_agent_test_789" };
        },
        async deleteAgent() {},
      };

      const agentResult = await createAgent(
        {
          projectId,
          idempotencyKey: `idem_agent_${Date.now()}`,
          config: sampleConfig(),
        },
        { store: getStore(), ownerId, remote: mockAgentRemote as unknown as NonNullable<AgentContext["remote"]> },
      );
      agentId = agentResult.agent.id;
      expect(agentResult.agent.remoteAgentId).toBe("el_agent_test_789");

      // 3. Create Persona
      const pConfig = emptyPersonaConfig();
      pConfig.personality.traits = ["skeptical", "inquisitive"];
      pConfig.personality.communicationStyle = "Direct";
      pConfig.startingContext.situation = "Customer asking about refund policy";
      pConfig.defaultObjective.intent = "Get full refund";

      const { persona } = await createPersona(
        {
          projectId,
          name: "Jordan Lee",
          description: "Skeptical buyer",
          category: "customer_experience",
          config: pConfig,
        },
        { store: getStore(), ownerId },
      );
      personaId = persona.id;

      // 4. Create Scenario
      const scConfig = emptyScenarioConfig();
      scConfig.objective.primaryGoal = "Understand refund timeline";
      scConfig.objective.expectedOutcome = "Agent explains 5-7 business days";
      scConfig.startingConditions.situation = "Inquiring about credit card refund";
      scConfig.startingConditions.initialCustomerUtterance = "When will I see the refund in my bank?";
      scConfig.evaluation.successCriteria = ["Agent explicitly mentions 5-7 business days"];
      scConfig.evaluation.failureConditions = ["Agent promises instant cash refund"];
      scConfig.evaluation.prohibitedOutcomes = ["Promising instant cash refund"];

      const { scenario } = await createScenario(
        {
          projectId,
          personaId,
          targetAgentId: agentId,
          name: "Refund Ingestion Test",
          description: "Verify refund explanation",
          config: scConfig,
        },
        { store: getStore(), ownerId },
      );
      scenarioId = scenario.id;

      expect(projectId).toBeDefined();
      expect(agentId).toBeDefined();
      expect(personaId).toBeDefined();
      expect(scenarioId).toBeDefined();
    });

    describe("Preflight Validation", () => {
      it("reports ready when agent is synced and scenario has persona and valid configuration", async () => {
        const preflight = await runPreflightCheck(
          {
            projectId,
            targetAgentId: agentId,
            scenarioIds: [scenarioId],
          },
          ctx(),
        );

        expect(preflight.canExecute).toBe(true);
        expect(preflight.summaryBlockers).toHaveLength(0);
        expect(preflight.targetAgent.remoteAgentId).toBe("el_agent_test_789");
        expect(preflight.scenarios).toHaveLength(1);
        expect(preflight.scenarios[0]?.isReady).toBe(true);
      });

      it("rejects preflight when target agent does not exist", async () => {
        const fakeAgentId = "a0000000-0000-4000-8000-000000000001";
        await expect(
          runPreflightCheck(
            {
              projectId,
              targetAgentId: fakeAgentId,
              scenarioIds: [scenarioId],
            },
            ctx(),
          ),
        ).rejects.toThrow("Target voice agent not found");
      });

      it("rejects preflight when no scenarios are selected", async () => {
        await expect(
          runPreflightCheck(
            {
              projectId,
              targetAgentId: agentId,
              scenarioIds: [],
            },
            ctx(),
          ),
        ).rejects.toThrow("Invalid preflight check input");
      });
    });

    describe("Simulation Batch Lifecycle & Remote Caching", () => {
      let activeBatchId: string;
      let activeRunId: string;

      it("provisions remote test definitions, launches invocation, and persists immutable snapshots", async () => {
        createTestCalls = [];
        runTestsCalls = [];

        const { batch, runs } = await startSimulationBatch(
          {
            projectId,
            targetAgentId: agentId,
            scenarioIds: [scenarioId],
            name: "Automated Refund Verification Run",
            repeatCount: 1,
            concurrency: 1,
          },
          ctx(),
        );

        activeBatchId = batch.id;
        expect(runs).toHaveLength(1);
        activeRunId = runs[0]!.id;

        // Verify remote calls
        expect(createTestCalls).toHaveLength(1);
        expect(runTestsCalls).toHaveLength(1);
        expect(runTestsCalls[0]?.agentId).toBe("el_agent_test_789");

        // Verify batch record
        expect(batch.name).toBe("Automated Refund Verification Run");
        expect(batch.status).toBe("running");
        expect(batch.totalScenarios).toBe(1);
        expect(batch.remoteInvocationId).toBe("inv_12345");

        // Verify run record
        const run = runs[0]!;
        expect(run.batchId).toBe(batch.id);
        expect(run.status).toBe("running");
        expect(run.scenarioName).toBe("Refund Ingestion Test");
        expect(run.personaName).toBe("Jordan Lee");
        expect(run.scenarioSnapshot.objective.primaryGoal).toBe("Understand refund timeline");
        expect(run.personaSnapshot.personality.traits).toContain("skeptical");
      });

      it("reuses cached remote test definition on subsequent runs without calling createSimulationTest again", async () => {
        createTestCalls = []; // Reset call tracker
        runTestsCalls = [];

        const { batch, runs } = await startSimulationBatch(
          {
            projectId,
            targetAgentId: agentId,
            scenarioIds: [scenarioId],
            name: "Second Run Reusing Cache",
          },
          ctx(),
        );

        expect(runs).toHaveLength(1);
        // createSimulationTest should NOT have been called because config hash matched existing record
        expect(createTestCalls).toHaveLength(0);
        // But runTests was called
        expect(runTestsCalls).toHaveLength(1);
        expect(batch.status).toBe("running");
      });

      it("polls batch, persists transcript, and updates status to completed when all runs pass", async () => {
        currentInvocationResult = {
          id: "inv_12345",
          test_runs: [
            {
              test_id: "remote_test_1",
              status: "success",
              condition_result: {
                result: "success",
                rationale: "Agent clearly explained the 5-7 business day turnaround.",
              },
              agent_responses: [
                {
                  role: "user",
                  message: "When will I see the refund in my bank?",
                  time_in_call_secs: 1.2,
                },
                {
                  role: "agent",
                  message: "Refunds typically appear within 5 to 7 business days depending on your bank.",
                  time_in_call_secs: 3.5,
                },
              ],
            },
          ],
        };

        const polled = await pollSimulationBatch(activeBatchId, ctx());

        expect(polled.batch.status).toBe("completed");
        expect(polled.batch.completedScenarios).toBe(1);
        expect(polled.batch.passedScenarios).toBe(1);
        expect(polled.batch.failedScenarios).toBe(0);

        // Check run details
        expect(polled.runs).toHaveLength(1);
        const r = polled.runs[0]!;
        expect(r.status).toBe("passed");
        expect(r.evaluationResult).toBe("passed");
        expect(r.evaluationRationale).toContain("5-7 business day turnaround");
        expect(r.transcript).toHaveLength(2);
        expect(r.transcript[0]?.role).toBe("user");
        expect(r.transcript[1]?.role).toBe("agent");
      });

      it("allows querying batch and run by ID", async () => {
        const { batch, runs } = await getSimulationBatch(activeBatchId, ctx());
        expect(batch.id).toBe(activeBatchId);
        expect(runs).toHaveLength(1);

        const run = await getSimulationRun(activeRunId, ctx());
        expect(run.id).toBe(activeRunId);
        expect(run.transcript).toHaveLength(2);
      });

      it("lists batches scoped by project", async () => {
        const list = await listSimulationBatches({ projectId }, ctx());
        expect(list.length).toBeGreaterThanOrEqual(2);
        expect(list[0]?.projectId).toBe(projectId);
      });

      it("reruns an individual run creating a new run without mutating or deleting historical evidence", async () => {
        const rerunResult = await rerunSimulationRun(activeRunId, ctx());

        expect(rerunResult.batch.id).not.toBe(activeBatchId);
        expect(rerunResult.runs).toHaveLength(1);
        expect(rerunResult.runs[0]?.id).not.toBe(activeRunId);
        expect(rerunResult.runs[0]?.scenarioName).toBe("Refund Ingestion Test");

        // Original run remains intact with passed status
        const originalRun = await getSimulationRun(activeRunId, ctx());
        expect(originalRun.id).toBe(activeRunId);
        expect(originalRun.status).toBe("passed");
        expect(originalRun.evaluationResult).toBe("passed");
      });
    });
  });
}
