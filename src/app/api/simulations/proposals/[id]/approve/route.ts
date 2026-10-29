import { ok, route } from "@/server/http/respond";
import { approveFixProposal } from "@/server/analysis/service";

export const dynamic = "force-dynamic";

export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const proposal = await approveFixProposal(id);
  return ok(proposal);
});

