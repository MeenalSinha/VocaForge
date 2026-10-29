import { ok, route } from "@/server/http/respond";
import { rerunSimulationRun } from "@/server/simulations/service";

export const dynamic = "force-dynamic";

export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const result = await rerunSimulationRun(id);
  return ok(result, 201);
});
