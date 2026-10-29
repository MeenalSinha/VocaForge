import { Bot, Plus } from "lucide-react";
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
import { Table, Td, Th } from "@/components/ui/table";
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
        description="Configure, version, and manage ElevenLabs voice AI agents with verified system prompts, voice models, and conversational parameters."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Agents" }]}
        actions={
          <Button asChild size="sm">
            <Link href="/agents/new">
              <Plus className="h-4 w-4" aria-hidden />
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

      {/* Filter Toolbar */}
      <div className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-xs">
        <form method="get" className="flex items-end gap-3">
          <div className="w-56">
            <label htmlFor="status" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
              Display Agents
            </label>
            <Select id="status" name="status" defaultValue={status}>
              <option value="active">Active Agents</option>
              <option value="archived">Archived & Deleted</option>
            </Select>
          </div>
          <Button type="submit" variant="secondary" size="md">
            Filter View
          </Button>
        </form>
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
        <div className="space-y-3">
          <Table aria-label="Agents">
            <thead>
              <tr>
                <Th className="w-1/4">Agent Name</Th>
                <Th className="w-32">Use Case</Th>
                <Th className="w-40">Project</Th>
                <Th className="w-32">Voice Model</Th>
                <Th className="w-48">Sync State</Th>
                <Th className="w-36">Last Updated</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {agents.map((a) => (
                <tr key={a.id} className="group hover:bg-subtle/40 transition-colors">
                  <Td className="font-medium">
                    <Link
                      href={`/agents/${a.id}`}
                      className="rounded font-semibold text-accent hover:underline focus:outline-none"
                    >
                      {a.name}
                    </Link>
                  </Td>
                  <Td className="text-xs text-muted capitalize">{a.useCase?.replace(/-/g, " ") ?? "General"}</Td>
                  <Td className="text-xs">
                    <Link href={`/projects/${a.projectId}`} className="text-foreground hover:underline font-medium">
                      {a.projectName}
                    </Link>
                  </Td>
                  <Td className="font-mono text-xs text-muted">{a.voiceId ?? "Default"}</Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <AgentStatusBadge status={a.status} />
                      <SyncBadge agent={a} />
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted font-mono">
                    <time dateTime={a.updatedAt}>{formatDateTime(a.updatedAt)}</time>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="flex items-center justify-between text-xs text-muted px-1">
            <span>
              Showing {agents.length} agent{agents.length === 1 ? "" : "s"}
            </span>
            <span className="italic">Use &ldquo;Refresh remote status&rdquo; inside agent details to verify ElevenLabs sync.</span>
          </div>
        </div>
      )}
    </>
  );
}
