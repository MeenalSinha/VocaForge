import { ok, route } from "@/server/http/respond";
import { getDeployment } from "@/server/deployments/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const deployment = await getDeployment(id);
  return ok({ deployment });
});
