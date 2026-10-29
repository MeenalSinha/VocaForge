import { ok, route } from "@/server/http/respond";
import { pollSimulationBatch } from "@/server/simulations/service";

export const dynamic = "force-dynamic";

export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const result = await pollSimulationBatch(id);
  return ok(result);
});
