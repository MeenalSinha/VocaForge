// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResultsPage from "@/app/(app)/results/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/results",
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Results & Observability Page", () => {
  const mockProjects = [{ id: "proj-1", name: "Voice Operations Portal" }];
  const mockAgents = [{ id: "agent-1", name: "Support Concierge" }];

  const mockMetrics = {
    totalRuns: 12,
    completedEvaluations: 10,
    passedEvaluations: 9,
    failedEvaluations: 1,
    infrastructureErrors: 0,
    inconclusiveRuns: 0,
    passingRatePercentage: 90,
    totalFindings: 2,
    unresolvedFindings: 1,
    totalProposals: 1,
    approvedProposals: 1,
    appliedProposals: 1,
    retestsCount: 1,
    resolvedRetestsCount: 1,
    retestResolutionRatePercentage: 100,
    deployedAgentsCount: 2,
    categoryDistribution: {
      unsupported_answer: 1,
      policy_violation: 1,
    },
  };

  const mockExecutions = [
    {
      id: "run-uuid-1",
      batchId: "batch-1",
      projectId: "proj-1",
      targetAgentId: "agent-1",
      agentName: "Support Concierge",
      scenarioId: "scenario-1",
      personaId: "persona-1",
      scenarioName: "Account Cancellation",
      personaName: "Demanding Customer",
      status: "passed",
      evaluationResult: "passed",
      evaluationRationale: "Handled cancellation politely within policy.",
      transcript: [
        { role: "user", message: "I want to cancel immediately." },
        { role: "agent", message: "I can help guide you through cancellation." },
      ],
      metrics: { turnsCount: 2 },
      errorMessage: null,
      findingsCount: 0,
      proposalsCount: 0,
      comparison: {
        id: "comp-1",
        failureResolved: true,
      },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/api/projects")) {
          return new Response(JSON.stringify({ data: mockProjects }), { status: 200 });
        }
        if (url.includes("/api/agents")) {
          return new Response(JSON.stringify({ data: mockAgents }), { status: 200 });
        }
        if (url.includes("/api/observability/metrics")) {
          return new Response(
            JSON.stringify({ data: { metrics: mockMetrics } }),
            { status: 200 },
          );
        }
        if (url.includes("/api/observability/executions")) {
          return new Response(
            JSON.stringify({ data: { executions: mockExecutions } }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ data: {} }), { status: 200 });
      }),
    );
  });

  it("renders page header, KPI metric summary cards, and failure category distribution", async () => {
    render(<ResultsPage />);

    expect(await screen.findByText("Results & Observability")).toBeInTheDocument();

    // Verify KPI summary metrics
    expect(await screen.findByText("12")).toBeInTheDocument(); // total runs
    expect(screen.getByText("10")).toBeInTheDocument(); // completed evals
    expect(screen.getByText("90%")).toBeInTheDocument(); // passing rate
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1); // deployed agents count

    // Verify failure category distribution
    expect(screen.getByText("Failure Category Distribution")).toBeInTheDocument();
    expect(screen.getByText("Unsupported or Incorrect Answer")).toBeInTheDocument();
    expect(screen.getByText("Guardrail or Policy Violation")).toBeInTheDocument();
  });

  it("renders execution history table and inspect transcript trigger", async () => {
    render(<ResultsPage />);

    expect(await screen.findByText("Account Cancellation")).toBeInTheDocument();
    expect(screen.getByText("Persona: Demanding Customer")).toBeInTheDocument();
    expect(screen.getAllByText("Support Concierge").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Resolved")).toBeInTheDocument();

    const inspectBtn = screen.getByRole("button", { name: /Inspect Transcript/i });
    expect(inspectBtn).toBeInTheDocument();
  });
});
