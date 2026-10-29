import { ok, readJson, route } from "@/server/http/respond";
import { runPreflightCheck } from "@/server/simulations/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const body = await readJson(req);
  const result = await runPreflightCheck(body);
  return ok(result);
});
