import { ok, route } from "@/server/http/respond";
import { pollSimulationBatch } from "@/server/simulations/service";
import { analyzeRun } from "@/server/analysis/service";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const result = await pollSimulationBatch(id);

  if (result.isSettled && result.runs) {
    for (const r of result.runs) {
      if (r.status === "failed_evaluation" || r.evaluationResult === "failed") {
        analyzeRun(r.id).catch((err: Error) => {
          logger.warn("Auto-analysis in poll route encountered error", {
            runId: r.id,
            error: err.message,
          });
        });
      }
    }
  }

  return ok(result);
});
