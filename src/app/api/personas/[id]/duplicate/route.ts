import { ok, route } from "@/server/http/respond";
import { duplicatePersona } from "@/server/personas/service";

export const dynamic = "force-dynamic";

export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const duplicated = await duplicatePersona(id);
  return ok(duplicated, 201);
});

