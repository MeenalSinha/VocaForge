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
  BarChart3,
  CheckCircle2,
  Clock,
  Filter,
  History,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import type { ObservabilityMetrics } from "@/server/observability/service";
import type { SimulationRunRecord, RunStatus } from "@/server/simulations/schema";
import type {
  FailureFindingRecord,
  RetestComparisonRecord,
} from "@/server/analysis/schema";
import { FAILURE_CATEGORIES, CATEGORY_DEFINITIONS } from "@/server/analysis/categories";
import { TranscriptDrawer } from "@/components/simulations/transcript-drawer";
import { RunStatusBadge } from "@/components/simulations/batch-status-badge";

interface ProjectOption {
  id: string;
  name: string;
}

interface AgentOption {
  id: string;
  name: string;
}

interface ExecutionHistoryItem {
  id: string;
  batchId: string;
  projectId: string;
  targetAgentId: string;
  agentName: string;
  scenarioId: string;
  personaId: string;
  scenarioName: string;
  personaName: string;
  status: string;
  evaluationResult: string | null;
  evaluationRationale: string | null;
  transcript: Array<{
    role: "agent" | "user" | "system";
    message: string;
    timeInCallSecs?: number;
    toolCalls?: unknown[];
  }>;
  metrics: Record<string, unknown>;
  errorMessage: string | null;
  findingsCount: number;
  proposalsCount: number;
  comparison: {
    id: string;
    failureResolved: boolean;
  } | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export default function ResultsPage() {
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");
  const [agents, setAgents] = React.useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  const [metrics, setMetrics] = React.useState<ObservabilityMetrics | null>(null);
  const [executions, setExecutions] = React.useState<ExecutionHistoryItem[]>([]);
  const [loadingProjects, setLoadingProjects] = React.useState<boolean>(true);
  const [loadingData, setLoadingData] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Transcript drawer state
  const [drawerOpen, setDrawerOpen] = React.useState<boolean>(false);
  const [selectedRun, setSelectedRun] = React.useState<SimulationRunRecord | null>(null);
  const [runFindings, setRunFindings] = React.useState<FailureFindingRecord[]>([]);
  const [runComparison, setRunComparison] = React.useState<RetestComparisonRecord | null>(null);
  const [_loadingRunDetails, setLoadingRunDetails] = React.useState<boolean>(false);

  // 1. Load initial projects
  React.useEffect(() => {
    async function loadProjects() {
      try {
        setLoadingProjects(true);
        const res = await fetch("/api/projects");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message || "Failed to load projects.");

        const list: ProjectOption[] = json.data?.items || (Array.isArray(json.data) ? json.data : []);
        setProjects(list);
        if (list[0]) {
          setSelectedProjectId(list[0].id);
        }
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setLoadingProjects(false);
      }
    }
    loadProjects();
  }, []);

  // 2. Load agents, metrics, and executions when project changes
  const refreshData = React.useCallback(async () => {
    if (!selectedProjectId) return;

    try {
      setLoadingData(true);
      setError(null);

      // Fetch agents for project filter
      const [agentsRes, metricsRes, execRes] = await Promise.all([
        fetch(`/api/agents?projectId=${selectedProjectId}`),
        fetch(`/api/observability/metrics?projectId=${selectedProjectId}`),
        fetch(
          `/api/observability/executions?projectId=${selectedProjectId}${
            selectedAgentId !== "all" ? `&agentId=${selectedAgentId}` : ""
          }${statusFilter !== "all" ? `&status=${statusFilter}` : ""}${
            searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""
          }`,
        ),
      ]);

      const [agentsJson, metricsJson, execJson] = await Promise.all([
        agentsRes.json(),
        metricsRes.json(),
        execRes.json(),
      ]);

      if (!agentsRes.ok) throw new Error(agentsJson.error?.message || "Failed to load agents.");
      if (!metricsRes.ok) throw new Error(metricsJson.error?.message || "Failed to load metrics.");
      if (!execRes.ok) throw new Error(execJson.error?.message || "Failed to load executions.");

      setAgents(agentsJson.data || []);
      setMetrics(metricsJson.data.metrics);
      setExecutions(execJson.data.executions || []);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoadingData(false);
    }
  }, [selectedProjectId, selectedAgentId, statusFilter, searchQuery]);

  React.useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Open transcript drawer and fetch full run details, findings & comparisons
  async function handleInspectRun(item: ExecutionHistoryItem) {
    setDrawerOpen(true);
    setLoadingRunDetails(true);

    try {
      const [runRes, findingsRes, compRes] = await Promise.all([
        fetch(`/api/simulations/runs/${item.id}`),
        fetch(`/api/simulations/runs/${item.id}/findings`),
        fetch(`/api/simulations/runs/${item.id}/comparison`),
      ]);

      if (runRes.ok) {
        const json = await runRes.json();
        setSelectedRun(json.data?.run || null);
      }

      if (findingsRes.ok) {
        const json = await findingsRes.json();
        setRunFindings(json.data || []);
      } else {
        setRunFindings([]);
      }

      if (compRes.ok) {
        const json = await compRes.json();
        setRunComparison(json.data || null);
      } else {
        setRunComparison(null);
      }
    } catch {
      setRunFindings([]);
      setRunComparison(null);
    } finally {
      setLoadingRunDetails(false);
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
        description="Create a project to execute simulations and view test observability results."
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Results & Observability"
        description="Comprehensive simulation telemetry, evaluation verdicts, and failure category distribution across test runs."
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
        <ErrorState title="Failed to load telemetry" message={error}>
          <Button variant="secondary" size="sm" onClick={refreshData}>
            Retry
          </Button>
        </ErrorState>
      )}

      {/* KPI Metric Summary Cards */}
      {metrics && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Card className="p-4 text-center shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total Test Runs</p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground font-mono">
              {metrics.totalRuns}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">Recorded simulations</p>
          </Card>

          <Card className="p-4 text-center shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Completed Evals</p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground font-mono">
              {metrics.completedEvaluations}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {metrics.infrastructureErrors > 0
                ? `${metrics.infrastructureErrors} infra error(s)`
                : "0 infra errors"}
            </p>
          </Card>

          <Card className="p-4 text-center shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Passing Rate</p>
            <p
              className={`mt-1.5 text-2xl font-bold tracking-tight font-mono ${
                metrics.passingRatePercentage === null
                  ? "text-muted"
                  : metrics.passingRatePercentage >= 80
                    ? "text-success"
                    : metrics.passingRatePercentage >= 50
                      ? "text-warning"
                      : "text-danger"
              }`}
            >
              {metrics.passingRatePercentage !== null ? `${metrics.passingRatePercentage}%` : "N/A"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {metrics.passedEvaluations}/{metrics.completedEvaluations} passed
            </p>
          </Card>

          <Card className="p-4 text-center shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Unresolved Findings</p>
            <p
              className={`mt-1.5 text-2xl font-bold tracking-tight font-mono ${
                metrics.unresolvedFindings > 0 ? "text-warning" : "text-success"
              }`}
            >
              {metrics.unresolvedFindings}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {metrics.totalFindings} total findings
            </p>
          </Card>

          <Card className="p-4 text-center shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Retest Resolution</p>
            <p
              className={`mt-1.5 text-2xl font-bold tracking-tight font-mono ${
                metrics.retestResolutionRatePercentage === null
                  ? "text-muted"
                  : metrics.retestResolutionRatePercentage >= 80
                    ? "text-success"
                    : "text-warning"
              }`}
            >
              {metrics.retestResolutionRatePercentage !== null
                ? `${metrics.retestResolutionRatePercentage}%`
                : "N/A"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {metrics.resolvedRetestsCount}/{metrics.retestsCount} verified
            </p>
          </Card>

          <Card className="p-4 text-center shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Deployed Agents</p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-accent font-mono">
              {metrics.deployedAgentsCount}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">Production releases</p>
          </Card>
        </div>
      )}

      {/* Failure Category Distribution */}
      {metrics && (
        <Card className="p-4">
          <div className="flex items-center justify-between border-b border-subtle pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-foreground">
                Failure Category Distribution
              </h2>
            </div>
            <span className="text-xs text-muted">
              {metrics.totalFindings === 0
                ? "No failures detected"
                : `${metrics.totalFindings} findings identified`}
            </span>
          </div>

          <div className="mt-4">
            {metrics.totalFindings === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-success-soft p-3 text-xs text-success border border-success/20">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                <span>
                  No failure findings recorded. All simulation runs executed cleanly or have not identified discrepancies.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {FAILURE_CATEGORIES.map((catKey) => {
                  const count = metrics.categoryDistribution[catKey] || 0;
                  const meta = CATEGORY_DEFINITIONS[catKey];
                  return (
                    <div
                      key={catKey}
                      className={`flex items-center justify-between rounded-md border p-2.5 text-xs transition-colors ${
                        count > 0
                          ? "border-warning/30 bg-warning-soft text-foreground"
                          : "border-border/60 bg-subtle/30 text-muted"
                      }`}
                    >
                      <div className="space-y-0.5 pr-2">
                        <p className="font-medium text-foreground">{meta.label}</p>
                        <p className="line-clamp-1 text-[11px] text-muted">{meta.description}</p>
                      </div>
                      <Badge
                        tone={count > 0 ? "warning" : "neutral"}
                        className="h-5 px-2 text-[10px]"
                      >
                        {count}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Filterable Execution History Table */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 border-b border-subtle pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Execution History</h2>
            <Badge tone="neutral" className="text-[10px]">
              {executions.length} runs
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[160px] flex-1 sm:w-48 sm:flex-none">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search scenario..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-subtle bg-surface pl-8 pr-3 py-1 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>

            {/* Agent Filter */}
            <select
              aria-label="Filter by Agent"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="rounded-md border border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-foreground focus:border-accent focus:outline-none"
            >
              <option value="all">All Agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              aria-label="Filter by Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-foreground focus:border-accent focus:outline-none"
            >
              <option value="all">All Verdicts</option>
              <option value="passed">Passed</option>
              <option value="failed_evaluation">Failed Evaluation</option>
              <option value="infrastructure_error">Infra Error</option>
              <option value="inconclusive">Inconclusive</option>
            </select>
          </div>
        </div>

        {/* Table / List */}
        <div className="mt-4 overflow-x-auto">
          {executions.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted">
              <Filter className="mx-auto h-6 w-6 text-muted/60" />
              <p className="mt-2 font-medium">No execution runs match your criteria.</p>
              <p className="mt-0.5 text-muted/80">
                Run tests in Test Lab or adjust filters to view simulation results.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-subtle text-[11px] font-semibold text-muted">
                <tr>
                  <th className="pb-2">Scenario & Persona</th>
                  <th className="pb-2">Target Agent</th>
                  <th className="pb-2">Verdict</th>
                  <th className="pb-2 text-center">Turns</th>
                  <th className="pb-2 text-center">Findings</th>
                  <th className="pb-2 text-center">Retest Status</th>
                  <th className="pb-2">Executed</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle/50">
                {executions.map((item) => (
                  <tr key={item.id} className="hover:bg-subtle/20 transition-colors">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-foreground">{item.scenarioName}</p>
                      <p className="text-[11px] text-muted">Persona: {item.personaName}</p>
                    </td>

                    <td className="py-2.5 pr-3 font-medium text-foreground">
                      {item.agentName}
                    </td>

                    <td className="py-2.5 pr-3">
                      <RunStatusBadge status={item.status as RunStatus} />
                    </td>

                    <td className="py-2.5 pr-3 text-center font-mono text-muted">
                      {item.transcript?.length || 0}
                    </td>

                    <td className="py-2.5 pr-3 text-center">
                      {item.findingsCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-500 font-semibold">
                          <AlertTriangle className="h-3 w-3" />
                          {item.findingsCount}
                        </span>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>

                    <td className="py-2.5 pr-3 text-center">
                      {item.comparison ? (
                        item.comparison.failureResolved ? (
                          <Badge tone="success" className="text-[9px]">
                            Resolved
                          </Badge>
                        ) : (
                          <Badge tone="danger" className="text-[9px]">
                            Unresolved
                          </Badge>
                        )
                      ) : (
                        <span className="text-muted text-[10px]">&mdash;</span>
                      )}
                    </td>

                    <td className="py-2.5 pr-3 text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>

                    <td className="py-2.5 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleInspectRun(item)}
                        className="h-7 px-2.5 text-[11px]"
                      >
                        Inspect Transcript
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Transcript Drawer */}
      <TranscriptDrawer
        run={selectedRun}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        findings={runFindings}
        comparison={runComparison}
      />
    </div>
  );
}
