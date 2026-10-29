import type { Metadata } from "next";
import { AgentBuilder } from "@/components/agents/agent-builder";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/ui/feedback";
import { STARTERS } from "@/server/agents/starters";
import { loadConfig } from "@/server/config/env";
import { isAppError } from "@/server/errors";
import { listProjects } from "@/server/projects/service";

export const metadata: Metadata = { title: "New agent" };
export const dynamic = "force-dynamic";

export default async function NewAgentPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const sp = await searchParams;
  const config = loadConfig();
  let projects: { id: string; name: string }[] = [];
  try {
    projects = (await listProjects({ status: "active", limit: 100 })).items.map((p) => ({ id: p.id, name: p.name }));
  } catch (err) {
    return <ErrorState title="Projects are unavailable" message={isAppError(err) ? err.message : "Projects could not be loaded."} />;
  }
  return (
    <>
      <PageHeader title="New agent" description="Describe the voice assistant you need in your own words. VocaForge turns it into a configuration you can review, then creates the agent in ElevenLabs." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Agents", href: "/agents" }, { label: "New agent" }]} />
      <AgentBuilder projects={projects} starters={STARTERS} promptMax={config.generation.promptMaxChars} generationReady={config.generation.configured} elevenlabsReady={config.elevenlabs.configured} defaultProjectId={sp.project} />
    </>
  );
}
