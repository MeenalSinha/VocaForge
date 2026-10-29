import { ok, readJson, route } from "@/server/http/respond";
import { generatePersonaConfig } from "@/server/personas/generation";
import type { PersonaCategory } from "@/server/personas/schema";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const body = (await readJson(req)) as {
    prompt: string;
    category?: PersonaCategory;
    templateId?: string;
  };
  const result = await generatePersonaConfig(body);
  return ok(result);
});
