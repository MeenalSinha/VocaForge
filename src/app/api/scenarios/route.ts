import { ok, readJson, route } from "@/server/http/respond";
import { createScenario, listScenarios } from "@/server/personas/service";
import type { ScenarioPriority, ScenarioStatus } from "@/server/personas/schema";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const list = await listScenarios({
    projectId: p.get("projectId") ?? undefined,
    personaId: p.get("personaId") ?? undefined,
    targetAgentId: p.get("targetAgentId") ?? undefined,
    status: (p.get("status") as ScenarioStatus) ?? undefined,
    priority: (p.get("priority") as ScenarioPriority) ?? undefined,
    search: p.get("search") ?? undefined,
    includeArchived: p.get("includeArchived") === "true",
  });
  return ok(list);
});

export const POST = route(async (req: Request) => {
  const body = await readJson(req);
  const created = await createScenario(body);
  return ok(created, 201);
});

