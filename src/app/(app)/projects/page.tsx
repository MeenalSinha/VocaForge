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
        title="Project Workspaces"
        description="Organize your voice AI agents, virtual customer personas, testing scenarios, and simulation history into focused workspaces."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Projects" }]}
        actions={<CreateProjectDialog defaultOpen={sp.new === "1"} />}
      />

      <div className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-xs">
        <form method="get" role="search" className="flex flex-wrap items-end gap-3">
          <div className="min-w-60 flex-1">
            <label htmlFor="q" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
              Search Projects
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted/60" aria-hidden />
              <Input
                id="q"
                name="q"
                type="search"
                defaultValue={sp.q ?? ""}
                placeholder="Search by project name or description..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-44">
            <label htmlFor="status" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
              Lifecycle Status
            </label>
            <Select id="status" name="status" defaultValue={sp.status ?? "active"}>
              <option value="active">Active Projects</option>
              <option value="archived">Archived Projects</option>
              <option value="all">All Projects</option>
            </Select>
          </div>
          <Button type="submit" variant="secondary" size="md">
            Apply Filter
          </Button>
          {filtered && (
            <Button asChild variant="ghost" size="md">
              <Link href="/projects">Reset</Link>
            </Button>
          )}
        </form>
      </div>

      {error ? (
        <ErrorState title="Projects are unavailable" message={error}>
          <Button asChild variant="secondary">
            <Link href="/projects">Retry</Link>
          </Button>
        </ErrorState>
      ) : result && result.items.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={Search}
            title="No projects match your filter"
            description="Try a different search term or change the status filter."
          >
            <Button asChild variant="secondary" size="sm">
              <Link href="/projects">Clear Search</Link>
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="No projects created yet"
            description="Create your first project workspace to start configuring voice agents and running simulations."
          >
            <CreateProjectDialog defaultOpen={false} />
          </EmptyState>
        )
      ) : (
        result && (
          <div className="space-y-3">
            <Table aria-label="Projects">
              <thead>
                <tr>
                  <Th className="w-1/4">Project Name</Th>
                  <Th className="w-1/2">Description</Th>
                  <Th className="w-32">Status</Th>
                  <Th className="w-44">Last Updated</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {result.items.map((p) => (
                  <tr key={p.id} className="group hover:bg-subtle/40 transition-colors">
                    <Td className="font-medium">
                      <Link
                        href={`/projects/${p.id}`}
                        className="rounded font-semibold text-accent hover:underline focus:outline-none"
                      >
                        {p.name}
                      </Link>
                    </Td>
                    <Td className="text-muted">
                      <span className="line-clamp-2 text-xs leading-relaxed">
                        {p.description || <span className="italic text-muted/60">No description provided</span>}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={p.status === "active" ? "success" : "neutral"}>
                        {p.status === "active" ? "Active" : "Archived"}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted font-mono">
                      <time dateTime={p.updatedAt}>{formatDateTime(p.updatedAt)}</time>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex items-center justify-between text-xs text-muted px-1">
              <span>
                Showing {result.items.length} of {result.total} project{result.total === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        )
      )}
    </>
  );
}
