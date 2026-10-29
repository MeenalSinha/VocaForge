import { ok, route } from "@/server/http/respond";
import { getPersonaStats } from "@/server/personas/service";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const projectId = p.get("projectId") || undefined;
  return ok(await getPersonaStats(projectId));
});

