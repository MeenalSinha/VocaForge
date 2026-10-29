import { ok, route } from "@/server/http/respond";
import { checkAgentReleaseReadiness } from "@/server/deployments/service";
import { ValidationError } from "@/server/errors";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    throw new ValidationError("agentId query parameter is required.");
  }

  const result = await checkAgentReleaseReadiness(agentId);
  return ok(result);
});
