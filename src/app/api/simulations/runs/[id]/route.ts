import { ok, route } from "@/server/http/respond";
import { getSimulationRun } from "@/server/simulations/service";

export const dynamic = "force-dynamic";

export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const result = await getSimulationRun(id);
  return ok(result);
});
