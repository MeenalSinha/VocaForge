import { ok, readJson, route } from "@/server/http/respond";
import {
  listSimulationBatches,
  startSimulationBatch,
} from "@/server/simulations/service";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const batches = await listSimulationBatches({
    projectId: p.get("projectId") ?? undefined,
    targetAgentId: p.get("targetAgentId") ?? undefined,
    status: p.get("status") ?? undefined,
    limit: p.get("limit") ? Number(p.get("limit")) : undefined,
  });
  return ok(batches);
});

export const POST = route(async (req: Request) => {
  const body = await readJson(req);
  const result = await startSimulationBatch(body);
  return ok(result, 201);
});
