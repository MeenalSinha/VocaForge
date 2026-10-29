import { ok, readJson, route } from "@/server/http/respond";
import {
  createDeploymentInputSchema,
  type DeploymentEnvironment,
} from "@/server/deployments/schema";
import { createDeployment, listDeployments } from "@/server/deployments/service";
import { ValidationError } from "@/server/errors";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const projectId = p.get("projectId");
  const environment = (p.get("environment") as DeploymentEnvironment) || undefined;

  if (!projectId) {
    throw new ValidationError("projectId query parameter is required.");
  }

  const deployments = await listDeployments(projectId, environment);
  return ok({ deployments });
});

export const POST = route(async (req: Request) => {
  const body = await readJson(req);
  const parsed = createDeploymentInputSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError("Invalid deployment input.", parsed.error.flatten().fieldErrors);
  }

  const deployment = await createDeployment(parsed.data);
  return ok({ deployment }, 201);
});
