import { ok, readJson, route } from "@/server/http/respond";
import { rejectFixProposal } from "@/server/analysis/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = (await readJson(req).catch(() => ({}))) as { reason?: string };
  const proposal = await rejectFixProposal(id, body.reason);
  return ok(proposal);
});

