import { ok, route } from "@/server/http/respond";
import { archiveAgent } from "@/server/agents/service";

export const dynamic = "force-dynamic";
export const POST = route(async (_r: Request, { params }: { params: Promise<{ id: string }> }) => ok(await archiveAgent((await params).id)));
