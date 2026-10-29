import { ok, readJson, route } from "@/server/http/respond";
import { promoteDeployment } from "@/server/deployments/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  let notes: string | undefined;
  try {
    const body = (await readJson(req)) as { notes?: string };
    notes = body?.notes;
  } catch {
    // notes is optional
  }

  const deployment = await promoteDeployment(id, { notes });
  return ok({ deployment });
});
