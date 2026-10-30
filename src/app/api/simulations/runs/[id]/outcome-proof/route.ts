import { ok, route } from "@/server/http/respond";
import { getOutcomeProofForRun } from "@/server/analysis/service";

export const dynamic = "force-dynamic";

export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const proof = await getOutcomeProofForRun(id);
  return ok({ proof });
});
