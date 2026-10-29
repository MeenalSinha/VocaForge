import { ok, route } from "@/server/http/respond";
import { getSimulationBatch } from "@/server/simulations/service";

export const dynamic = "force-dynamic";

export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const result = await getSimulationBatch(id);
  return ok(result);
});
