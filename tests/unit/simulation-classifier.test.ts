import { describe, expect, it } from "vitest";
import {
  aggregateBatchOutcomes,
  classifyRemoteRun,
  normalizeTranscript,
} from "@/server/simulations/classifier";
import type { TestRun } from "@/server/integrations/elevenlabs/schemas";
import type { SimulationRunRecord } from "@/server/simulations/schema";
import { emptyPersonaConfig, emptyScenarioConfig } from "@/server/personas/schema";

describe("Simulation Classifier & Normalizer", () => {
  describe("normalizeTranscript", () => {
    it("returns an empty array when input is null, undefined, or empty", () => {
      expect(normalizeTranscript(null)).toEqual([]);
      expect(normalizeTranscript(undefined)).toEqual([]);
      expect(normalizeTranscript([])).toEqual([]);
    });

    it("maps caller, user, customer roles to 'user'", () => {
      const raw = [
        { role: "customer", message: "Hi, I need help with my account." },
        { role: "human", message: "My order is delayed." },
        { role: "user", message: "Can you hear me?" },
      ];
      const result = normalizeTranscript(raw);
      expect(result).toHaveLength(3);
      expect(result[0]?.role).toBe("user");
      expect(result[1]?.role).toBe("user");
      expect(result[2]?.role).toBe("user");
    });

    it("maps agent, assistant, bot roles to 'agent'", () => {
      const raw = [
        { role: "agent", message: "Hello! Welcome to Acme Support." },
        { role: "assistant", message: "I can look into that order." },
        { speaker: "bot", message: "Please provide your confirmation code." },
      ];
      const result = normalizeTranscript(raw);
      expect(result).toHaveLength(3);
      expect(result[0]?.role).toBe("agent");
      expect(result[1]?.role).toBe("agent");
      expect(result[2]?.role).toBe("agent");
    });

    it("preserves timing and tool calls metadata", () => {
      const raw = [
        {
          role: "agent",
          message: "Looking up your reservation now.",
          time_in_call_secs: 4.5,
          tool_calls: [{ name: "lookup_reservation", args: { id: "RES-1" } }],
        },
      ];
      const result = normalizeTranscript(raw);
      expect(result[0]?.timeInCallSecs).toBe(4.5);
      expect(result[0]?.toolCalls).toHaveLength(1);
    });
  });

  describe("classifyRemoteRun", () => {
    it("classifies pending or in-progress states as running", () => {
      const pendingRun: TestRun = {
        test_id: "test-1",
        status: "in_progress",
      };
      const result = classifyRemoteRun(pendingRun);
      expect(result.status).toBe("running");
      expect(result.evaluationResult).toBeNull();
    });

    it("classifies successful condition evaluation as passed", () => {
      const run: TestRun = {
        test_id: "test-1",
        status: "success",
        condition_result: {
          result: "success",
          rationale: "Agent verified customer identity and issued the credit.",
        },
        agent_responses: [
          { role: "customer", message: "I want a credit." },
          { role: "agent", message: "I have credited $50 to your account." },
        ],
      };
      const result = classifyRemoteRun(run);
      expect(result.status).toBe("passed");
      expect(result.evaluationResult).toBe("passed");
      expect(result.evaluationRationale).toBe("Agent verified customer identity and issued the credit.");
      expect(result.transcript).toHaveLength(2);
      expect(result.metrics.turnsCount).toBe(2);
    });

    it("classifies failed condition evaluation as failed_evaluation", () => {
      const run: TestRun = {
        test_id: "test-1",
        status: "failure",
        condition_result: {
          result: "failure",
          rationale: "Agent refused credit and ended call abruptly.",
        },
      };
      const result = classifyRemoteRun(run);
      expect(result.status).toBe("failed_evaluation");
      expect(result.evaluationResult).toBe("failed");
      expect(result.evaluationRationale).toContain("Agent refused credit");
    });

    it("classifies failure without condition evaluation as infrastructure_error", () => {
      const run: TestRun = {
        test_id: "test-1",
        status: "failure",
      };
      const result = classifyRemoteRun(run);
      expect(result.status).toBe("infrastructure_error");
      expect(result.evaluationResult).toBe("error");
      expect(result.errorMessage).toContain("Run failed before evaluation");
    });

    it("classifies timeout states as timed_out with error evaluation", () => {
      const run: TestRun = {
        test_id: "test-1",
        status: "timed_out",
      };
      const result = classifyRemoteRun(run);
      expect(result.status).toBe("timed_out");
      expect(result.evaluationResult).toBe("error");
    });
  });

  describe("aggregateBatchOutcomes", () => {
    function createRunStub(status: SimulationRunRecord["status"]): SimulationRunRecord {
      return {
        id: "run-" + Math.random(),
        batchId: "batch-1",
        projectId: "proj-1",
        ownerId: "user-1",
        targetAgentId: "agent-1",
        scenarioId: "sc-1",
        personaId: "p-1",
        scenarioName: "Scenario",
        personaName: "Persona",
        scenarioSnapshot: emptyScenarioConfig(),
        personaSnapshot: emptyPersonaConfig(),
        remoteTestId: "remote-test-1",
        remoteTestRunId: null,
        remoteInvocationId: null,
        rawResult: null,
        status,
        evaluationResult: status === "passed" ? "passed" : status === "failed_evaluation" ? "failed" : null,
        evaluationRationale: null,
        transcript: [],
        metrics: {},
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    it("reports 'running' when any runs are pending or running", () => {
      const runs = [
        createRunStub("passed"),
        createRunStub("running"),
        createRunStub("pending"),
      ];
      const agg = aggregateBatchOutcomes(runs);
      expect(agg.total).toBe(3);
      expect(agg.completed).toBe(1);
      expect(agg.passed).toBe(1);
      expect(agg.batchStatus).toBe("running");
    });

    it("reports 'completed' when all runs pass", () => {
      const runs = [
        createRunStub("passed"),
        createRunStub("passed"),
      ];
      const agg = aggregateBatchOutcomes(runs);
      expect(agg.total).toBe(2);
      expect(agg.completed).toBe(2);
      expect(agg.passed).toBe(2);
      expect(agg.batchStatus).toBe("completed");
    });

    it("reports 'completed_with_failures' when some pass and some fail", () => {
      const runs = [
        createRunStub("passed"),
        createRunStub("failed_evaluation"),
      ];
      const agg = aggregateBatchOutcomes(runs);
      expect(agg.total).toBe(2);
      expect(agg.completed).toBe(2);
      expect(agg.passed).toBe(1);
      expect(agg.failed).toBe(1);
      expect(agg.batchStatus).toBe("completed_with_failures");
    });

    it("reports 'failed' when all finished runs fail evaluation", () => {
      const runs = [
        createRunStub("failed_evaluation"),
        createRunStub("failed_evaluation"),
      ];
      const agg = aggregateBatchOutcomes(runs);
      expect(agg.total).toBe(2);
      expect(agg.failed).toBe(2);
      expect(agg.batchStatus).toBe("failed");
    });

    it("reports 'infrastructure_error' when all runs hit transport errors", () => {
      const runs = [
        createRunStub("infrastructure_error"),
        createRunStub("timed_out"),
      ];
      const agg = aggregateBatchOutcomes(runs);
      expect(agg.total).toBe(2);
      expect(agg.errored).toBe(2);
      expect(agg.batchStatus).toBe("infrastructure_error");
    });
  });
});
