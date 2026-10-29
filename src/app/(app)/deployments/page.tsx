"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import {
  FolderKanban,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type {
  DeploymentEnvironment,
  DeploymentRecord,
  ReleaseReadinessSnapshot,
} from "@/server/deployments/schema";
import type { AgentVersion } from "@/server/agents/repository";
import { ReadinessCard } from "@/components/deployments/readiness-card";
import { RollbackModal } from "@/components/deployments/rollback-modal";
import { DeploymentDetailDrawer } from "@/components/deployments/deployment-detail-drawer";

interface ProjectOption {
  id: string;
  name: string;
}

interface AgentOption {
  id: string;
  name: string;
  configVersion: number;
  remoteAgentId: string | null;
  syncedVersion: number | null;
}

export default function DeploymentsPage() {
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");
  const [loadingProjects, setLoadingProjects] = React.useState(true);

  // Environment selector
  const [selectedEnv, setSelectedEnv] = React.useState<DeploymentEnvironment>("production");

  // Project data
  const [agents, setAgents] = React.useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = React.useState<string>("");
  const [deployments, setDeployments] = React.useState<DeploymentRecord[]>([]);
  const [loadingData, setLoadingData] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Readiness state for candidate inspector
  const [readiness, setReadiness] = React.useState<ReleaseReadinessSnapshot | null>(null);
  const [loadingReadiness, setLoadingReadiness] = React.useState(false);
  const [isPromoting, setIsPromoting] = React.useState(false);

  // Rollback Modal state
  const [rollbackAgentData, setRollbackAgentData] = React.useState<{
    agentId: string;
    agentName: string;
    currentVersion: number;
    versions: AgentVersion[];
  } | null>(null);
  const [rollbackModalOpen, setRollbackModalOpen] = React.useState(false);
  const [isRollingBack, setIsRollingBack] = React.useState(false);

  // Detail Drawer state
  const [inspectDeployment, setInspectDeployment] = React.useState<DeploymentRecord | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = React.useState(false);

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

  // 2. Load Project Agents and Deployments
  const loadProjectData = React.useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      setLoadingData(true);
      setError(null);
      const [agentsRes, depRes] = await Promise.all([
        fetch(`/api/agents?projectId=${selectedProjectId}`),
        fetch(`/api/deployments?projectId=${selectedProjectId}&environment=${selectedEnv}`),
      ]);

      const [agentsJson, depJson] = await Promise.all([agentsRes.json(), depRes.json()]);

      if (!agentsRes.ok) throw new Error(agentsJson.error?.message || "Failed to load agents.");
      if (!depRes.ok) throw new Error(depJson.error?.message || "Failed to load deployments.");

      const agentList: AgentOption[] = agentsJson.data || [];
      setAgents(agentList);
      setDeployments(depJson.data?.deployments || []);

      if (agentList[0] && !selectedAgentId) {
        setSelectedAgentId(agentList[0].id);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoadingData(false);
    }
  }, [selectedProjectId, selectedEnv, selectedAgentId]);

  React.useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  // 3. Load Readiness when selectedAgentId changes
  React.useEffect(() => {
    if (!selectedAgentId) {
      setReadiness(null);
      return;
    }

    async function loadReadiness() {
      try {
        setLoadingReadiness(true);
        const res = await fetch(`/api/deployments/readiness?agentId=${selectedAgentId}`);
        const json = await res.json();
        if (res.ok && json.data?.readiness) {
          setReadiness(json.data.readiness);
        } else {
          setReadiness(null);
        }
      } catch {
        setReadiness(null);
      } finally {
        setLoadingReadiness(false);
      }
    }

    loadReadiness();
  }, [selectedAgentId]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  // Promote / Deploy Action Handler
  const handlePromoteCandidate = async () => {
    if (!selectedAgent || !selectedProjectId) return;
    try {
      setIsPromoting(true);
      // 1. Create deployment candidate
      const createRes = await fetch("/api/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          agentId: selectedAgent.id,
          agentVersion: selectedAgent.configVersion,
          environment: selectedEnv,
          notes: `Promoted candidate v${selectedAgent.configVersion}`,
        }),
      });

      const createJson = await createRes.json();
      if (!createRes.ok) throw new Error(createJson.error?.message || "Failed to create deployment.");

      const depId = createJson.data.deployment.id;

      // 2. Promote deployment
      const promoteRes = await fetch(`/api/deployments/${depId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceDeploy: false }),
      });

      const promoteJson = await promoteRes.json();
      if (!promoteRes.ok) throw new Error(promoteJson.error?.message || "Failed to promote deployment.");

      toast.success(`Successfully deployed "${selectedAgent.name}" (v${selectedAgent.configVersion}) to ${selectedEnv}!`);
      loadProjectData();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsPromoting(false);
    }
  };

  // Rollback Action Handler
  const handleOpenRollback = async (agentId: string, agentName: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load agent versions.");

      const agent = json.data.agent;
      const versions: AgentVersion[] = json.data.versions || [];

      setRollbackAgentData({
        agentId: agent.id,
        agentName: agentName || agent.name,
        currentVersion: agent.configVersion,
        versions,
      });
      setRollbackModalOpen(true);
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  };

  const handleExecuteRollback = async (targetVersion: number, reason: string) => {
    if (!rollbackAgentData) return;
    try {
      setIsRollingBack(true);
      const res = await fetch(`/api/agents/${rollbackAgentData.agentId}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetVersion,
          reason,
          environment: selectedEnv,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Rollback failed.");

      toast.success(
        `Rollback successful! Restored configuration v${targetVersion} as new version v${json.data.newVersion}.`
      );
      setRollbackModalOpen(false);
      loadProjectData();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsRollingBack(false);
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
      <EmptyState
        title="No projects found"
        description="Create a project to manage voice agents and release deployments."
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

  const activeDeployedCount = deployments.filter((d) => d.status === "deployed").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Deployments & Release Management"
        description="Verify release readiness criteria, promote vetted agent configurations to live environments, and execute safe rollbacks with verifiable audit trails."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={loadProjectData}
            disabled={loadingData}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingData ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* Top Project & Environment Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-muted" />
          <span className="text-xs font-semibold text-foreground">Project:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setSelectedAgentId("");
            }}
            className="flex h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Environment Selector Tabs */}
        <div className="flex items-center gap-1 rounded-md border bg-subtle p-1">
          {(["production", "staging", "development"] as DeploymentEnvironment[]).map((env) => (
            <button
              key={env}
              type="button"
              onClick={() => setSelectedEnv(env)}
              className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
                selectedEnv === env
                  ? "bg-surface text-foreground shadow-xs font-semibold"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {env}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorState title="Failed to load deployments" message={error} />}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <span className="text-[11px] font-semibold text-muted uppercase">Active Deployments</span>
          <p className="mt-1 text-2xl font-bold text-foreground">{activeDeployedCount}</p>
        </Card>
        <Card className="p-4">
          <span className="text-[11px] font-semibold text-muted uppercase">Total Releases</span>
          <p className="mt-1 text-2xl font-bold text-foreground">{deployments.length}</p>
        </Card>
        <Card className="p-4">
          <span className="text-[11px] font-semibold text-muted uppercase">Candidate Readiness</span>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {readiness ? `${readiness.score}%` : "—"}
          </p>
        </Card>
        <Card className="p-4">
          <span className="text-[11px] font-semibold text-muted uppercase">Environment</span>
          <p className="mt-1 text-2xl font-bold text-foreground capitalize">{selectedEnv}</p>
        </Card>
      </div>

      {/* Section 1: Release Candidate & Readiness Inspector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-accent" />
            Release Candidate & Readiness Inspector
          </h3>
          {agents.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Inspect Agent:</span>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="flex h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (v{a.configVersion})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {agents.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted">
            No agents found in this project. Create an agent before preparing a deployment.
          </div>
        ) : loadingReadiness ? (
          <div className="flex h-32 items-center justify-center rounded-lg border bg-surface">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : readiness && selectedAgent ? (
          <ReadinessCard
            agentName={selectedAgent.name}
            agentVersion={selectedAgent.configVersion}
            readiness={readiness}
            onPromote={handlePromoteCandidate}
            isPromoting={isPromoting}
          />
        ) : (
          <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted">
            Select an agent above to evaluate launch readiness and inspect blockers.
          </div>
        )}
      </div>

      {/* Section 2: Deployment History Table */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <History className="h-4 w-4 text-accent" />
            Deployment History ({deployments.length})
          </h3>
          <span className="text-xs text-muted">
            Showing all historical release records for environment &ldquo;{selectedEnv}&rdquo;.
          </span>
        </div>

        {deployments.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-xs text-muted">
            No deployments recorded in <strong>{selectedEnv}</strong> environment yet. Promote a verified candidate above.
          </div>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-subtle/50 text-muted uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Agent</th>
                    <th className="px-4 py-3 font-semibold">Version</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Pass Rate</th>
                    <th className="px-4 py-3 font-semibold">Deployed At</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {deployments.map((dep) => {
                    const isDeployed = dep.status === "deployed";
                    const r = dep.readinessSnapshot;

                    return (
                      <tr key={dep.id} className="hover:bg-subtle/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {dep.agentName || "Agent"}
                        </td>
                        <td className="px-4 py-3 font-mono">v{dep.agentVersion}</td>
                        <td className="px-4 py-3">
                          <Badge
                            tone={
                              isDeployed
                                ? "success"
                                : dep.status === "failed"
                                ? "danger"
                                : dep.status === "ready_for_release"
                                ? "accent"
                                : dep.status === "rolled_back"
                                ? "warning"
                                : "neutral"
                            }
                            className="capitalize"
                          >
                            {dep.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {r?.passRatePercentage !== undefined ? `${r.passRatePercentage}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {dep.deployedAt
                            ? new Date(dep.deployedAt).toLocaleString()
                            : new Date(dep.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                setInspectDeployment(dep);
                                setDetailDrawerOpen(true);
                              }}
                            >
                              Details
                            </Button>
                            {isDeployed && (
                              <Button
                                variant="danger"
                                size="sm"
                                className="text-xs"
                                onClick={() => handleOpenRollback(dep.agentId, dep.agentName || "Agent")}
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                Rollback
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Rollback Modal */}
      {rollbackAgentData && (
        <RollbackModal
          agentId={rollbackAgentData.agentId}
          agentName={rollbackAgentData.agentName}
          currentVersion={rollbackAgentData.currentVersion}
          versions={rollbackAgentData.versions}
          open={rollbackModalOpen}
          onOpenChange={setRollbackModalOpen}
          onRollback={handleExecuteRollback}
          isRollingBack={isRollingBack}
        />
      )}

      {/* Deployment Detail Drawer */}
      <DeploymentDetailDrawer
        deployment={inspectDeployment}
        open={detailDrawerOpen}
        onOpenChange={setDetailDrawerOpen}
        onRollback={(dep) => handleOpenRollback(dep.agentId, dep.agentName || "Agent")}
      />
    </div>
  );
}
