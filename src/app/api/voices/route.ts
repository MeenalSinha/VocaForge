import { ok, route } from "@/server/http/respond";
import { listVoices } from "@/server/agents/voices";

export const dynamic = "force-dynamic";
export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  return ok(await listVoices({ search: p.get("search") ?? undefined, language: p.get("language") ?? undefined, category: p.get("category") ?? undefined, pageToken: p.get("pageToken") ?? undefined }));
});
