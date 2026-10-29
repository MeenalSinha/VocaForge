// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FailureFindingsCard } from "@/components/analysis/failure-findings-card";
import { FixReviewModal } from "@/components/analysis/fix-review-modal";
import { RetestComparisonDrawer } from "@/components/analysis/retest-comparison-drawer";
import { TranscriptDrawer } from "@/components/simulations/transcript-drawer";
import type {
  FailureFindingRecord,
  FixProposalRecord,
  RetestComparisonRecord,
} from "@/server/analysis/schema";
import type { SimulationRunRecord } from "@/server/simulations/schema";
import { sampleConfig } from "../sample-config";
import { emptyPersonaConfig, emptyScenarioConfig } from "@/server/personas/schema";

afterEach(() => {
  cleanup();
});

const mockFinding: FailureFindingRecord = {
  id: "finding-abc",
  runId: "run-123",
  batchId: "batch-123",
  projectId: "proj-123",
  ownerId: "owner-1",
  targetAgentId: "agent-123",
  testedVersion: 1,
  category: "unsupported_answer",
  severity: "major",
  title: "Hallucinated Pricing Information",
  description: "Agent quoted $50/month which is not supported by documentation.",
  evidenceReferences: [
    {
      messageIndex: 2,
      role: "agent",
      excerpt: "Our standard pricing starts at $50 per month.",
    },
  ],
  expectedBehavior: "Agent should state pricing depends on volume and refer to sales.",
  observedBehavior: "Agent stated $50 flat fee.",
  discrepancyExplanation: "Direct hallucination of pricing.",
  confidence: "proven",
  isActionable: true,
  suggestedAction: "Update guardrails to prohibit quoting ungrounded prices.",
  analysisMetadata: {},
  createdAt: "2026-10-29T12:00:00Z",
  updatedAt: "2026-10-29T12:00:00Z",
};

const mockProposal: FixProposalRecord = {
  id: "proposal-xyz",
  projectId: "proj-123",
  ownerId: "owner-1",
  targetAgentId: "agent-123",
  sourceRunId: "run-123",
  sourceFindingId: "finding-abc",
  baseVersion: 1,
  proposedConfig: sampleConfig(),
  changeSummary: "Added guardrail preventing ungrounded price quotes.",
  fieldChanges: [
    {
      path: "guardrails.prohibitedActions",
      label: "Prohibited Actions",
      before: "Never promise discounts without approval.",
      after: "Never quote pricing without checking official rates; Never promise discounts.",
      explanation: "Add pricing guardrail.",
    },
  ],
  rationale: "Addresses hallucinated pricing finding.",
  expectedImprovement: "Customer will not receive false pricing promises.",
  potentialRisks: "None identified.",
  status: "pending_review",
  rejectionReason: null,
  appliedAgentVersion: null,
  remoteSyncStatus: "not_applied",
  remoteSyncError: null,
  createdAt: "2026-10-29T12:05:00Z",
  updatedAt: "2026-10-29T12:05:00Z",
};

const mockComparison: RetestComparisonRecord = {
  id: "comp-999",
  projectId: "proj-123",
  ownerId: "owner-1",
  fixProposalId: "proposal-xyz",
  originalRunId: "run-123",
  retestRunId: "run-456",
  retestBatchId: "batch-456",
  testedAgentVersion: 2,
  outcomeChanged: true,
  failureResolved: true,
  comparisonSummary: "Scenario previously failed with ungrounded pricing; retest run passed all evaluation criteria.",
  originalMetrics: {
    turnsCount: 4,
    durationSecs: 12,
    status: "failed_evaluation",
    rationale: "Evaluator found agent quoted unauthorized rate.",
  },
  retestMetrics: {
    turnsCount: 3,
    durationSecs: 10,
    status: "passed",
    rationale: "Agent accurately referred customer to sales.",
  },
  createdAt: "2026-10-29T12:15:00Z",
};

const mockRun: SimulationRunRecord = {
  id: "run-123",
  batchId: "batch-123",
  projectId: "proj-123",
  ownerId: "owner-1",
  targetAgentId: "agent-123",
  personaId: "persona-1",
  scenarioId: "scenario-1",
  scenarioName: "Pricing Inquiry",
  personaName: "Direct Buyer",
  remoteTestId: "test-1",
  remoteTestRunId: "remote-run-1",
  remoteInvocationId: "inv-1",
  status: "failed_evaluation",
  transcript: [
    { role: "user", message: "How much does your service cost?", timeInCallSecs: 1 },
    { role: "agent", message: "Our standard pricing starts at $50 per month.", timeInCallSecs: 3 },
  ],
  evaluationResult: "failed",
  evaluationRationale: "Evaluator found agent quoted unauthorized rate.",
  metrics: { turnsCount: 2, durationSecs: 5 },
  rawResult: null,
  errorMessage: null,
  startedAt: "2026-10-29T12:00:00Z",
  scenarioSnapshot: emptyScenarioConfig(),
  personaSnapshot: emptyPersonaConfig(),
  createdAt: "2026-10-29T12:00:00Z",
  updatedAt: "2026-10-29T12:00:00Z",
  completedAt: "2026-10-29T12:00:05Z",
};

describe("Phase 5 UI Components", () => {
  it("renders FailureFindingsCard with category, severity, evidence quote, and handles Fix with AI click", async () => {
    const user = userEvent.setup();
    const handleFix = vi.fn();

    render(
      <FailureFindingsCard
        findings={[mockFinding]}
        onFixWithAI={handleFix}
      />
    );

    expect(screen.getByText("Hallucinated Pricing Information")).toBeDefined();
    expect(screen.getByText("Unsupported or Incorrect Answer")).toBeDefined();

    const showEvidenceBtn = screen.getByRole("button", { name: /Show Transcript Evidence/i });
    await user.click(showEvidenceBtn);
    expect(screen.getByText(/Our standard pricing starts at \$50 per month/i)).toBeDefined();

    const fixBtn = screen.getByRole("button", { name: /Fix with AI/i });
    expect(fixBtn).toBeDefined();

    await user.click(fixBtn);
    expect(handleFix).toHaveBeenCalledWith(mockFinding);
  });

  it("renders FixReviewModal with rationale, field changes diff, and triggers review actions", async () => {
    const user = userEvent.setup();
    const handleApprove = vi.fn();
    const handleReject = vi.fn();

    render(
      <FixReviewModal
        proposal={mockProposal}
        open={true}
        onOpenChange={vi.fn()}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    );

    expect(screen.getByText(/AI Remediation Proposal Review/i)).toBeDefined();
    expect(screen.getByText(/Addresses hallucinated pricing finding/i)).toBeDefined();
    expect(screen.getByText(/Prohibited Actions/i)).toBeDefined();

    const approveBtn = screen.getByRole("button", { name: /Approve Proposal/i });
    await user.click(approveBtn);
    expect(handleApprove).toHaveBeenCalledWith("proposal-xyz");

    const rejectBtn = screen.getByRole("button", { name: /Reject Fix/i });
    await user.click(rejectBtn);
    expect(handleReject).toHaveBeenCalledWith("proposal-xyz");
  });

  it("renders RetestComparisonDrawer with resolution verdict and metrics comparison", () => {
    render(
      <RetestComparisonDrawer
        comparison={mockComparison}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Retest Verification Comparison/i)).toBeDefined();
    expect(screen.getByText(/Failure Resolved/i)).toBeDefined();
    expect(screen.getByText(/Configuration remediation verified successfully/i)).toBeDefined();
    expect(screen.getByText(/Original Evaluator Rationale/i)).toBeDefined();
    expect(screen.getByText(/Retest Evaluator Rationale/i)).toBeDefined();
  });

  it("embeds FailureFindingsCard in TranscriptDrawer for failed runs", () => {
    render(
      <TranscriptDrawer
        run={mockRun}
        open={true}
        onOpenChange={vi.fn()}
        findings={[mockFinding]}
      />
    );

    expect(screen.getByText(/AI Failure Analysis & Remediation/i)).toBeDefined();
    expect(screen.getByText("Hallucinated Pricing Information")).toBeDefined();
  });
});
