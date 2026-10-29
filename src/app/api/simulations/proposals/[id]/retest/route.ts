import { ok, readJson, route } from "@/server/http/respond";
import { retestFixProposal } from "@/server/analysis/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = (await readJson(req).catch(() => ({}))) as { additionalScenarioIds?: string[] };
  const result = await retestFixProposal(id, body.additionalScenarioIds);
  return ok(result);
});
