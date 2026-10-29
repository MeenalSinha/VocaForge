import { Bot, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OperationActions } from "@/components/agents/operation-actions";
import { AgentStatusBadge, SyncBadge } from "@/components/agents/status-badges";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { listAgents, listOpenOperations } from "@/server/agents/service";
import { isAppError } from "@/server/errors";
import { logger, serializeError } from "@/server/logger";

export const metadata: Metadata = { title: "Agents" };
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
      <PageHeader title="Agents" description="Voice agents you created with VocaForge. Each one is a real agent in your ElevenLabs account." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Agents" }]} actions={<Button asChild><Link href="/agents/new"><Plus className="h-4 w-4" aria-hidden />New agent</Link></Button>} />

      {ops.length > 0 && (
        <Card className="mb-6 border-warning/40">
          <CardHeader><CardTitle>Needs attention</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-muted">These creation requests did not finish cleanly. VocaForge never retries them automatically, because that could create a duplicate agent.</p>
            <ul className="divide-y">
              {ops.map((o) => (
                <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">{o.config.identity.name} <Badge tone="warning">{o.status === "remote_created" ? "Created in ElevenLabs, not saved here" : o.status === "unknown" ? "Outcome unknown" : "In progress"}</Badge></p>
                    {o.remoteAgentId && <p className="font-mono text-xs text-muted">ElevenLabs id {o.remoteAgentId}</p>}
                    {o.errorMessage && <p className="text-muted">{o.errorMessage}</p>}
                    {o.status === "unknown" && <p className="text-muted">Check your ElevenLabs agent list. If an agent with this name exists, it was created. Then dismiss this note.</p>}
                  </div>
                  {o.status !== "pending" && <OperationActions id={o.id} status={o.status} />}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <form method="get" className="mb-4 flex items-end gap-2">
        <div><label htmlFor="status" className="mb-1.5 block text-sm font-medium">Show</label>
          <Select id="status" name="status" defaultValue={status}><option value="active">Active agents</option><option value="archived">Archived and deleted</option></Select></div>
        <Button type="submit" variant="secondary">Apply</Button>
      </form>

      {error ? <ErrorState title="Agents are unavailable" message={error}><Button asChild variant="secondary"><Link href="/agents">Retry</Link></Button></ErrorState>
        : agents.length === 0 ? (
          <EmptyState icon={Bot} title={status === "active" ? "No agents yet" : "Nothing archived"} description={status === "active" ? "Describe the assistant you need and VocaForge will create it in ElevenLabs." : "Archived and deleted agents appear here."}>
            {status === "active" && <Button asChild><Link href="/agents/new">Create your first agent</Link></Button>}
          </EmptyState>
        ) : (
          <Table aria-label="Agents">
            <thead><tr><Th>Name</Th><Th>Use case</Th><Th>Project</Th><Th>Voice</Th><Th>Status</Th><Th>Updated</Th></tr></thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}>
                  <Td className="font-medium"><Link href={`/agents/${a.id}`} className="rounded text-accent hover:underline">{a.name}</Link></Td>
                  <Td className="text-muted">{a.useCase?.replace(/-/g, " ") ?? "Not set"}</Td>
                  <Td><Link href={`/projects/${a.projectId}`} className="hover:underline">{a.projectName}</Link></Td>
                  <Td className="font-mono text-xs text-muted">{a.voiceId ?? "Default"}</Td>
                  <Td><div className="flex flex-col items-start gap-1"><AgentStatusBadge status={a.status} /><SyncBadge agent={a} /></div></Td>
                  <Td className="whitespace-nowrap text-muted"><time dateTime={a.updatedAt}>{formatDateTime(a.updatedAt)}</time></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      {error === null && <Alert className="mt-6" title="Status shown here is stored in VocaForge">Use &ldquo;Refresh remote status&rdquo; on an agent to check ElevenLabs directly.</Alert>}
    </>
  );
}
