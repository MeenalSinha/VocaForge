import { ok, readJson, route } from "@/server/http/respond";
import { deleteRemoteAgent } from "@/server/agents/service";

export const dynamic = "force-dynamic";
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const body = (await readJson(req)) as { confirmName?: string };
  return ok(await deleteRemoteAgent((await params).id, body.confirmName ?? ""));
});
