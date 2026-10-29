import { ok, route } from "@/server/http/respond";
import { listOpenOperations } from "@/server/agents/service";

export const dynamic = "force-dynamic";
export const GET = route(async () => ok(await listOpenOperations()));
