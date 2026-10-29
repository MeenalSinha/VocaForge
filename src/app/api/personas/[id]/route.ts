import { ok, readJson, route } from "@/server/http/respond";
import { deletePersona, getPersona, updatePersona } from "@/server/personas/service";

export const dynamic = "force-dynamic";

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  return ok(await getPersona(id));
});

export const PUT = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = await readJson(req);
  return ok(await updatePersona(id, body));
});

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  return ok(await deletePersona(id));
});

