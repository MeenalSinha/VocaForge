import { Bot, Plus, Volume2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OperationActions } from "@/components/agents/operation-actions";
import { AgentStatusBadge, SyncBadge } from "@/components/agents/status-badges";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import { formatDateTime } from "@/lib/utils";
import { listAgents, listOpenOperations } from "@/server/agents/service";
import { isAppError } from "@/server/errors";
import { logger, serializeError } from "@/server/logger";

export const metadata: Metadata = { title: "Voice Agents" };
export const dynamic = "force-dynamic";

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = sp.status === "archived" ? "archived" : "active";
  let agents: Awaited<ReturnType<typeof listAgents>> = [];
  let ops: Awaited<ReturnType<typeof listOpenOperations>> = [];
  let error: string | null = null;
  try {
    [agents, ops] = await Promise.all([listAgents({ status }), listOpenOperations()]);
  } catch (err) {
    if (!isAppError(err)) logger.error("agents page failed", { err: serializeError(err) });
    error = isAppError(err) ? err.message : "Agents could not be loaded.";
  }

  return (
    <>
      <PageHeader
        title="Conversational Voice Agents"
        description="Configure, test, version, and synchronize ElevenLabs voice AI agents. Manage prompts, voice models, stability, and human escalation workflows."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Agents" }]}
        actions={
          <Button asChild size="sm">
            <Link href="/agents/new">
              <Plus className="h-3.5 w-3.5 mr-1" aria-hidden />
              New Voice Agent
            </Link>
          </Button>
        }
      />

      {ops.length > 0 && (
        <Card className="mb-6 border-warning/60 bg-warning-soft/20 shadow-xs">
          <CardHeader>
            <CardTitle>Pending Operations Requiring Attention</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-xs text-muted leading-relaxed">
              These creation requests encountered transient remote responses. VocaForge preserves them safely without blind retries to prevent duplicate agent provisioning.
            </p>
            <ul className="divide-y divide-border/60">
              {ops.map((o) => (
                <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-foreground">
                      {o.config.identity.name}{" "}
                      <Badge tone="warning">
                        {o.status === "remote_created"
                          ? "Created in ElevenLabs, Pending Local Save"
                          : o.status === "unknown"
                          ? "Outcome Unknown"
                          : "In Progress"}
                      </Badge>
                    </p>
                    {o.remoteAgentId && <p className="font-mono text-xs text-muted">Remote ID: {o.remoteAgentId}</p>}
                    {o.errorMessage && <p className="text-xs text-muted">{o.errorMessage}</p>}
                  </div>
                  {o.status !== "pending" && <OperationActions id={o.id} status={o.status} />}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* Filter & View Toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/70 bg-surface p-4 shadow-xs">
        <form method="get" className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="status" className="text-xs font-semibold text-foreground/80">
              Filter:
            </label>
            <Select id="status" name="status" defaultValue={status} className="w-44 h-8 text-xs">
              <option value="active">Active Agents</option>
              <option value="archived">Archived Agents</option>
            </Select>
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Apply
          </Button>
        </form>

        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{agents.length} agent{agents.length === 1 ? "" : "s"} deployed</span>
        </div>
      </div>

      {error ? (
        <ErrorState title="Agents are unavailable" message={error}>
          <Button asChild variant="secondary">
            <Link href="/agents">Retry</Link>
          </Button>
        </ErrorState>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title={status === "active" ? "No voice agents created yet" : "No archived agents"}
          description={
            status === "active"
              ? "Describe your desired voice assistant in natural language, and VocaForge will synthesize its configuration and provision it in ElevenLabs."
              : "Archived voice agents appear here."
          }
        >
          {status === "active" && (
            <Button asChild size="sm">
              <Link href="/agents/new">Create First Voice Agent</Link>
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {/* Card Grid View for Voice Agents */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((a) => (
              <Card
                key={a.id}
                className="group flex flex-col justify-between hover:border-foreground/30 hover:shadow-hover transition-all duration-200 overflow-hidden"
              >
                <div className="p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-subtle flex items-center justify-center shrink-0 border border-border/80">
                        <Volume2 className="h-4 w-4 text-foreground/80" />
                      </div>
                      <div>
                        <Link
                          href={`/agents/${a.id}`}
                          className="font-semibold text-sm text-foreground group-hover:text-foreground hover:underline line-clamp-1"
                        >
                          {a.name}
                        </Link>
                        <p className="text-[11px] text-muted capitalize">
                          {a.useCase?.replace(/-/g, " ") ?? "General Voice"}
                        </p>
                      </div>
                    </div>
                    <AgentStatusBadge status={a.status} />
                  </div>

                  <div className="rounded-lg bg-subtle/50 p-2.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-muted">
                      <span>Project</span>
                      <Link
                        href={`/projects/${a.projectId}`}
                        className="text-foreground font-medium hover:underline truncate max-w-[140px]"
                      >
                        {a.projectName}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between text-muted">
                      <span>Voice Model</span>
                      <span className="font-mono text-[11px] text-foreground font-medium truncate max-w-[140px]">
                        {a.voiceId ?? "Default"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <SyncBadge agent={a} />
                    <span className="text-[10px] font-mono text-muted">
                      {formatDateTime(a.updatedAt)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-border/60 bg-subtle/30 px-5 py-2.5 flex items-center justify-between text-xs">
                  <Link
                    href={`/agents/${a.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    Configure Agent &rarr;
                  </Link>
                  <Link
                    href={`/agents/${a.id}?tab=test`}
                    className="text-[11px] text-muted hover:text-foreground font-medium flex items-center gap-1"
                  >
                    <Volume2 className="h-3 w-3" />
                    Test Call
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-muted px-1 pt-2">
            <span>
              Showing {agents.length} agent{agents.length === 1 ? "" : "s"}
            </span>
            <span className="italic">Use &ldquo;Live Voice Testing&rdquo; inside each agent to test bi-directional WebSocket audio.</span>
          </div>
        </div>
      )}
    </>
  );
}
