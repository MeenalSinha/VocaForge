import { ok, readJson, route } from "@/server/http/respond";
import { getProject, updateProject } from "@/server/projects/service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => ok(await getProject((await params).id)));
export const PATCH = route(async (req: Request, { params }: Ctx) =>
  ok(await updateProject((await params).id, await readJson(req))),
);
