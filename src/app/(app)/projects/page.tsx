import { FolderKanban, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/form";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { isAppError } from "@/server/errors";
import { logger, serializeError } from "@/server/logger";
import { listProjects } from "@/server/projects/service";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; status?: string; new?: string }>;

export default async function ProjectsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filtered = Boolean(sp.q) || (sp.status && sp.status !== "active");

  let result: Awaited<ReturnType<typeof listProjects>> | null = null;
  let error: string | null = null;
  try {
    result = await listProjects({ q: sp.q, status: sp.status });
  } catch (err) {
    if (!isAppError(err)) logger.error("projects page failed", { err: serializeError(err) });
    error = isAppError(err) ? err.message : "Projects could not be loaded.";
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description="A project groups the agents, virtual customers, scenarios and test runs for one thing you are building."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Projects" }]}
        actions={<CreateProjectDialog defaultOpen={sp.new === "1"} />}
      />

      <form method="get" role="search" className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="mb-1.5 block text-sm font-medium">Search</label>
          <Input id="q" name="q" type="search" defaultValue={sp.q ?? ""} placeholder="Search by name or description" />
        </div>
        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm font-medium">Status</label>
          <Select id="status" name="status" defaultValue={sp.status ?? "active"}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </Select>
        </div>
        <Button type="submit" variant="secondary"><Search className="h-4 w-4" aria-hidden />Apply</Button>
        {filtered && <Button asChild variant="ghost"><Link href="/projects">Clear</Link></Button>}
      </form>

      {error ? (
        <ErrorState title="Projects are unavailable" message={error}>
          <Button asChild variant="secondary"><Link href="/projects">Retry</Link></Button>
        </ErrorState>
      ) : result && result.items.length === 0 ? (
        filtered ? (
          <EmptyState icon={Search} title="No projects match" description="Try a different search term or status filter." />
        ) : (
          <EmptyState icon={FolderKanban} title="No projects yet" description="Create your first project to start organising agents and tests." />
        )
      ) : (
        result && (
          <>
            <Table aria-label="Projects">
              <thead><tr><Th>Name</Th><Th>Description</Th><Th>Status</Th><Th>Last updated</Th></tr></thead>
              <tbody>
                {result.items.map((p) => (
                  <tr key={p.id}>
                    <Td className="font-medium"><Link href={`/projects/${p.id}`} className="rounded text-accent hover:underline">{p.name}</Link></Td>
                    <Td className="max-w-md text-muted"><span className="line-clamp-2">{p.description ?? "No description"}</span></Td>
                    <Td><Badge tone={p.status === "active" ? "success" : "neutral"}>{p.status === "active" ? "Active" : "Archived"}</Badge></Td>
                    <Td className="whitespace-nowrap text-muted"><time dateTime={p.updatedAt}>{formatDateTime(p.updatedAt)}</time></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="mt-2 text-xs text-muted">Showing {result.items.length} of {result.total}.</p>
          </>
        )
      )}
    </>
  );
}
