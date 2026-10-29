import { ok, readJson, route } from "@/server/http/respond";
import {
  buildAndStoreComparison,
  getComparisonForRun,
} from "@/server/analysis/service";
import { ValidationError } from "@/server/errors";

export const dynamic = "force-dynamic";

export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const comparison = await getComparisonForRun(id);
  return ok(comparison);
});

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = (await readJson(req)) as {
    proposalId?: string;
    originalRunId?: string;
    retestRunId?: string;
  };

  const proposalId = body.proposalId;
  const originalRunId = body.originalRunId || id;
  const retestRunId = body.retestRunId;

  if (!proposalId || !originalRunId || !retestRunId) {
    throw new ValidationError("Missing required parameters for comparison.", {
      comparison: ["proposalId, originalRunId, and retestRunId are required."],
    });
  }

  const comparison = await buildAndStoreComparison(proposalId, originalRunId, retestRunId);
  return ok(comparison, 201);
});

