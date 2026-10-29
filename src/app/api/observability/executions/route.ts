import { ok, route } from "@/server/http/respond";
import { getExecutionHistory } from "@/server/observability/service";
import type { RunStatus } from "@/server/simulations/schema";
import { ValidationError } from "@/server/errors";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const agentId = searchParams.get("agentId") || undefined;
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  if (!projectId) {
    throw new ValidationError("projectId query parameter is required.");
  }

  const executions = await getExecutionHistory(projectId, {
    agentId,
    status: (status as RunStatus) || undefined,
    search,
    limit,
  });

  return ok({ executions });
});
