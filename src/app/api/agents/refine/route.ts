import { ok, readJson, route } from "@/server/http/respond";
import { proposeRefinement } from "@/server/generation/service";

export const dynamic = "force-dynamic";
export const POST = route(async (req: Request) => ok(await proposeRefinement((await readJson(req)) as { config: unknown; instruction: string })));
