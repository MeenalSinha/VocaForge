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
import { VoiceOrb, LiveWaveform } from "@/components/ui/voice-orb";

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
        title="Voice Quality Workspace"
        description="Autonomous testing and closed-loop prompt engineering for ElevenLabs conversational voice agents. Simulate adversarial customer personas, diagnose policy failures, and verify prompt fixes before production rollout."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/projects?new=1">
                <FolderPlus className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                New Project
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/test-lab">
                <FlaskConical className="h-3.5 w-3.5 mr-1.5" aria-hidden />
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

      {/* ElevenLabs Interactive Studio Hero Banner */}
      <section className="mb-8 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-r from-surface via-surface to-subtle/40 p-6 md:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-subtle border border-border/80 px-3 py-1 text-xs font-medium text-foreground/80">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>ElevenLabs Voice Engine Active</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground font-sans">
              Test & refine conversational voice agents in real-time.
            </h2>
            <p className="text-xs md:text-sm text-muted leading-relaxed">
              VocaForge bridges voice synthesis and virtual customer simulations. Deploy realistic personas to test latency, policy guardrails, and human escalation before releasing.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button asChild size="md">
                <Link href="/agents/new">
                  <Bot className="h-4 w-4 mr-1.5" />
                  Create Voice Agent
                </Link>
              </Button>
              <Button asChild variant="secondary" size="md">
                <Link href="/virtual-customers">
                  <Users className="h-4 w-4 mr-1.5" />
                  Design Customer Persona
                </Link>
              </Button>
            </div>
          </div>

          {/* Interactive Voice Orb Feature Centerpiece */}
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-surface/80 border border-border/60 shadow-xs text-center space-y-3 min-w-[220px]">
            <VoiceOrb state="listening" size="md" />
            <div>
              <p className="text-xs font-semibold text-foreground">Interactive Audio Stage</p>
              <p className="text-[11px] text-muted">Ready for live voice testing</p>
            </div>
            <LiveWaveform active={true} barCount={18} />
          </div>
        </div>
      </section>

      {/* KPI Stats Ribbon */}
      <section aria-label="Workspace overview" className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:border-foreground/20 transition-all">
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
              <Link href="/projects" className="text-foreground hover:underline flex items-center gap-0.5 font-medium">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card className="hover:border-foreground/20 transition-all">
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
              <Link href="/agents" className="text-foreground hover:underline flex items-center gap-0.5 font-medium">
                Manage <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card className="hover:border-foreground/20 transition-all">
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
              <Link href="/virtual-customers" className="text-foreground hover:underline flex items-center gap-0.5 font-medium">
                Studio <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card className="hover:border-foreground/20 transition-all">
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
              <span className={metrics.findings > 0 ? "text-danger font-medium" : ""}>
                {metrics.findings} open finding{metrics.findings === 1 ? "" : "s"}
              </span>
              <Link href="/results" className="text-foreground hover:underline flex items-center gap-0.5 font-medium">
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
                className="group flex items-center justify-between p-3.5 rounded-xl border border-border/70 hover:border-foreground/30 hover:bg-subtle/50 transition-all"
              >
                <div className="flex items-start gap-3.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-background shrink-0">
                    <FlaskConical className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground transition-colors">
                      Run Adversarial Call Simulation
                    </p>
                    <p className="text-xs text-muted leading-relaxed">
                      Deploy virtual customer personas against your ElevenLabs agent to uncover policy violations.
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground transition-colors shrink-0" />
              </Link>

              <Link
                href="/refinement"
                className="group flex items-center justify-between p-3.5 rounded-xl border border-border/70 hover:border-foreground/30 hover:bg-subtle/50 transition-all"
              >
                <div className="flex items-start gap-3.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-warning-soft text-warning shrink-0 border border-warning/20">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground transition-colors">
                      Review Failure Findings & AI Fixes
                    </p>
                    <p className="text-xs text-muted leading-relaxed">
                      Inspect evidence citations, approve structured prompt diffs, and execute side-by-side retests.
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground transition-colors shrink-0" />
              </Link>

              <Link
                href="/deployments"
                className="group flex items-center justify-between p-3.5 rounded-xl border border-border/70 hover:border-foreground/30 hover:bg-subtle/50 transition-all"
              >
                <div className="flex items-start gap-3.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-success-soft text-success shrink-0 border border-success/20">
                    <Rocket className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground transition-colors">
                      Release Readiness & Rollback Controls
                    </p>
                    <p className="text-xs text-muted leading-relaxed">
                      Automated quality gates ensure only verified agents promote to staging or production.
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground transition-colors shrink-0" />
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
                <ul className="divide-y divide-border/50">
                  {workspace.data.activity.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-1 h-2 w-2 rounded-full bg-foreground shrink-0" />
                        <div>
                          <p className="text-xs md:text-sm font-medium text-foreground">{a.summary}</p>
                          <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
                            {a.type}
                          </span>
                        </div>
                      </div>
                      <time dateTime={a.createdAt} className="shrink-0 text-[11px] text-muted font-mono">
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
              <div className="space-y-3 divide-y divide-border/50 text-sm">
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
                  <Badge tone="neutral">Automated</Badge>
                </div>
              </div>

              <div className="rounded-xl bg-subtle p-3.5 text-xs text-muted space-y-1">
                <p className="font-semibold text-foreground">Local & Cloud Connected</p>
                <p className="leading-relaxed">
                  Full simulation, failure diagnosis, and prompt refinement run seamlessly. Add your ElevenLabs key in Settings to sync live voice agents.
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
                <div className="flex items-center gap-2.5 text-foreground font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background text-[10px] font-bold">1</span>
                  <span>Agent Configuration (v1)</span>
                </div>
                <div className="flex items-center gap-2.5 text-foreground font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background text-[10px] font-bold">2</span>
                  <span>Virtual Customer Probing</span>
                </div>
                <div className="flex items-center gap-2.5 text-foreground font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background text-[10px] font-bold">3</span>
                  <span>Turn-Level Evidence Diagnosis</span>
                </div>
                <div className="flex items-center gap-2.5 text-foreground font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background text-[10px] font-bold">4</span>
                  <span>Autonomous AI Fix & Retest</span>
                </div>
                <div className="flex items-center gap-2.5 text-foreground font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background text-[10px] font-bold">5</span>
                  <span>Gated Production Promotion (v2)</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border/50">
                <Link href="/test-lab" className="text-xs text-foreground font-medium hover:underline flex items-center justify-between">
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
