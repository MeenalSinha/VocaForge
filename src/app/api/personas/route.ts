import { ok, readJson, route } from "@/server/http/respond";
import { createPersona, listPersonas } from "@/server/personas/service";
import type { PersonaCategory, PersonaStatus } from "@/server/personas/schema";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const list = await listPersonas({
    projectId: p.get("projectId") ?? undefined,
    category: (p.get("category") as PersonaCategory) ?? undefined,
    status: (p.get("status") as PersonaStatus) ?? undefined,
    search: p.get("search") ?? undefined,
    includeArchived: p.get("includeArchived") === "true",
  });
  return ok(list);
});

export const POST = route(async (req: Request) => {
  const body = await readJson(req);
  const created = await createPersona(body);
  return ok(created, 201);
});

