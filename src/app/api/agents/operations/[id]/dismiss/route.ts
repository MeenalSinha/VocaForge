import { ok, route } from "@/server/http/respond";
import { dismissOperation } from "@/server/agents/service";

export const dynamic = "force-dynamic";
export const POST = route(async (_r: Request, { params }: { params: Promise<{ id: string }> }) => {
  await dismissOperation((await params).id);
  return ok({ dismissed: true });
});
