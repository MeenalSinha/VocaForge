import { Activity, FolderKanban, FolderPlus, Plug } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, EmptyState } from "@/components/ui/feedback";
import { IntegrationStatusBadge } from "@/components/ui/status";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateTime } from "@/lib/utils";
import { isAppError } from "@/server/errors";
import { logger, serializeError } from "@/server/logger";
import { checkElevenLabs } from "@/server/integrations/elevenlabs";
import { getDashboardData } from "@/server/projects/service";

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

export default async function DashboardPage() {
  const [workspace, eleven] = await Promise.all([load(), checkElevenLabs()]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="VocaForge sends virtual customers to your voice agent, finds where it breaks, and helps you fix it before real callers do."
        actions={
          <Button asChild>
            <Link href="/projects?new=1"><FolderPlus className="h-4 w-4" aria-hidden />New project</Link>
          </Button>
        }
      />

      {!workspace.ok && (
        <div className="mb-6">
          <ErrorState title="Workspace data is unavailable" message={workspace.message}>
            <Button asChild variant="secondary"><Link href="/settings">Open settings</Link></Button>
          </ErrorState>
        </div>
      )}

      <section aria-label="Workspace overview" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardBody>
          <p className="text-xs text-muted">Active projects</p>
          <p className="mt-1 text-2xl font-semibold" data-testid="active-projects">{workspace.ok ? workspace.data.counts.active : "Unavailable"}</p>
        </CardBody></Card>
        <Card><CardBody>
          <p className="text-xs text-muted">Agents</p>
          <p className="mt-1 text-2xl font-semibold" data-testid="agent-count">{workspace.ok ? workspace.data.agents : "Unavailable"}</p>
        </CardBody></Card>
        <Card><CardBody>
          <p className="text-xs text-muted">Archived projects</p>
          <p className="mt-1 text-2xl font-semibold">{workspace.ok ? workspace.data.counts.archived : "Unavailable"}</p>
        </CardBody></Card>
        <Card><CardBody>
          <p className="text-xs text-muted">Test runs and success rate</p>
          <p className="mt-1 text-lg font-semibold text-muted">Not available yet</p>
          <p className="mt-0.5 text-xs text-muted">Calculated from recorded runs once the Test Lab exists (Phase 4).</p>
        </CardBody></Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader><CardTitle>Recent activity</CardTitle><Activity className="h-4 w-4 text-muted" aria-hidden /></CardHeader>
          <CardBody>
            {!workspace.ok ? (
              <p className="text-sm text-muted">Activity cannot be shown while the database is unavailable.</p>
            ) : workspace.data.activity.length === 0 ? (
              <EmptyState icon={FolderKanban} title="No activity yet" description="Creating or editing a project will show up here.">
                <Button asChild><Link href="/projects?new=1">Create a project</Link></Button>
              </EmptyState>
            ) : (
              <ul className="divide-y">
                {workspace.data.activity.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-4 py-2.5">
                    <span>{a.summary}</span>
                    <time dateTime={a.createdAt} className="shrink-0 text-xs text-muted">{formatDateTime(a.createdAt)}</time>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Integration health</CardTitle><Plug className="h-4 w-4 text-muted" aria-hidden /></CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between"><span>Database</span>
                {workspace.ok ? <Badge tone="success">Connected</Badge> : <Badge tone="danger">Unavailable</Badge>}
              </div>
              <div className="flex items-center justify-between"><span>ElevenLabs</span><IntegrationStatusBadge state={eleven.state} /></div>
              <p className="text-xs text-muted">{eleven.message}</p>
              <Button asChild variant="secondary" size="sm"><Link href="/settings">Open integration settings</Link></Button>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Quick actions</CardTitle></CardHeader>
            <CardBody className="flex flex-col gap-2">
              <Button asChild><Link href="/agents/new">Create an agent</Link></Button>
              <Button asChild variant="secondary"><Link href="/projects?new=1">Create a project</Link></Button>
              <Button asChild variant="secondary"><Link href="/settings">Check ElevenLabs connection</Link></Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
