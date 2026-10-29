import { ok, readJson, route } from "@/server/http/respond";
import { analyzeRun } from "@/server/analysis/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = (await readJson(req).catch(() => ({}))) as { forceRegenerate?: boolean };
  const findings = await analyzeRun(id, { forceRegenerate: body.forceRegenerate });
  return ok(findings);
});

