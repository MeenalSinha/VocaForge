import { ok, readJson, route } from "@/server/http/respond";
import { generateAgentConfig } from "@/server/generation/service";

export const dynamic = "force-dynamic";
export const POST = route(async (req: Request) => ok(await generateAgentConfig((await readJson(req)) as { prompt: string; useCase?: string })));
