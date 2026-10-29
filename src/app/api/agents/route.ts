import { ok, readJson, route } from "@/server/http/respond";
import { createAgent, listAgents } from "@/server/agents/service";

export const dynamic = "force-dynamic";
export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  return ok(await listAgents({ projectId: p.get("projectId") ?? undefined, status: p.get("status") ?? undefined }));
});
export const POST = route(async (req: Request) => {
  const r = await createAgent(await readJson(req));
  return ok(r, r.replayed ? 200 : 201);
});
