"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileCode,
  FlaskConical,
  GitCompare,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type {
  FailureFindingRecord,
  FixProposalRecord,
  RetestComparisonRecord,
} from "@/server/analysis/schema";
import { FailureFindingsCard } from "@/components/analysis/failure-findings-card";
import { FixReviewModal } from "@/components/analysis/fix-review-modal";
import { RetestComparisonDrawer } from "@/components/analysis/retest-comparison-drawer";

interface ProjectOption {
  id: string;
  name: string;
}

interface AgentOption {
  id: string;
  name: string;
  configVersion: number;
}

export default function RefinementPage() {
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");
  const [agents, setAgents] = React.useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = React.useState<string>("all");
  const [activeTab, setActiveTab] = React.useState<"findings" | "proposals" | "comparisons">("findings");

  const [findings, setFindings] = React.useState<FailureFindingRecord[]>([]);
  const [proposals, setProposals] = React.useState<FixProposalRecord[]>([]);
  const [comparisons, setComparisons] = React.useState<RetestComparisonRecord[]>([]);
  const [unanalyzedRuns, setUnanalyzedRuns] = React.useState<Array<{
    id: string;
    scenarioName: string;
    personaName: string;
    targetAgentId: string;
    status: string;
    evaluationResult: string | null;
    evaluationRationale: string | null;
  }>>([]);
  const [isAnalyzingAll, setIsAnalyzingAll] = React.useState<boolean>(false);

  const [loadingProjects, setLoadingProjects] = React.useState<boolean>(true);
  const [loadingData, setLoadingData] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Proposal modal state
  const [activeProposal, setActiveProposal] = React.useState<FixProposalRecord | null>(null);
  const [isReviewOpen, setIsReviewOpen] = React.useState<boolean>(false);
  const [isFixingFindingId, setIsFixingFindingId] = React.useState<string | null>(null);
  const [isApproving, setIsApproving] = React.useState<boolean>(false);
  const [isRejecting, setIsRejecting] = React.useState<boolean>(false);
  const [isApplying, setIsApplying] = React.useState<boolean>(false);
  const [isRetesting, setIsRetesting] = React.useState<boolean>(false);

  // Comparison drawer state
  const [activeComparison, setActiveComparison] = React.useState<RetestComparisonRecord | null>(null);
  const [isComparisonOpen, setIsComparisonOpen] = React.useState<boolean>(false);

  // 1. Initial projects load
  React.useEffect(() => {
    async function loadProjects() {
      try {
        setLoadingProjects(true);
        const res = await fetch("/api/projects");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message || "Failed to load projects.");

        const list: ProjectOption[] = json.data?.items || (Array.isArray(json.data) ? json.data : []);
        setProjects(list);
        const firstId = list[0]?.id;
        if (firstId) {
          setSelectedProjectId((prev) => prev || firstId);
        }
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setLoadingProjects(false);
      }
    }
    loadProjects();
  }, []);

  // 2. Load refinement data when project changes
  const refreshData = React.useCallback(async () => {
    if (!selectedProjectId) return;

    try {
      setLoadingData(true);
      setError(null);

      const [agentsRes, refRes] = await Promise.all([
        fetch(`/api/agents?projectId=${selectedProjectId}`),
        fetch(`/api/simulations/refinement?projectId=${selectedProjectId}`),
      ]);

      const [agentsJson, refJson] = await Promise.all([agentsRes.json(), refRes.json()]);

      if (!agentsRes.ok) throw new Error(agentsJson.error?.message || "Failed to load agents.");
      if (!refRes.ok) throw new Error(refJson.error?.message || "Failed to load refinement data.");

      setAgents(agentsJson.data || []);
      setFindings(refJson.data?.findings || []);
      setProposals(refJson.data?.proposals || []);
      setComparisons(refJson.data?.comparisons || []);
      setUnanalyzedRuns(refJson.data?.unanalyzedRuns || []);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoadingData(false);
    }
  }, [selectedProjectId]);

  React.useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Filter items by selected agent
  const filteredFindings = React.useMemo(() => {
    if (selectedAgentId === "all") return findings;
    return findings.filter((f) => f.targetAgentId === selectedAgentId);
  }, [findings, selectedAgentId]);

  const filteredProposals = React.useMemo(() => {
    if (selectedAgentId === "all") return proposals;
    return proposals.filter((p) => p.targetAgentId === selectedAgentId);
  }, [proposals, selectedAgentId]);

  const currentAgent = agents.find((a) => a.id === selectedAgentId);

  // Actions
  async function handleFixWithAI(finding: FailureFindingRecord) {
    try {
      setIsFixingFindingId(finding.id);
      const res = await fetch(`/api/simulations/runs/${finding.runId}/fix-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findingId: finding.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to generate fix proposal.");

      setActiveProposal(json.data.proposal);
      setIsReviewOpen(true);
      toast.success("AI fix proposal generated successfully.");
      await refreshData();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsFixingFindingId(null);
    }
  }

  async function handleApprove(proposalId: string) {
    try {
      setIsApproving(true);
      const res = await fetch(`/api/simulations/proposals/${proposalId}/approve`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to approve proposal.");

      setActiveProposal(json.data.proposal);
      toast.success("Fix proposal approved.");
      await refreshData();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsApproving(false);
    }
  }

  async function handleReject(proposalId: string) {
    try {
      setIsRejecting(true);
      const res = await fetch(`/api/simulations/proposals/${proposalId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Rejected by operator" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to reject proposal.");

      setActiveProposal(json.data.proposal);
      toast.success("Fix proposal rejected.");
      await refreshData();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsRejecting(false);
    }
  }

  async function handleApply(proposalId: string, reconcileStale?: boolean) {
    try {
      setIsApplying(true);
      const res = await fetch(`/api/simulations/proposals/${proposalId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reconcileStale }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to apply fix proposal.");

      setActiveProposal(json.data.proposal);
      toast.success("Fix applied and configuration updated.");
      await refreshData();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsApplying(false);
    }
  }

  async function handleRetest(proposalId: string) {
    try {
      setIsRetesting(true);
      const res = await fetch(`/api/simulations/proposals/${proposalId}/retest`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to launch retest.");

      toast.success("Retest simulation batch started.");
      setIsReviewOpen(false);
      setActiveTab("comparisons");
      await refreshData();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsRetesting(false);
    }
  }

  async function handleAnalyzeAllUnanalyzed() {
    if (unanalyzedRuns.length === 0) return;
    try {
      setIsAnalyzingAll(true);
      for (const run of unanalyzedRuns) {
        const res = await fetch(`/api/simulations/runs/${run.id}/analyze`, { method: "POST" });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error?.message || `Failed to analyze run ${run.scenarioName}`);
        }
      }
      toast.success("AI failure analysis completed for all failed runs.");
      await refreshData();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsAnalyzingAll(false);
    }
  }

  if (loadingProjects) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        title="No projects found"
        description="Create a project to execute simulations and refine voice agent configurations."
      >
        <Link
          href="/projects"
          className="mt-2 inline-flex items-center justify-center rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
        >
          Go to Projects
        </Link>
      </EmptyState>
    );
  }

  const criticalFindingsCount = filteredFindings.filter((f) => f.severity === "critical").length;
  const majorFindingsCount = filteredFindings.filter((f) => f.severity === "major").length;
  const pendingProposalsCount = filteredProposals.filter((p) => p.status === "pending_review").length;
  const appliedProposalsCount = filteredProposals.filter(
    (p) => p.status === "applied_locally" || p.status === "synced_remotely",
  ).length;
  const resolvedRetestsCount = comparisons.filter((c) => c.failureResolved).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refinement & Remediation"
        description="Closed-loop AI agent refinement: diagnose empirical failures, inspect minimal configuration diffs, and verify fixes with regression retests."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Select Project"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="rounded-md border border-subtle bg-surface px-3 py-1.5 text-xs font-medium text-foreground shadow-sm focus:border-accent focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Target Agent"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="rounded-md border border-subtle bg-surface px-3 py-1.5 text-xs font-medium text-foreground shadow-sm focus:border-accent focus:outline-none"
            >
              <option value="all">All Agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (v{a.configVersion})
                </option>
              ))}
            </select>

            <Button
              variant="secondary"
              size="sm"
              onClick={refreshData}
              disabled={loadingData}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {error && (
        <ErrorState title="Failed to load refinement workspace" message={error}>
          <Button variant="secondary" size="sm" onClick={refreshData}>
            Retry
          </Button>
        </ErrorState>
      )}

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3 text-center">
          <p className="text-[11px] font-medium text-muted">Active Findings</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {filteredFindings.length}
          </p>
          <p className="mt-0.5 text-[10px] text-muted">
            {criticalFindingsCount > 0 ? (
              <span className="text-rose-500 font-semibold">{criticalFindingsCount} critical</span>
            ) : (
              <span>0 critical</span>
            )}
            {" · "}
            {majorFindingsCount} major
          </p>
        </Card>

        <Card className="p-3 text-center">
          <p className="text-[11px] font-medium text-muted">Pending Proposals</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-amber-500">
            {pendingProposalsCount}
          </p>
          <p className="mt-0.5 text-[10px] text-muted">Awaiting human review</p>
        </Card>

        <Card className="p-3 text-center">
          <p className="text-[11px] font-medium text-muted">Applied Fixes</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-accent">
            {appliedProposalsCount}
          </p>
          <p className="mt-0.5 text-[10px] text-muted">Updated in agent configuration</p>
        </Card>

        <Card className="p-3 text-center">
          <p className="text-[11px] font-medium text-muted">Verified Retests</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-500">
            {resolvedRetestsCount}
          </p>
          <p className="mt-0.5 text-[10px] text-muted">
            {comparisons.length} total retests executed
          </p>
        </Card>
      </div>

      {/* Unanalyzed Failed Runs Banner */}
      {unanalyzedRuns.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <span>
              <strong>{unanalyzedRuns.length} failed simulation {unanalyzedRuns.length === 1 ? "run" : "runs"}</strong> detected that require AI failure analysis.
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleAnalyzeAllUnanalyzed}
            disabled={isAnalyzingAll}
            className="h-7 px-2.5 text-xs gap-1"
          >
            <Sparkles className="h-3 w-3" />
            {isAnalyzingAll ? "Diagnosing..." : "Diagnose Failures with AI"}
          </Button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-subtle">
        <button
          onClick={() => setActiveTab("findings")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === "findings"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Failure Findings
          <Badge tone={filteredFindings.length > 0 ? "warning" : "neutral"} className="ml-1 text-[10px]">
            {filteredFindings.length}
          </Badge>
        </button>

        <button
          onClick={() => setActiveTab("proposals")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === "proposals"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <FileCode className="h-3.5 w-3.5" />
          Fix Proposals
          <Badge tone={filteredProposals.length > 0 ? "accent" : "neutral"} className="ml-1 text-[10px]">
            {filteredProposals.length}
          </Badge>
        </button>

        <button
          onClick={() => setActiveTab("comparisons")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === "comparisons"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <GitCompare className="h-3.5 w-3.5" />
          Retest Verifications
          <Badge tone="neutral" className="ml-1 text-[10px]">
            {comparisons.length}
          </Badge>
        </button>
      </div>

      {/* Tab 1: Failure Findings */}
      {activeTab === "findings" && (
        <div className="space-y-4">
          {filteredFindings.length === 0 ? (
            unanalyzedRuns.length > 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 py-10 px-6 text-center text-xs">
                <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
                <p className="font-semibold text-foreground text-sm">
                  {unanalyzedRuns.length} Simulation {unanalyzedRuns.length === 1 ? "Run Failed" : "Runs Failed"} Evaluation
                </p>
                <p className="max-w-md mt-1 text-muted">
                  Test evaluations failed in Test Lab, but AI failure analysis has not diagnosed the root causes yet. Run failure analysis to extract empirical findings and generate prompt fix proposals.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button
                    onClick={handleAnalyzeAllUnanalyzed}
                    disabled={isAnalyzingAll}
                    size="sm"
                    className="gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {isAnalyzingAll ? "Analyzing Failures..." : "Analyze All Failed Runs with AI"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-xs text-muted">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                <p className="font-semibold text-foreground text-sm">No Active Failure Findings</p>
                <p className="max-w-md mt-1 text-muted">
                  All tested simulations executed without policy violations or criteria discrepancies. Run new tests in Test Lab to explore additional scenarios.
                </p>
                <Link
                  href="/test-lab"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  Go to Test Lab
                </Link>
              </div>
            )
          ) : (
            <FailureFindingsCard
              findings={filteredFindings}
              onFixWithAI={handleFixWithAI}
              isFixingId={isFixingFindingId}
            />
          )}
        </div>
      )}

      {/* Tab 2: Fix Proposals */}
      {activeTab === "proposals" && (
        <div className="space-y-4">
          {filteredProposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-xs text-muted">
              <Sparkles className="h-8 w-8 text-muted/60 mb-2" />
              <p className="font-semibold text-foreground text-sm">No Fix Proposals Yet</p>
              <p className="max-w-md mt-1 text-muted">
                When a simulation fails, click &ldquo;Fix with AI&rdquo; on any failure finding to automatically generate a targeted configuration improvement.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProposals.map((proposal) => {
                const isApplied =
                  proposal.status === "applied_locally" || proposal.status === "synced_remotely";
                const isApproved = proposal.status === "approved";
                const isPending = proposal.status === "pending_review";
                return (
                  <Card key={proposal.id} className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-subtle pb-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          tone={
                            isApplied
                              ? "success"
                              : isApproved
                              ? "accent"
                              : isPending
                              ? "warning"
                              : "neutral"
                          }
                          className="capitalize text-[11px]"
                        >
                          {proposal.status.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-xs font-semibold text-foreground">
                          Base Version v{proposal.baseVersion}
                          {proposal.appliedAgentVersion && (
                            <>
                              {" "}
                              <ArrowRight className="inline h-3 w-3 text-muted mx-0.5" /> Applied in v{proposal.appliedAgentVersion}
                            </>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setActiveProposal(proposal);
                            setIsReviewOpen(true);
                          }}
                          className="h-7 text-xs"
                        >
                          Review Diff
                        </Button>

                        {isApplied && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleRetest(proposal.id)}
                            disabled={isRetesting}
                            className="h-7 gap-1 text-xs"
                          >
                            <FlaskConical className="h-3 w-3" />
                            Retest
                          </Button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-foreground font-medium">{proposal.changeSummary}</p>
                    <p className="text-xs text-muted line-clamp-2">{proposal.rationale}</p>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted pt-1">
                      <span>{proposal.fieldChanges.length} field change(s)</span>
                      <span>·</span>
                      <span>Remote Sync: <strong className="text-foreground">{proposal.remoteSyncStatus}</strong></span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Retest Comparisons */}
      {activeTab === "comparisons" && (
        <div className="space-y-4">
          {comparisons.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-xs text-muted">
              <GitCompare className="h-8 w-8 text-muted/60 mb-2" />
              <p className="font-semibold text-foreground text-sm">No Retest Verifications Yet</p>
              <p className="max-w-md mt-1 text-muted">
                After applying an approved fix proposal, launch a retest to evaluate whether the behavioral discrepancy was successfully resolved.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {comparisons.map((comp) => (
                <Card key={comp.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-subtle pb-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={comp.failureResolved ? "success" : "danger"}
                        className="text-xs font-semibold"
                      >
                        {comp.failureResolved ? "Failure Resolved" : "Failure Persists"}
                      </Badge>
                      <span className="text-xs font-medium text-foreground">
                        Tested Agent v{comp.testedAgentVersion}
                      </span>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setActiveComparison(comp);
                        setIsComparisonOpen(true);
                      }}
                      className="h-7 text-xs"
                    >
                      View Comparison
                    </Button>
                  </div>

                  <p className="text-xs text-foreground leading-relaxed">{comp.comparisonSummary}</p>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted pt-1">
                    <span>
                      Turns: {String(comp.originalMetrics.turnsCount || 0)} → {String(comp.retestMetrics.turnsCount || 0)}
                    </span>
                    <span>
                      Outcome: {String(comp.originalMetrics.status || "failed")} → {String(comp.retestMetrics.status || "passed")}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals & Drawers */}
      <FixReviewModal
        proposal={activeProposal}
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        currentAgentVersion={currentAgent?.configVersion}
        onApprove={handleApprove}
        onReject={handleReject}
        onApply={handleApply}
        onRetest={handleRetest}
        isApproving={isApproving}
        isRejecting={isRejecting}
        isApplying={isApplying}
        isRetesting={isRetesting}
      />

      <RetestComparisonDrawer
        comparison={activeComparison}
        open={isComparisonOpen}
        onOpenChange={setIsComparisonOpen}
      />
    </div>
  );
}
