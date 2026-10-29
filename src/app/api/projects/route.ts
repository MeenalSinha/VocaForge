import { ok, readJson, route } from "@/server/http/respond";
import { createProject, listProjects } from "@/server/projects/service";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return ok(await listProjects(params));
});

export const POST = route(async (req: Request) => ok(await createProject(await readJson(req)), 201));
