import { ok, route } from "@/server/http/respond";
import { getFindingsForRun } from "@/server/analysis/service";

export const dynamic = "force-dynamic";

export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const findings = await getFindingsForRun(id);
  return ok(findings);
});

