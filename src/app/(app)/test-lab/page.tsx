"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  FlaskConical,
  FolderKanban,
  History,
  Loader2,
  Play,
  RefreshCw,
  Users,
} from "lucide-react";
import type {
  PreflightCheckResult,
  SimulationBatchRecord,
  SimulationRunRecord,
} from "@/server/simulations/schema";
import type { PersonaRecord, ScenarioRecord } from "@/server/personas/schema";
import { BatchStatusBadge } from "@/components/simulations/batch-status-badge";
import { PreflightCard } from "@/components/simulations/preflight-card";
import { RunCard } from "@/components/simulations/run-card";
import { TranscriptDrawer } from "@/components/simulations/transcript-drawer";
import { BatchHistoryTable } from "@/components/simulations/batch-history-table";
import type {
  FailureFindingRecord,
  FixProposalRecord,
  RetestComparisonRecord,
} from "@/server/analysis/schema";
import { FixReviewModal } from "@/components/analysis/fix-review-modal";
import { RetestComparisonDrawer } from "@/components/analysis/retest-comparison-drawer";
import { toast } from "sonner";

interface ProjectOption {
  id: string;
  name: string;
}

interface AgentOption {
  id: string;
  name: string;
  remoteAgentId: string;
  primaryLanguage: string;
}

export default function TestLabPage() {
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");
  const [loadingProjects, setLoadingProjects] = React.useState(true);

  // Tabs: "setup" | "history"
  const [activeTab, setActiveTab] = React.useState<"setup" | "history">("setup");

  // Selection states
  const [agents, setAgents] = React.useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = React.useState<string>("");
  const [personas, setPersonas] = React.useState<PersonaRecord[]>([]);
  const [scenarios, setScenarios] = React.useState<ScenarioRecord[]>([]);
  const [selectedScenarioIds, setSelectedScenarioIds] = React.useState<string[]>([]);

  // Execution options
  const [runName, setRunName] = React.useState<string>("");
  const [concurrency, setConcurrency] = React.useState<number>(1);
  const [repeatCount, setRepeatCount] = React.useState<number>(1);

  // Preflight
  const [preflight, setPreflight] = React.useState<PreflightCheckResult | null>(null);
  const [checkingPreflight, setCheckingPreflight] = React.useState(false);

  // Execution / Active Batch
  const [activeBatch, setActiveBatch] = React.useState<SimulationBatchRecord | null>(null);
  const [activeRuns, setActiveRuns] = React.useState<SimulationRunRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isPolling, setIsPolling] = React.useState(false);

  // History
  const [historyBatches, setHistoryBatches] = React.useState<SimulationBatchRecord[]>([]);

  // Transcript drawer
  const [inspectRun, setInspectRun] = React.useState<SimulationRunRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Phase 5: Closed-Loop Refinement states
  const [findings, setFindings] = React.useState<FailureFindingRecord[]>([]);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isFixingId, setIsFixingId] = React.useState<string | null>(null);
  const [activeProposal, setActiveProposal] = React.useState<FixProposalRecord | null>(null);
  const [fixModalOpen, setFixModalOpen] = React.useState(false);
  const [activeComparison, setActiveComparison] = React.useState<RetestComparisonRecord | null>(null);
  const [comparisonDrawerOpen, setComparisonDrawerOpen] = React.useState(false);
  const [isApproving, setIsApproving] = React.useState(false);
  const [isRejecting, setIsRejecting] = React.useState(false);
  const [isApplying, setIsApplying] = React.useState(false);
  const [isRetesting, setIsRetesting] = React.useState(false);

  const [error, setError] = React.useState<string | null>(null);

  // Load Phase 5 analysis findings and comparison when inspectRun changes
  React.useEffect(() => {
    if (!inspectRun) {
      setFindings([]);
      setActiveComparison(null);
      return;
    }
    const runId = inspectRun.id;
    async function loadAnalysisData() {
      try {
        const [findingsRes, compRes] = await Promise.all([
          fetch(`/api/simulations/runs/${runId}/findings`),
          fetch(`/api/simulations/runs/${runId}/comparison`),
        ]);
        if (findingsRes.ok) {
          const fJson = await findingsRes.json();
          setFindings(fJson.data?.findings || []);
        } else {
          setFindings([]);
        }
        if (compRes.ok) {
          const cJson = await compRes.json();
          setActiveComparison(cJson.data?.comparison || null);
        } else {
          setActiveComparison(null);
        }
      } catch {
        // non-blocking
      }
    }
    loadAnalysisData();
  }, [inspectRun]);

  // 1. Load Projects on Mount
  React.useEffect(() => {
    async function loadProjects() {
      try {
        setLoadingProjects(true);
        const res = await fetch("/api/projects");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message || "Failed to load projects.");
        const items = json.data?.items || json.data || [];
        setProjects(items);
        if (items.length > 0) {
          setSelectedProjectId(items[0].id);
        }
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setLoadingProjects(false);
      }
    }
    loadProjects();
  }, []);

  // 2. Load Agents, Personas, Scenarios, and History when Project changes
  const loadProjectData = React.useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      setError(null);
      const [agentsRes, personasRes, scenariosRes, historyRes] = await Promise.all([
        fetch(`/api/agents?projectId=${selectedProjectId}`),
        fetch(`/api/personas?projectId=${selectedProjectId}`),
        fetch(`/api/scenarios?projectId=${selectedProjectId}`),
        fetch(`/api/simulations?projectId=${selectedProjectId}`),
      ]);

      const [agentsJson, personasJson, scenariosJson, historyJson] = await Promise.all([
        agentsRes.json(),
        personasRes.json(),
        scenariosRes.json(),
        historyRes.json(),
      ]);

      const agentItems: AgentOption[] = (agentsJson.data || []).map(
        (a: {
          id: string;
          name: string;
          remoteAgentId?: string;
          remote_agent_id?: string;
          primaryLanguage?: string;
          primary_language?: string;
        }) => ({
          id: a.id,
          name: a.name,
          remoteAgentId: a.remoteAgentId || a.remote_agent_id || "",
          primaryLanguage: a.primaryLanguage || a.primary_language || "en",
        }),
      );
      setAgents(agentItems);
      if (agentItems.length > 0 && !selectedAgentId && agentItems[0]) {
        setSelectedAgentId(agentItems[0].id);
      }

      setPersonas(personasJson.data || []);
      const scItems: ScenarioRecord[] = scenariosJson.data || [];
      setScenarios(scItems);

      // Pre-select first 3 ready scenarios if none selected
      if (selectedScenarioIds.length === 0 && scItems.length > 0) {
        setSelectedScenarioIds(scItems.slice(0, 3).map((s) => s.id));
      }

      setHistoryBatches(historyJson.data || []);
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }, [selectedProjectId, selectedAgentId, selectedScenarioIds.length]);

  React.useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  // 3. Preflight check whenever agent or scenario selection changes
  React.useEffect(() => {
    if (!selectedProjectId || !selectedAgentId || selectedScenarioIds.length === 0) {
      setPreflight(null);
      return;
    }

    let active = true;
    async function check() {
      try {
        setCheckingPreflight(true);
        const res = await fetch("/api/simulations/preflight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: selectedProjectId,
            targetAgentId: selectedAgentId,
            scenarioIds: selectedScenarioIds,
          }),
        });
        const json = await res.json();
        if (active && res.ok && json.data) {
          setPreflight(json.data);
        }
      } catch {
        // Handled silently
      } finally {
        if (active) setCheckingPreflight(false);
      }
    }

    check();
    return () => {
      active = false;
    };
  }, [selectedProjectId, selectedAgentId, selectedScenarioIds]);

  // 4. Polling loop when an active batch is running
  const pollActiveBatch = React.useCallback(async (batchId: string) => {
    try {
      setIsPolling(true);
      const res = await fetch(`/api/simulations/${batchId}/poll`, { method: "POST" });
      const json = await res.json();
      if (res.ok && json.data) {
        setActiveBatch(json.data.batch);
        setActiveRuns(json.data.runs);
        return json.data.isSettled;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsPolling(false);
    }
  }, []);

  React.useEffect(() => {
    if (!activeBatch) return;
    const isSettled = ["completed", "completed_with_failures", "failed", "infrastructure_error", "timed_out", "cancelled"].includes(
      activeBatch.status,
    );
    if (isSettled) return;

    const interval = setInterval(async () => {
      const settled = await pollActiveBatch(activeBatch.id);
      if (settled) {
        clearInterval(interval);
        loadProjectData();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeBatch, pollActiveBatch, loadProjectData]);

  // Handlers
  const handleToggleScenario = (id: string) => {
    setSelectedScenarioIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllScenarios = () => {
    if (selectedScenarioIds.length === scenarios.length) {
      setSelectedScenarioIds([]);
    } else {
      setSelectedScenarioIds(scenarios.map((s) => s.id));
    }
  };

  const handleStartSimulation = async () => {
    if (!selectedProjectId || !selectedAgentId || selectedScenarioIds.length === 0) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const targetAgent = agents.find((a) => a.id === selectedAgentId);
      const name =
        runName.trim() ||
        `Simulation: ${targetAgent?.name || "Agent"} (${selectedScenarioIds.length} scenarios)`;

      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          targetAgentId: selectedAgentId,
          scenarioIds: selectedScenarioIds,
          name,
          repeatCount,
          concurrency,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to launch simulation run.");
      }

      toast.success("Simulation test launched successfully.");
      setActiveBatch(json.data.batch);
      setActiveRuns(json.data.runs);
      setRunName("");
    } catch (err: unknown) {
      toast.error((err as Error).message);
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRerunRun = async (run: SimulationRunRecord) => {
    try {
      const res = await fetch(`/api/simulations/runs/${run.id}/rerun`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to rerun scenario.");

      toast.success(`Rerunning "${run.scenarioName}"`);
      setActiveBatch(json.data.batch);
      setActiveRuns(json.data.runs);
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  };

  const handleInspectBatch = async (batch: SimulationBatchRecord) => {
    try {
      const res = await fetch(`/api/simulations/${batch.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load batch details.");
      setActiveBatch(json.data.batch);
      setActiveRuns(json.data.runs);
      setActiveTab("setup");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  };

  // Phase 5 Action Handlers
  const handleAnalyzeFailure = async (run: SimulationRunRecord) => {
    try {
      setIsAnalyzing(true);
      const res = await fetch(`/api/simulations/runs/${run.id}/analyze`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to analyze failure.");
      toast.success("Failure analyzed successfully.");
      const fRes = await fetch(`/api/simulations/runs/${run.id}/findings`);
      if (fRes.ok) {
        const fJson = await fRes.json();
        setFindings(fJson.data?.findings || []);
      }
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFixWithAI = async (finding: FailureFindingRecord) => {
    if (!inspectRun) return;
    try {
      setIsFixingId(finding.id);
      const res = await fetch(`/api/simulations/runs/${inspectRun.id}/fix-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findingId: finding.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to generate fix proposal.");
      setActiveProposal(json.data.proposal);
      setFixModalOpen(true);
      toast.success("AI fix proposal generated.");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsFixingId(null);
    }
  };

  const handleApproveProposal = async (proposalId: string) => {
    try {
      setIsApproving(true);
      const res = await fetch(`/api/simulations/proposals/${proposalId}/approve`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to approve proposal.");
      setActiveProposal(json.data.proposal);
      toast.success("Fix proposal approved.");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    try {
      setIsRejecting(true);
      const res = await fetch(`/api/simulations/proposals/${proposalId}/reject`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to reject proposal.");
      setActiveProposal(json.data.proposal);
      toast.info("Fix proposal rejected.");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleApplyProposal = async (proposalId: string, reconcileStale?: boolean) => {
    try {
      setIsApplying(true);
      const res = await fetch(`/api/simulations/proposals/${proposalId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reconcileStale: Boolean(reconcileStale) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to apply fix proposal.");
      setActiveProposal(json.data.proposal);
      toast.success("Fix applied and configuration updated.");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsApplying(false);
    }
  };

  const handleRetestProposal = async (proposalId: string) => {
    try {
      setIsRetesting(true);
      const res = await fetch(`/api/simulations/proposals/${proposalId}/retest`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to retest proposal.");
      setFixModalOpen(false);
      setDrawerOpen(false);
      setActiveBatch(json.data.batch);
      setActiveRuns(json.data.runs);
      toast.success("Retest simulation launched.");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsRetesting(false);
    }
  };

  if (loadingProjects) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Test Lab"
          description="Deploy virtual customers and execute simulation tests against your voice agents."
        />
        <EmptyState
          title="No Projects Found"
          description="You need at least one project with a voice agent and virtual customers to run tests."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Test Lab"
        description="Deploy configured virtual customers against real ElevenLabs voice agents, execute simulation tests, and inspect conversation evidence."
        actions={
          <div className="flex items-center gap-2">
            {activeBatch && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setActiveBatch(null);
                  setActiveRuns([]);
                }}
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                New Simulation
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={loadProjectData}
              disabled={isPolling || isSubmitting}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isPolling ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Top Project Selector & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-muted" />
          <span className="text-xs font-semibold text-foreground">Active Project:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setActiveBatch(null);
              setActiveRuns([]);
            }}
            className="h-8 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {projects.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.name}
              </option>
            ))}
          </select>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 rounded-md bg-subtle p-1 text-xs border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab("setup")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
              activeTab === "setup"
                ? "bg-surface text-accent shadow-xs font-semibold"
                : "text-muted hover:text-foreground"
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            {activeBatch ? "Active Simulation Run" : "Launch Simulations"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
              activeTab === "history"
                ? "bg-surface text-accent shadow-xs font-semibold"
                : "text-muted hover:text-foreground"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Execution History ({historyBatches.length})
          </button>
        </div>
      </div>

      {error && (
        <ErrorState title="Simulation Engine Notice" message={error}>
          <Button variant="secondary" size="sm" onClick={loadProjectData}>
            Retry
          </Button>
        </ErrorState>
      )}

      {/* TAB 1: SETUP OR ACTIVE EXECUTION */}
      {activeTab === "setup" && (
        <>
          {activeBatch ? (
            /* --- ACTIVE RUN VIEW --- */
            <div className="space-y-6">
              {/* Batch Overview Header Card */}
              <Card className="space-y-4 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-bold text-foreground">{activeBatch.name}</h3>
                      <BatchStatusBadge status={activeBatch.status} />
                    </div>
                    <p className="text-xs text-muted">
                      ElevenLabs Invocation:{" "}
                      <span className="font-mono text-foreground font-medium">
                        {activeBatch.remoteInvocationId || "Provisioning..."}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => pollActiveBatch(activeBatch.id)}
                      disabled={isPolling}
                    >
                      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isPolling ? "animate-spin" : ""}`} />
                      {isPolling ? "Polling ElevenLabs..." : "Refresh Status"}
                    </Button>
                  </div>
                </div>

                {/* Progress Counters Bar */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 text-center">
                  <div className="rounded-md border bg-subtle/40 p-2.5">
                    <span className="text-[11px] text-muted uppercase font-semibold">Total Scenarios</span>
                    <p className="mt-0.5 text-xl font-bold text-foreground">{activeBatch.totalScenarios}</p>
                  </div>
                  <div className="rounded-md border bg-subtle/40 p-2.5">
                    <span className="text-[11px] text-muted uppercase font-semibold">Completed</span>
                    <p className="mt-0.5 text-xl font-bold text-foreground">{activeBatch.completedScenarios}</p>
                  </div>
                  <div className="rounded-md border border-success/30 bg-success-soft/30 p-2.5">
                    <span className="text-[11px] text-success uppercase font-semibold">Passed</span>
                    <p className="mt-0.5 text-xl font-bold text-success">{activeBatch.passedScenarios}</p>
                  </div>
                  <div className="rounded-md border border-danger/30 bg-danger-soft/30 p-2.5">
                    <span className="text-[11px] text-danger uppercase font-semibold">Failed</span>
                    <p className="mt-0.5 text-xl font-bold text-danger">{activeBatch.failedScenarios}</p>
                  </div>
                  <div className="rounded-md border border-warning/30 bg-warning-soft/30 p-2.5">
                    <span className="text-[11px] text-warning uppercase font-semibold">Errors</span>
                    <p className="mt-0.5 text-xl font-bold text-warning">{activeBatch.erroredScenarios}</p>
                  </div>
                </div>

                {activeBatch.errorMessage && (
                  <div className="rounded-md border border-danger/30 bg-danger-soft p-3 text-xs text-danger">
                    <p className="font-semibold">Execution Issue:</p>
                    <p className="mt-0.5 text-muted">{activeBatch.errorMessage}</p>
                  </div>
                )}
              </Card>

              {/* Individual Runs Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    Scenario Executions ({activeRuns.length})
                  </h4>
                  <span className="text-xs text-muted">
                    Click &ldquo;Inspect Result&rdquo; to view full conversation transcript and evaluator rationale.
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {activeRuns.map((run) => (
                    <RunCard
                      key={run.id}
                      run={run}
                      onInspect={(r) => {
                        setInspectRun(r);
                        setDrawerOpen(true);
                      }}
                      onRerun={handleRerunRun}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* --- SETUP WORKFLOW --- */
            <div className="space-y-6">
              {/* Agent Picker & Options */}
              <Card className="space-y-4 p-5">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  1. Select Target ElevenLabs Agent
                </h3>

                {agents.length === 0 ? (
                  <EmptyState
                    title="No Voice Agents Found"
                    description="You need to create and synchronize a voice agent before running simulation tests."
                  >
                    <Button variant="primary" size="sm" onClick={() => (window.location.href = "/agents/new")}>
                      Create Voice Agent
                    </Button>
                  </EmptyState>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {agents.map((ag) => (
                      <div
                        key={ag.id}
                        onClick={() => setSelectedAgentId(ag.id)}
                        className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
                          selectedAgentId === ag.id
                            ? "border-accent bg-accent/5 ring-1 ring-accent"
                            : "border-border hover:bg-subtle/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-accent" />
                            <span className="font-semibold text-sm text-foreground">{ag.name}</span>
                          </div>
                          <span className="rounded bg-subtle px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted">
                            {ag.primaryLanguage}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-muted truncate">
                          ID: {ag.remoteAgentId || "Not synchronized"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Scenario Checklist */}
              <Card className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                      2. Select Test Scenarios ({selectedScenarioIds.length} Selected)
                    </h3>
                    <p className="text-xs text-muted">
                      Each scenario will deploy its configured virtual customer persona against the target agent.
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleSelectAllScenarios}>
                    {selectedScenarioIds.length === scenarios.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>

                {scenarios.length === 0 ? (
                  <EmptyState
                    title="No Scenarios Available"
                    description="Create test scenarios under Virtual Customers Studio to run simulations."
                  >
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => (window.location.href = "/virtual-customers")}
                    >
                      Go to Virtual Customer Studio
                    </Button>
                  </EmptyState>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {scenarios.map((sc) => {
                      const persona = personas.find((p) => p.id === sc.personaId);
                      const isSelected = selectedScenarioIds.includes(sc.id);

                      return (
                        <div
                          key={sc.id}
                          onClick={() => handleToggleScenario(sc.id)}
                          className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
                            isSelected
                              ? "border-accent bg-accent/5 ring-1 ring-accent"
                              : "border-border hover:bg-subtle/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-sm text-foreground">{sc.name}</h4>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleScenario(sc.id)}
                              className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                            />
                          </div>

                          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                            <Users className="h-3 w-3 text-accent" />
                            <span className="font-medium text-foreground">
                              {persona?.name || "Customer Persona"}
                            </span>
                          </div>

                          <p className="mt-1 line-clamp-2 text-xs text-muted">
                            {sc.config?.objective?.primaryGoal || sc.description || "Test scenario"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Preflight Check Card */}
              {preflight && <PreflightCard preflight={preflight} />}

              {/* Execution Options & Launch Controls */}
              <Card className="space-y-4 p-5">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  3. Execution Options & Launch Controls
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground">Simulation Run Name (Optional)</label>
                    <Input
                      value={runName}
                      onChange={(e) => setRunName(e.target.value)}
                      placeholder="e.g. Sprint 4 Customer Stress Test"
                      className="mt-1 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground">Concurrency (1 to 5)</label>
                    <select
                      value={concurrency}
                      onChange={(e) => setConcurrency(Number(e.target.value))}
                      className="mt-1 flex h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value={1}>1 (Sequential / Safest)</option>
                      <option value={2}>2 Parallel Executions</option>
                      <option value={3}>3 Parallel Executions</option>
                      <option value={5}>5 Parallel Executions</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground">Execution Count per Scenario</label>
                    <select
                      value={repeatCount}
                      onChange={(e) => setRepeatCount(Number(e.target.value))}
                      className="mt-1 flex h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value={1}>1 Execution (Standard)</option>
                      <option value={2}>2 Repeat Executions</option>
                      <option value={3}>3 Repeat Executions</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <div className="text-xs text-muted">
                    {checkingPreflight ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Validating preflight readiness...
                      </span>
                    ) : preflight?.canExecute ? (
                      <span className="flex items-center gap-1.5 text-success font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Ready to run {selectedScenarioIds.length} simulation scenario(s)
                      </span>
                    ) : (
                      <span className="text-muted">
                        Select a synchronized agent and at least one scenario to proceed.
                      </span>
                    )}
                  </div>

                  <Button
                    size="md"
                    variant="primary"
                    disabled={
                      isSubmitting ||
                      checkingPreflight ||
                      !preflight?.canExecute ||
                      selectedScenarioIds.length === 0
                    }
                    onClick={handleStartSimulation}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Launching Simulation...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Run Simulation Tests ({selectedScenarioIds.length})
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* TAB 2: EXECUTION HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <BatchHistoryTable batches={historyBatches} onSelectBatch={handleInspectBatch} />
        </div>
      )}

      {/* Transcript Drawer Modal */}
      <TranscriptDrawer
        run={inspectRun}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onRerun={handleRerunRun}
        findings={findings}
        isAnalyzing={isAnalyzing}
        onAnalyze={handleAnalyzeFailure}
        onFixWithAI={handleFixWithAI}
        isFixingId={isFixingId}
        comparison={activeComparison}
        onViewComparison={(comp) => {
          setActiveComparison(comp);
          setComparisonDrawerOpen(true);
        }}
      />

      {/* Fix Review Modal */}
      <FixReviewModal
        proposal={activeProposal}
        open={fixModalOpen}
        onOpenChange={setFixModalOpen}
        onApprove={handleApproveProposal}
        onReject={handleRejectProposal}
        onApply={handleApplyProposal}
        onRetest={handleRetestProposal}
        isApproving={isApproving}
        isRejecting={isRejecting}
        isApplying={isApplying}
        isRetesting={isRetesting}
      />

      {/* Retest Comparison Drawer */}
      <RetestComparisonDrawer
        comparison={activeComparison}
        open={comparisonDrawerOpen}
        onOpenChange={setComparisonDrawerOpen}
        onViewOriginalRun={(runId) => {
          const r = activeRuns.find((x) => x.id === runId);
          if (r) {
            setInspectRun(r);
            setDrawerOpen(true);
          }
        }}
        onViewRetestRun={(runId) => {
          const r = activeRuns.find((x) => x.id === runId);
          if (r) {
            setInspectRun(r);
            setDrawerOpen(true);
          }
        }}
      />
    </div>
  );
}
