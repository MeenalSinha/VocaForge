import { ok, readJson, route } from "@/server/http/respond";
import { applyFixProposal } from "@/server/analysis/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = (await readJson(req).catch(() => ({}))) as { reconcileStale?: boolean };
  const result = await applyFixProposal(id, { reconcileStale: body.reconcileStale });
  return ok(result);
});

