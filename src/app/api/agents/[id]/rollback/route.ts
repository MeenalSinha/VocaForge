import { ok, readJson, route } from "@/server/http/respond";
import { rollbackAgent } from "@/server/deployments/service";
import { ValidationError } from "@/server/errors";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = (await readJson(req)) as { targetVersion?: unknown; reason?: unknown };

  if (typeof body?.targetVersion !== "number" || !Number.isInteger(body.targetVersion)) {
    throw new ValidationError("targetVersion must be an integer.");
  }

  const reason = typeof body?.reason === "string" ? body.reason : undefined;
  const result = await rollbackAgent(id, body.targetVersion, { reason });

  return ok(result);
});
