// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RefinementPage from "@/app/(app)/refinement/page";
import type {
  FailureFindingRecord,
  FixProposalRecord,
  RetestComparisonRecord,
} from "@/server/analysis/schema";
import { sampleConfig } from "../sample-config";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Refinement & Remediation Workspace", () => {
  const mockProjects = [{ id: "proj-1", name: "Voice Operations Portal" }];
  const mockAgents = [{ id: "agent-1", name: "Support Concierge", configVersion: 2 }];

  const mockFinding: FailureFindingRecord = {
    id: "finding-1",
    runId: "run-1",
    batchId: "batch-1",
    projectId: "proj-1",
    ownerId: null,
    targetAgentId: "agent-1",
    testedVersion: 1,
    category: "policy_violation",
    severity: "critical",
    title: "Unauthorized Refund Promise",
    description: "The agent promised a full refund without manager authorization.",
    evidenceReferences: [
      {
        messageIndex: 2,
        role: "agent",
        excerpt: "I will issue an immediate 100% refund today.",
        note: "Direct breach of refund authorization policy.",
      },
    ],
    expectedBehavior: "Explain 5-7 day review policy.",
    observedBehavior: "Promised instant cash refund.",
    discrepancyExplanation: "Breached business rule #3.",
    confidence: "proven",
    isActionable: true,
    suggestedAction: "Update guardrails to require manager escalation.",
    analysisMetadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockProposal: FixProposalRecord = {
    id: "prop-1",
    projectId: "proj-1",
    ownerId: null,
    targetAgentId: "agent-1",
    sourceRunId: "run-1",
    sourceFindingId: "finding-1",
    baseVersion: 1,
    proposedConfig: {
      ...sampleConfig(),
      behavior: {
        ...sampleConfig().behavior,
        instructions: "Never promise immediate cash refunds.",
      },
    },
    changeSummary: "Clarify refund escalation protocol",
    fieldChanges: [
      {
        path: "behavior.instructions",
        label: "instructions",
        before: "Handle caller questions.",
        after: "Never promise immediate cash refunds.",
        explanation: "Restricts unauthorized refund issuance.",
      },
    ],
    rationale: "Aligns agent responses with refund escalation policy.",
    expectedImprovement: "Zero unauthorized refund commitments.",
    potentialRisks: "Caller may need to be transferred.",
    status: "applied_locally",
    rejectionReason: null,
    appliedAgentVersion: 2,
    remoteSyncStatus: "synced",
    remoteSyncError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockComparison: RetestComparisonRecord = {
    id: "comp-1",
    projectId: "proj-1",
    ownerId: null,
    fixProposalId: "prop-1",
    originalRunId: "run-1",
    retestRunId: "run-2",
    retestBatchId: "batch-2",
    testedAgentVersion: 2,
    outcomeChanged: true,
    failureResolved: true,
    comparisonSummary: "The agent properly cited the 5-7 business day policy.",
    originalMetrics: { turnsCount: 3, status: "failed_evaluation" },
    retestMetrics: { turnsCount: 4, status: "passed" },
    createdAt: new Date().toISOString(),
  };

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
        if (url.includes("/api/simulations/refinement")) {
          return new Response(
            JSON.stringify({
              data: {
                findings: [mockFinding],
                proposals: [mockProposal],
                comparisons: [mockComparison],
              },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ data: {} }), { status: 200 });
      }),
    );
  });

  it("renders page header, metrics banner, and active failure findings", async () => {
    render(<RefinementPage />);

    expect(await screen.findByText("Refinement & Remediation")).toBeInTheDocument();
    expect(screen.getByText("Active Findings")).toBeInTheDocument();
    expect(screen.getByText("Pending Proposals")).toBeInTheDocument();
    expect(screen.getByText("Applied Fixes")).toBeInTheDocument();
    expect(screen.getByText("Verified Retests")).toBeInTheDocument();

    // Verify finding card content
    expect(await screen.findByText("Unauthorized Refund Promise")).toBeInTheDocument();
    expect(
      screen.getByText("The agent promised a full refund without manager authorization."),
    ).toBeInTheDocument();
  });

  it("switches tabs to Fix Proposals and Retest Verifications", async () => {
    const user = userEvent.setup();
    render(<RefinementPage />);

    // Click Fix Proposals tab
    const proposalsTab = await screen.findByRole("button", { name: /Fix Proposals/i });
    await user.click(proposalsTab);

    expect(await screen.findByText("Clarify refund escalation protocol")).toBeInTheDocument();
    expect(screen.getByText(/Base Version v1/)).toBeInTheDocument();

    // Click Retest Verifications tab
    const comparisonsTab = screen.getByRole("button", { name: /Retest Verifications/i });
    await user.click(comparisonsTab);

    expect(await screen.findByText("Failure Resolved")).toBeInTheDocument();
    expect(
      screen.getByText("The agent properly cited the 5-7 business day policy."),
    ).toBeInTheDocument();
  });
});
