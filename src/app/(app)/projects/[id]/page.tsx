import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectEditForm } from "@/components/projects/project-edit-form";
import { ProjectLifecycleButton } from "@/components/projects/project-lifecycle-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/utils";
import { NotFoundError, isAppError } from "@/server/errors";
import { logger, serializeError } from "@/server/logger";
import { getProject } from "@/server/projects/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let project;
  try {
    project = await getProject(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    if (!isAppError(err)) logger.error("project page failed", { err: serializeError(err) });
    return (
      <ErrorState title="Project is unavailable" message={isAppError(err) ? err.message : "The project could not be loaded."}>
        <Button asChild variant="secondary"><Link href="/projects">Back to projects</Link></Button>
      </ErrorState>
    );
  }

  return (
    <>
      <PageHeader
        title={project.name}
        description={project.description ?? "No description yet."}
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Projects", href: "/projects" }, { label: project.name }]}
        actions={
          <>
            <Badge tone={project.status === "active" ? "success" : "neutral"}>{project.status === "active" ? "Active" : "Archived"}</Badge>
            <ProjectLifecycleButton id={project.id} name={project.name} status={project.status} />
          </>
        }
      />
      {project.status === "archived" && (
        <Alert tone="warning" className="mb-4" title="This project is archived">Restore it to make it active again. Archiving never deletes data.</Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardBody><ProjectEditForm project={project} /></CardBody>
        </Card>
        <Card className="self-start">
          <CardHeader><CardTitle>Record</CardTitle></CardHeader>
          <CardBody>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-xs text-muted">Created</dt><dd><time dateTime={project.createdAt}>{formatDateTime(project.createdAt)}</time></dd></div>
              <div><dt className="text-xs text-muted">Last updated</dt><dd><time dateTime={project.updatedAt}>{formatDateTime(project.updatedAt)}</time></dd></div>
              <div><dt className="text-xs text-muted">Identifier</dt><dd className="break-all font-mono text-xs">{project.id}</dd></div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
