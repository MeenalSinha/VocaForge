import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveTest } from "@/components/agents/live-test";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { getAgentDetail } from "@/server/agents/service";
import { NotFoundError, isAppError } from "@/server/errors";

export const metadata: Metadata = { title: "Live test" };
export const dynamic = "force-dynamic";

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let agent;
  try {
    agent = (await getAgentDetail(id)).agent;
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    return <ErrorState title="Agent is unavailable" message={isAppError(err) ? err.message : "The agent could not be loaded."} />;
  }
  return (
    <>
      <PageHeader title={`Talk to ${agent.name}`} description="A real voice conversation with the saved agent in ElevenLabs." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Agents", href: "/agents" }, { label: agent.name, href: `/agents/${agent.id}` }, { label: "Live test" }]} />
      {agent.status !== "active" ? (
        <Alert tone="warning" title="This agent cannot be tested">Its status is {agent.status.replace("_", " ")}. <Button asChild variant="secondary" size="sm"><Link href={`/agents/${agent.id}`}>Back to the agent</Link></Button></Alert>
      ) : (
        <LiveTest agentId={agent.id} agentName={agent.name} />
      )}
    </>
  );
}
