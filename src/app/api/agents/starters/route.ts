import { ok, route } from "@/server/http/respond";
import { STARTERS } from "@/server/agents/starters";

export const GET = route(async () => ok(STARTERS));
