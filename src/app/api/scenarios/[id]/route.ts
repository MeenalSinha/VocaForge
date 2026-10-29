import { ok, readJson, route } from "@/server/http/respond";
import { deleteScenario, getScenario, updateScenario } from "@/server/personas/service";

export const dynamic = "force-dynamic";

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  return ok(await getScenario(id));
});

export const PUT = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = await readJson(req);
  return ok(await updateScenario(id, body));
});

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  return ok(await deleteScenario(id));
});

