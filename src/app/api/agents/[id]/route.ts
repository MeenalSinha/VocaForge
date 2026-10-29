import { ok, readJson, route } from "@/server/http/respond";
import { getAgentDetail, saveAgentConfig } from "@/server/agents/service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export const GET = route(async (_r: Request, { params }: Ctx) => ok(await getAgentDetail((await params).id)));
export const PATCH = route(async (req: Request, { params }: Ctx) => ok(await saveAgentConfig((await params).id, await readJson(req))));
