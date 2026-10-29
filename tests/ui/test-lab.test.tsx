// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BatchStatusBadge,
  RunStatusBadge,
  EvaluationResultBadge,
} from "@/components/simulations/batch-status-badge";
import { PreflightCard } from "@/components/simulations/preflight-card";
import { RunCard } from "@/components/simulations/run-card";
import { TranscriptDrawer } from "@/components/simulations/transcript-drawer";
import { BatchHistoryTable } from "@/components/simulations/batch-history-table";
import TestLabPage from "@/app/(app)/test-lab/page";
import type {
  PreflightCheckResult,
  SimulationBatchRecord,
  SimulationRunRecord,
} from "@/server/simulations/schema";
import { emptyPersonaConfig, emptyScenarioConfig } from "@/server/personas/schema";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => "/test-lab",
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const sampleRun: SimulationRunRecord = {
  id: "run-abc-123",
  batchId: "batch-abc-123",
  projectId: "proj-123",
  ownerId: "owner-1",
  targetAgentId: "agent-123",
  scenarioId: "sc-123",
  personaId: "p-123",
  scenarioName: "Refund Inquiry Scenario",
  personaName: "Alex Vance",
  scenarioSnapshot: emptyScenarioConfig(),
  personaSnapshot: emptyPersonaConfig(),
  remoteTestId: "remote-test-123",
  remoteTestRunId: "remote-run-123",
  remoteInvocationId: "inv-123",
  status: "passed",
  evaluationResult: "passed",
  evaluationRationale: "The agent answered questions calmly and provided the 5-7 business day window.",
  transcript: [
    { role: "user", message: "Hi, when do I get my refund?", timeInCallSecs: 1.5 },
    { role: "agent", message: "Refunds typically take 5 to 7 business days.", timeInCallSecs: 3.2 },
  ],
  metrics: { turnsCount: 2 },
  rawResult: null,
  errorMessage: null,
  startedAt: "2026-10-29T12:00:00Z",
  completedAt: "2026-10-29T12:00:15Z",
  createdAt: "2026-10-29T12:00:00Z",
  updatedAt: "2026-10-29T12:00:15Z",
};

const sampleBatch: SimulationBatchRecord = {
  id: "batch-abc-123",
  projectId: "proj-123",
  ownerId: "owner-1",
  targetAgentId: "agent-123",
  remoteAgentId: "el_agent_123",
  name: "Regression Test Suite",
  status: "completed",
  totalScenarios: 1,
  completedScenarios: 1,
  passedScenarios: 1,
  failedScenarios: 0,
  erroredScenarios: 0,
  remoteInvocationId: "inv-123",
  executionOptions: { repeatCount: 1, concurrency: 1 },
  errorMessage: null,
  startedAt: "2026-10-29T12:00:00Z",
  completedAt: "2026-10-29T12:00:15Z",
  createdAt: "2026-10-29T12:00:00Z",
  updatedAt: "2026-10-29T12:00:15Z",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Simulation UI Components", () => {
  describe("Badges", () => {
    it("renders BatchStatusBadge accurately for various statuses", () => {
      const { rerender } = render(<BatchStatusBadge status="completed" />);
      expect(screen.getByText("Completed")).toBeInTheDocument();

      rerender(<BatchStatusBadge status="running" />);
      expect(screen.getByText("Running")).toBeInTheDocument();

      rerender(<BatchStatusBadge status="completed_with_failures" />);
      expect(screen.getByText("Completed with Failures")).toBeInTheDocument();

      rerender(<BatchStatusBadge status="infrastructure_error" />);
      expect(screen.getByText("Infrastructure Error")).toBeInTheDocument();
    });

    it("renders RunStatusBadge and EvaluationResultBadge", () => {
      render(
        <div>
          <RunStatusBadge status="passed" />
          <RunStatusBadge status="failed_evaluation" />
          <EvaluationResultBadge result="passed" />
          <EvaluationResultBadge result="failed" />
        </div>,
      );

      expect(screen.getByText("Passed")).toBeInTheDocument();
      expect(screen.getByText("Failed Evaluation")).toBeInTheDocument();
      expect(screen.getByText("PASSED")).toBeInTheDocument();
      expect(screen.getByText("FAILED")).toBeInTheDocument();
    });
  });

  describe("PreflightCard", () => {
    it("renders ready preflight state with agent and scenario count", () => {
      const preflight: PreflightCheckResult = {
        canExecute: true,
        totalScenarios: 1,
        readyScenarios: 1,
        summaryBlockers: [],
        summaryWarnings: [],
        toolSafetyNotice: {
          hasTools: false,
          toolNames: [],
          consequentialRiskWarning: null,
        },
        targetAgent: {
          id: "agent-123",
          name: "Customer Support Desk",
          remoteAgentId: "el_agent_123",
          primaryLanguage: "en",
          declaredCapabilities: [],
        },
        scenarios: [
          {
            scenarioId: "sc-123",
            scenarioName: "Refund Inquiry",
            isReady: true,
            personaName: "Alex Vance",
            warnings: [],
            blockers: [],
          },
        ],
      };

      render(<PreflightCard preflight={preflight} />);

      expect(screen.getByText(/Customer Support Desk/)).toBeInTheDocument();
      expect(screen.getByText(/Preflight Passed/)).toBeInTheDocument();
      expect(screen.getByText(/1\/1 Scenarios Ready/)).toBeInTheDocument();
    });

    it("renders blockers when agent is unsynced or scenarios are missing", () => {
      const preflight: PreflightCheckResult = {
        canExecute: false,
        totalScenarios: 0,
        readyScenarios: 0,
        summaryBlockers: ["Target agent has not been synced to ElevenLabs."],
        summaryWarnings: ["Scenario 2 is in draft status."],
        toolSafetyNotice: {
          hasTools: false,
          toolNames: [],
          consequentialRiskWarning: null,
        },
        targetAgent: {
          id: "agent-123",
          name: "Draft Agent",
          remoteAgentId: "",
          primaryLanguage: "en",
          declaredCapabilities: [],
        },
        scenarios: [],
      };

      render(<PreflightCard preflight={preflight} />);

      expect(screen.getByText(/Preflight Blocked/)).toBeInTheDocument();
      expect(screen.getByText(/Target agent has not been synced to ElevenLabs/)).toBeInTheDocument();
      expect(screen.getByText(/Scenario 2 is in draft status/)).toBeInTheDocument();
    });
  });

  describe("RunCard", () => {
    it("renders run information and triggers onInspect when clicked", async () => {
      const onInspect = vi.fn();
      const onRerun = vi.fn();
      const user = userEvent.setup();

      render(<RunCard run={sampleRun} onInspect={onInspect} onRerun={onRerun} />);

      expect(screen.getByText("Refund Inquiry Scenario")).toBeInTheDocument();
      expect(screen.getByText("Alex Vance")).toBeInTheDocument();
      expect(screen.getByText(/2 turns/i)).toBeInTheDocument();

      const inspectBtn = screen.getByRole("button", { name: /Inspect Result/i });
      await user.click(inspectBtn);
      expect(onInspect).toHaveBeenCalledWith(sampleRun);
    });
  });

  describe("TranscriptDrawer", () => {
    it("renders transcript messages, evaluation result, and rationale inside modal", () => {
      render(
        <TranscriptDrawer
          run={sampleRun}
          open={true}
          onOpenChange={vi.fn()}
          onRerun={vi.fn()}
        />,
      );

      expect(screen.getByText(/Refund Inquiry Scenario — Test Result/i)).toBeInTheDocument();
      expect(screen.getByText(/Simulated Customer: Alex Vance/i)).toBeInTheDocument();
      expect(screen.getByText("Hi, when do I get my refund?")).toBeInTheDocument();
      expect(screen.getByText("Refunds typically take 5 to 7 business days.")).toBeInTheDocument();
      expect(
        screen.getByText(/The agent answered questions calmly and provided the 5-7 business day window/),
      ).toBeInTheDocument();
    });
  });

  describe("BatchHistoryTable", () => {
    it("renders history batches and calls onSelectBatch when clicked", async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();

      render(
        <BatchHistoryTable
          batches={[sampleBatch]}
          onSelectBatch={onSelect}
        />,
      );

      expect(screen.getByText("Regression Test Suite")).toBeInTheDocument();
      expect(screen.getByText(/1\/1 finished/)).toBeInTheDocument();

      const inspectBtn = screen.getByRole("button", { name: /Inspect Batch/i });
      await user.click(inspectBtn);
      expect(onSelect).toHaveBeenCalledWith(sampleBatch);
    });
  });

  describe("TestLabPage Integration", () => {
    it("loads project data, performs preflight check, and displays controls", async () => {
      const stub = vi.fn(async (url: string | URL) => {
        const u = String(url);
        if (u === "/api/projects") {
          return new Response(JSON.stringify({ data: [{ id: "proj-123", name: "Alpha Project" }] }));
        }
        if (u.startsWith("/api/agents?")) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: "agent-123",
                  name: "Voice Desk",
                  remoteAgentId: "el_agent_123",
                  primaryLanguage: "en",
                },
              ],
            }),
          );
        }
        if (u.startsWith("/api/personas?")) {
          return new Response(
            JSON.stringify({
              data: [{ id: "p-123", name: "Alex Vance", category: "power_user" }],
            }),
          );
        }
        if (u.startsWith("/api/scenarios?")) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: "sc-123",
                  name: "Billing Ingestion",
                  personaId: "p-123",
                  description: "Tests billing questions",
                  priority: "high",
                  status: "ready",
                  config: emptyScenarioConfig(),
                },
              ],
            }),
          );
        }
        if (u.startsWith("/api/simulations?")) {
          return new Response(JSON.stringify({ data: [sampleBatch] }));
        }
        if (u === "/api/simulations/preflight") {
          return new Response(
            JSON.stringify({
              data: {
                canExecute: true,
                totalScenarios: 1,
                readyScenarios: 1,
                summaryBlockers: [],
                summaryWarnings: [],
                toolSafetyNotice: {
                  hasTools: false,
                  toolNames: [],
                  consequentialRiskWarning: null,
                },
                targetAgent: {
                  id: "agent-123",
                  name: "Voice Desk",
                  remoteAgentId: "el_agent_123",
                  primaryLanguage: "en",
                  declaredCapabilities: [],
                },
                scenarios: [
                  {
                    scenarioId: "sc-123",
                    scenarioName: "Billing Ingestion",
                    personaName: "Alex Vance",
                    isReady: true,
                    warnings: [],
                    blockers: [],
                  },
                ],
              },
            }),
          );
        }
        return new Response(JSON.stringify({ error: { message: "Not found" } }), { status: 404 });
      });

      vi.stubGlobal("fetch", stub);

      render(<TestLabPage />);

      // Wait for project loading to finish and page header to appear
      expect(await screen.findByRole("heading", { name: "Test Lab" })).toBeInTheDocument();

      // Wait for project loading
      expect(await screen.findByText(/1\. Select Target ElevenLabs Agent/i)).toBeInTheDocument();
      expect(await screen.findByText(/2\. Select Test Scenarios/i)).toBeInTheDocument();

      // Verify Launch button exists
      expect(screen.getByRole("button", { name: /Run Simulation/i })).toBeInTheDocument();
    });
  });
});
