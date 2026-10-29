import { ok, route } from "@/server/http/respond";
import { PERSONA_TEMPLATES } from "@/server/personas/templates";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  return ok(PERSONA_TEMPLATES);
});

