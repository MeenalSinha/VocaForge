import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  Cpu,
  FlaskConical,
  FolderKanban,
  FolderPlus,
  Layers,
  Plug,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateTime } from "@/lib/utils";
import { isAppError } from "@/server/errors";
import { logger, serializeError } from "@/server/logger";
import { checkElevenLabs } from "@/server/integrations/elevenlabs";
import { getDashboardData } from "@/server/projects/service";
import { getPool } from "@/server/db/pool";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

async function load() {
  try {
    return { ok: true as const, data: await getDashboardData() };
  } catch (err) {
    if (!isAppError(err)) logger.error("dashboard load failed", { err: serializeError(err) });
    return { ok: false as const, message: isAppError(err) ? err.message : "The workspace data could not be loaded." };
  }
}

async function getExtendedMetrics() {
  try {
    const pool = getPool();
    const [personasRes, runsRes, findingsRes] = await Promise.all([
      pool.query<{ n: string }>("SELECT count(*) AS n FROM personas WHERE status = 'active'"),
      pool.query<{ total: string; passed: string }>(
        "SELECT count(*) AS total, count(*) FILTER (WHERE evaluation_result = 'passed') AS passed FROM simulation_runs",
      ),
      pool.query<{ n: string }>("SELECT count(*) AS n FROM failure_findings"),
    ]);

    const totalRuns = Number(runsRes.rows[0]?.total ?? 0);
    const passedRuns = Number(runsRes.rows[0]?.passed ?? 0);
    const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 100;

    return {
      personas: Number(personasRes.rows[0]?.n ?? 0),
      totalRuns,
      passRate,
      findings: Number(findingsRes.rows[0]?.n ?? 0),
    };
  } catch {
    return { personas: 0, totalRuns: 0, passRate: 100, findings: 0 };
  }
}

export default async function DashboardPage() {
  const [workspace, eleven, metrics] = await Promise.all([load(), checkElevenLabs(), getExtendedMetrics()]);

  return (
    <>
      <PageHeader
        title="Quality Dashboard"
        description="Autonomous testing and closed-loop refinement platform for ElevenLabs conversational voice agents. Simulate adversarial callers, identify failures, and verify prompt fixes before production."
        actions={
          <div className="flex items-center gap-2.5">
            <Button asChild variant="secondary" size="sm">
              <Link href="/projects?new=1">
                <FolderPlus className="h-4 w-4" aria-hidden />
                New Project
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/test-lab">
                <FlaskConical className="h-4 w-4" aria-hidden />
                Launch Simulation
              </Link>
            </Button>
          </div>
        }
      />

      {!workspace.ok && (
        <div className="mb-6">
          <ErrorState title="Workspace data is unavailable" message={workspace.message}>
            <Button asChild variant="secondary">
              <Link href="/settings">Open settings</Link>
            </Button>
          </ErrorState>
        </div>
      )}

      {/* KPI Stats Ribbon */}
      <section aria-label="Workspace overview" className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:border-border transition-all">
          <CardBody className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Active Projects</span>
              <FolderKanban className="h-4 w-4 text-muted/70" />
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-foreground font-mono" data-testid="active-projects">
              {workspace.ok ? workspace.data.counts.active : "—"}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>{workspace.ok ? `${workspace.data.counts.archived} archived` : "—"}</span>
              <Link href="/projects" className="text-accent hover:underline flex items-center gap-0.5">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card className="hover:border-border transition-all">
          <CardBody className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Voice Agents</span>
              <Bot className="h-4 w-4 text-muted/70" />
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-foreground font-mono" data-testid="agent-count">
              {workspace.ok ? workspace.data.agents : "—"}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>ElevenLabs synced</span>
              <Link href="/agents" className="text-accent hover:underline flex items-center gap-0.5">
                Manage <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card className="hover:border-border transition-all">
          <CardBody className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Virtual Customers</span>
              <Users className="h-4 w-4 text-muted/70" />
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-foreground font-mono">
              {metrics.personas}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>Adversarial personas</span>
              <Link href="/virtual-customers" className="text-accent hover:underline flex items-center gap-0.5">
                Studio <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card className="hover:border-border transition-all">
          <CardBody className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Simulation Pass Rate</span>
              <BarChart3 className="h-4 w-4 text-muted/70" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-foreground font-mono">
                {metrics.totalRuns > 0 ? `${metrics.passRate}%` : "100%"}
              </span>
              <span className="text-xs text-muted font-mono">({metrics.totalRuns} runs)</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>{metrics.findings} open findings</span>
              <Link href="/results" className="text-accent hover:underline flex items-center gap-0.5">
                Results <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* Main Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left Column: Quick Actions & Recent Activity */}
        <div className="space-y-6">
          {/* Quick Workflow Action Banners */}
          <Card>
            <CardHeader>
              <CardTitle>Autonomous Testing Workflows</CardTitle>
              <Sparkles className="h-4 w-4 text-muted" aria-hidden />
            </CardHeader>
            <CardBody className="p-4 space-y-2.5">
              <Link
                href="/test-lab"
                className="group flex items-center justify-between p-3 rounded-md border border-border/60 hover:border-accent/50 hover:bg-subtle/50 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded bg-accent-soft text-accent">
                    <FlaskConical className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                      Run Adversarial Call Simulation
                    </p>
                    <p className="text-xs text-muted">
                      Deploy virtual customer personas against your ElevenLabs agent to uncover policy violations.
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-accent transition-colors shrink-0" />
              </Link>

              <Link
                href="/refinement"
                className="group flex items-center justify-between p-3 rounded-md border border-border/60 hover:border-accent/50 hover:bg-subtle/50 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded bg-warning-soft text-warning">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                      Review Failure Findings & AI Fixes
                    </p>
                    <p className="text-xs text-muted">
                      Inspect evidence citations, approve structured prompt diffs, and execute side-by-side retests.
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-accent transition-colors shrink-0" />
              </Link>

              <Link
                href="/deployments"
                className="group flex items-center justify-between p-3 rounded-md border border-border/60 hover:border-accent/50 hover:bg-subtle/50 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded bg-success-soft text-success">
                    <Rocket className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                      Release Readiness & Rollback Controls
                    </p>
                    <p className="text-xs text-muted">
                      Automated quality gates ensure only verified agents promote to staging or production.
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-accent transition-colors shrink-0" />
              </Link>
            </CardBody>
          </Card>

          {/* Activity Stream */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Project Activity</CardTitle>
              <Activity className="h-4 w-4 text-muted" aria-hidden />
            </CardHeader>
            <CardBody>
              {!workspace.ok ? (
                <p className="text-sm text-muted">Activity cannot be shown while the database is unavailable.</p>
              ) : workspace.data.activity.length === 0 ? (
                <EmptyState
                  icon={FolderKanban}
                  title="No activity recorded yet"
                  description="Actions taken on projects, agents, and test runs will stream here automatically."
                >
                  <Button asChild size="sm">
                    <Link href="/projects?new=1">Create First Project</Link>
                  </Button>
                </EmptyState>
              ) : (
                <ul className="divide-y divide-border/60">
                  {workspace.data.activity.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-1 h-2 w-2 rounded-full bg-accent shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{a.summary}</p>
                          <span className="text-[11px] font-mono text-muted uppercase tracking-wider">
                            {a.type}
                          </span>
                        </div>
                      </div>
                      <time dateTime={a.createdAt} className="shrink-0 text-xs text-muted font-mono">
                        {formatDateTime(a.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Engine Health & Architecture */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System & Engine Health</CardTitle>
              <Plug className="h-4 w-4 text-muted" aria-hidden />
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-3 divide-y divide-border/60 text-sm">
                <div className="flex items-center justify-between pb-2.5">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted" />
                    <span>PostgreSQL Database</span>
                  </div>
                  {workspace.ok ? (
                    <Badge tone="success">Connected</Badge>
                  ) : (
                    <Badge tone="danger">Unavailable</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-muted" />
                    <span>ElevenLabs Client</span>
                  </div>
                  {eleven.state === "connected" ? (
                    <Badge tone="success">Authenticated</Badge>
                  ) : (
                    <Badge tone="neutral">Fallback Mock Runner</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-muted" />
                    <span>Quality Gates</span>
                  </div>
                  <Badge tone="accent">Automated</Badge>
                </div>
              </div>

              <div className="rounded-md bg-subtle p-3 text-xs text-muted space-y-1">
                <p className="font-medium text-foreground">Local Mock & Cloud Mode</p>
                <p>
                  Full simulation, failure diagnosis, and prompt refinement run out of the box. Add your ElevenLabs key in Settings to sync live voice agents.
                </p>
              </div>

              <Button asChild variant="secondary" size="sm" className="w-full">
                <Link href="/settings">Configure Integrations</Link>
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quality Assurance Lifecycle</CardTitle>
              <Layers className="h-4 w-4 text-muted" aria-hidden />
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-accent text-[11px] font-bold">1</span>
                  <span>Agent Configuration (v1)</span>
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-accent text-[11px] font-bold">2</span>
                  <span>Virtual Customer Probing</span>
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-accent text-[11px] font-bold">3</span>
                  <span>Turn-Level Evidence Diagnosis</span>
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-accent text-[11px] font-bold">4</span>
                  <span>Autonomous AI Fix & Retest</span>
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-accent text-[11px] font-bold">5</span>
                  <span>Gated Production Promotion (v2)</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60">
                <Link href="/test-lab" className="text-xs text-accent hover:underline flex items-center justify-between">
                  <span>Enter Test Lab</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
