import { ok, route } from "@/server/http/respond";
import { archiveProject } from "@/server/projects/service";

export const dynamic = "force-dynamic";
export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) =>
  ok(await archiveProject((await params).id)),
);
