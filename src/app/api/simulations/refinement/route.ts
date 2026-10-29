import { ok, route } from "@/server/http/respond";
import { getRefinementDataForProject } from "@/server/analysis/service";
import { ValidationError } from "@/server/errors";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    throw new ValidationError("projectId query parameter is required.");
  }

  const data = await getRefinementDataForProject(projectId);
  return ok(data);
});
