"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { PersonaCard } from "@/components/personas/persona-card";
import { ScenarioCard } from "@/components/personas/scenario-card";
import { PersonaWizard } from "@/components/personas/persona-wizard";
import { PersonaPreviewModal } from "@/components/personas/persona-preview-modal";
import { ScenarioDialog } from "@/components/personas/scenario-dialog";
import { TemplateLibrary } from "@/components/personas/template-library";
import {
  BookOpen,
  FlaskConical,
  FolderKanban,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import type { AgentConfig } from "@/server/agents/config-schema";
import type { PersonaRecord, ScenarioRecord } from "@/server/personas/schema";
import type { PersonaTemplate } from "@/server/personas/templates";
import { toast } from "sonner";

interface ProjectOption {
  id: string;
  name: string;
}

export default function VirtualCustomersPage() {
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");
  const [loadingProjects, setLoadingProjects] = React.useState(true);

  // Tab: "personas" | "scenarios" | "templates"
  const [activeTab, setActiveTab] = React.useState<"personas" | "scenarios" | "templates">("personas");

  // Data states
  const [personas, setPersonas] = React.useState<PersonaRecord[]>([]);
  const [scenarios, setScenarios] = React.useState<ScenarioRecord[]>([]);
  const [agents, setAgents] = React.useState<{ id: string; name: string; config?: AgentConfig }[]>([]);
  const [stats, setStats] = React.useState({ total: 0, ready: 0, draft: 0, needsConfig: 0, archived: 0 });
  const [loadingData, setLoadingData] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");

  // Dialog & Modal states
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [editingPersona, setEditingPersona] = React.useState<PersonaRecord | null>(null);
  const [wizardTemplate, setWizardTemplate] = React.useState<PersonaTemplate | null>(null);

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewPersona, setPreviewPersona] = React.useState<PersonaRecord | null>(null);

  const [scenarioDialogOpen, setScenarioDialogOpen] = React.useState(false);
  const [editingScenario, setEditingScenario] = React.useState<ScenarioRecord | null>(null);
  const [preselectedPersonaId, setPreselectedPersonaId] = React.useState<string>("");

  // 1. Load projects on mount
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

  // 2. Load personas, scenarios, agents, and stats when selected project changes
  const fetchData = React.useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      setLoadingData(true);
      setError(null);

      const [personasRes, scenariosRes, agentsRes, statsRes] = await Promise.all([
        fetch(`/api/personas?projectId=${selectedProjectId}`),
        fetch(`/api/scenarios?projectId=${selectedProjectId}`),
        fetch(`/api/agents?projectId=${selectedProjectId}`),
        fetch(`/api/personas/stats?projectId=${selectedProjectId}`),
      ]);

      const [personasJson, scenariosJson, agentsJson, statsJson] = await Promise.all([
        personasRes.json(),
        scenariosRes.json(),
        agentsRes.json(),
        statsRes.json(),
      ]);

      if (!personasRes.ok) throw new Error(personasJson.error?.message || "Failed to load personas.");
      if (!scenariosRes.ok) throw new Error(scenariosJson.error?.message || "Failed to load scenarios.");

      setPersonas(personasJson.data || []);
      setScenarios(scenariosJson.data || []);
      setAgents(agentsJson.data || []);
      if (statsRes.ok && statsJson.data) {
        setStats(statsJson.data);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoadingData(false);
    }
  }, [selectedProjectId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Persona actions
  const handleOpenCreateWizard = () => {
    setEditingPersona(null);
    setWizardTemplate(null);
    setWizardOpen(true);
  };

  const handleEditPersona = (persona: PersonaRecord) => {
    setEditingPersona(persona);
    setWizardTemplate(null);
    setWizardOpen(true);
  };

  const handlePreviewPersona = (persona: PersonaRecord) => {
    setPreviewPersona(persona);
    setPreviewOpen(true);
  };

  const handleDuplicatePersona = async (persona: PersonaRecord) => {
    try {
      const res = await fetch(`/api/personas/${persona.id}/duplicate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to duplicate persona.");
      toast.success(`Duplicated as "${json.data.persona.name}"`);
      fetchData();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  };

  const handleArchivePersona = async (persona: PersonaRecord) => {
    if (!confirm(`Are you sure you want to archive "${persona.name}"?`)) return;
    try {
      const res = await fetch(`/api/personas/${persona.id}/archive`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to archive persona.");
      toast.success(`Archived "${persona.name}"`);
      fetchData();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  };

  // Scenario actions
  const handleCreateScenario = (persona?: PersonaRecord) => {
    setEditingScenario(null);
    setPreselectedPersonaId(persona ? persona.id : personas[0]?.id || "");
    setScenarioDialogOpen(true);
  };

  const handleEditScenario = (scenario: ScenarioRecord) => {
    setEditingScenario(scenario);
    setScenarioDialogOpen(true);
  };

  const handleDuplicateScenario = async (scenario: ScenarioRecord) => {
    try {
      const res = await fetch(`/api/scenarios/${scenario.id}/duplicate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to duplicate scenario.");
      toast.success(`Duplicated as "${json.data.scenario.name}"`);
      fetchData();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  };

  const handleArchiveScenario = async (scenario: ScenarioRecord) => {
    if (!confirm(`Are you sure you want to archive scenario "${scenario.name}"?`)) return;
    try {
      const res = await fetch(`/api/scenarios/${scenario.id}/archive`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to archive scenario.");
      toast.success(`Archived "${scenario.name}"`);
      fetchData();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  };

  // Template select action
  const handleSelectTemplate = (template: PersonaTemplate) => {
    setEditingPersona(null);
    setWizardTemplate(template);
    setWizardOpen(true);
  };

  // Filtered Personas
  const filteredPersonas = personas.filter((p) => {
    if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        p.config.personality.traits.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Filtered Scenarios
  const filteredScenarios = scenarios.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (priorityFilter !== "all" && s.priority !== priorityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  if (loadingProjects) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Virtual Customer Studio"
          description="Design and organize realistic virtual customers to test your voice AI agents."
        />
        <EmptyState
          title="No Projects Found"
          description="You need at least one project to create and store virtual customers and test scenarios."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Virtual Customer Studio"
        description="Design realistic simulated customer personas and define measurable test scenarios for your voice agents."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData} disabled={loadingData}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingData ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleOpenCreateWizard}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create Virtual Customer
            </Button>
          </div>
        }
      />

      {/* Project Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-muted" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Project:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-8 rounded-md border border-border bg-surface px-3 text-xs font-medium text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
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
            onClick={() => setActiveTab("personas")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
              activeTab === "personas"
                ? "bg-surface text-accent shadow-xs font-semibold"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Virtual Customers ({personas.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scenarios")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
              activeTab === "scenarios"
                ? "bg-surface text-accent shadow-xs font-semibold"
                : "text-muted hover:text-foreground"
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Test Scenarios ({scenarios.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
              activeTab === "templates"
                ? "bg-surface text-accent shadow-xs font-semibold"
                : "text-muted hover:text-foreground"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Template Library
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 text-center sm:text-left">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Total Customers</span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">{stats.total}</p>
        </Card>
        <Card className="p-4 text-center sm:text-left">
          <span className="text-xs font-semibold uppercase tracking-wider text-success">Ready for Testing</span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-success font-mono">{stats.ready}</p>
        </Card>
        <Card className="p-4 text-center sm:text-left">
          <span className="text-xs font-semibold uppercase tracking-wider text-warning">Needs Configuration</span>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.draft + stats.needsConfig}
          </p>
        </Card>
        <Card className="p-3.5 text-center sm:text-left">
          <span className="text-xs text-muted-foreground">Test Scenarios</span>
          <p className="mt-1 text-2xl font-bold text-foreground">{scenarios.length}</p>
        </Card>
      </div>

      {error && (
        <ErrorState title="Failed to load studio data" message={error}>
          <Button variant="secondary" size="sm" onClick={fetchData}>
            Retry
          </Button>
        </ErrorState>
      )}

      {/* TAB 1: PERSONAS */}
      {activeTab === "personas" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customers by name, traits..."
                className="pl-8 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">All Categories</option>
                <option value="customer_experience">Customer Experience</option>
                <option value="pricing_policies">Pricing & Policies</option>
                <option value="communication">Communication</option>
                <option value="support">Support</option>
                <option value="custom">Custom</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">All Statuses</option>
                <option value="ready_for_testing">Ready for Testing</option>
                <option value="needs_configuration">Needs Configuration</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          {/* Persona List / Grid */}
          {filteredPersonas.length === 0 ? (
            <EmptyState
              title={personas.length === 0 ? "No Virtual Customers Yet" : "No Matching Virtual Customers"}
              description={
                personas.length === 0
                  ? "Create your first virtual customer from scratch, describe one with AI, or pick from our curated template library."
                  : "Try clearing your filters or changing your search terms."
              }
            >
              {personas.length === 0 && (
                <Button onClick={handleOpenCreateWizard}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create Virtual Customer
                </Button>
              )}
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPersonas.map((persona) => {
                const scCount = scenarios.filter((s) => s.personaId === persona.id).length;
                return (
                  <PersonaCard
                    key={persona.id}
                    persona={persona}
                    scenarioCount={scCount}
                    onPreview={handlePreviewPersona}
                    onEdit={handleEditPersona}
                    onDuplicate={handleDuplicatePersona}
                    onArchive={handleArchivePersona}
                    onCreateScenario={handleCreateScenario}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SCENARIOS */}
      {activeTab === "scenarios" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scenarios..."
                className="pl-8 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <Button
                size="sm"
                onClick={() => handleCreateScenario()}
                disabled={personas.length === 0}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Scenario
              </Button>
            </div>
          </div>

          {filteredScenarios.length === 0 ? (
            <EmptyState
              title={scenarios.length === 0 ? "No Test Scenarios Yet" : "No Matching Scenarios"}
              description={
                personas.length === 0
                  ? "Create at least one virtual customer before defining test scenarios."
                  : scenarios.length === 0
                  ? "Define structured test scenarios specifying what your virtual customer will attempt and how success will be measured."
                  : "Try clearing your search query or priority filter."
              }
            >
              {personas.length > 0 && scenarios.length === 0 && (
                <Button onClick={() => handleCreateScenario()}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create First Scenario
                </Button>
              )}
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredScenarios.map((scenario) => {
                const persona = personas.find((p) => p.id === scenario.personaId);
                const agent = agents.find((a) => a.id === scenario.targetAgentId);
                return (
                  <ScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    persona={persona}
                    agentName={agent?.name}
                    onEdit={handleEditScenario}
                    onDuplicate={handleDuplicateScenario}
                    onArchive={handleArchiveScenario}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TEMPLATES */}
      {activeTab === "templates" && (
        <TemplateLibrary onSelectTemplate={handleSelectTemplate} />
      )}

      {/* Modals and Drawers */}
      <PersonaWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        projectId={selectedProjectId}
        initialPersona={editingPersona}
        initialTemplate={wizardTemplate}
        onSuccess={() => fetchData()}
      />

      <PersonaPreviewModal
        persona={previewPersona}
        scenarioCount={
          previewPersona ? scenarios.filter((s) => s.personaId === previewPersona.id).length : 0
        }
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onEdit={(p) => handleEditPersona(p)}
        onCreateScenario={(p) => handleCreateScenario(p)}
      />

      <ScenarioDialog
        open={scenarioDialogOpen}
        onOpenChange={setScenarioDialogOpen}
        projectId={selectedProjectId}
        personas={personas}
        agents={agents}
        initialScenario={editingScenario}
        preselectedPersonaId={preselectedPersonaId}
        onSuccess={() => fetchData()}
      />
    </div>
  );
}
