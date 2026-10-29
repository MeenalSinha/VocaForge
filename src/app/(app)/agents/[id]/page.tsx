import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentDetail } from "@/components/agents/agent-detail";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/utils";
import { getAgentDetail } from "@/server/agents/service";
import { NotFoundError, isAppError } from "@/server/errors";

export const metadata: Metadata = { title: "Agent" };
export const dynamic = "force-dynamic";

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let detail;
  try {
    detail = await getAgentDetail(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    return <ErrorState title="Agent is unavailable" message={isAppError(err) ? err.message : "The agent could not be loaded."}><Button asChild variant="secondary"><Link href="/agents">Back to agents</Link></Button></ErrorState>;
  }
  const { agent, versions } = detail;
  return (
    <>
      <PageHeader title={agent.name} description={agent.config.identity.description || agent.config.identity.role} breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Agents", href: "/agents" }, { label: agent.name }]} />
      <dl className="mb-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-xs text-muted">Project</dt><dd><Link className="hover:underline" href={`/projects/${agent.projectId}`}>{agent.projectName}</Link></dd></div>
        <div><dt className="text-xs text-muted">ElevenLabs agent id</dt><dd className="break-all font-mono text-xs">{agent.remoteAgentId}</dd></div>
        <div><dt className="text-xs text-muted">Created</dt><dd><time dateTime={agent.createdAt}>{formatDateTime(agent.createdAt)}</time></dd></div>
        <div><dt className="text-xs text-muted">Last remote check</dt><dd>{agent.remoteCheckedAt ? <time dateTime={agent.remoteCheckedAt}>{formatDateTime(agent.remoteCheckedAt)}</time> : "Never"}</dd></div>
      </dl>
      <AgentDetail key={`${agent.id}-${agent.configVersion}`} initialAgent={agent} initialVersions={versions} />
    </>
  );
}
