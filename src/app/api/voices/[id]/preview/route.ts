import { readJson, route } from "@/server/http/respond";
import { previewVoice } from "@/server/agents/voices";

export const dynamic = "force-dynamic";
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const body = (await readJson(req)) as { text?: string };
  const { audio, contentType } = await previewVoice((await params).id, body.text ?? "");
  return new Response(audio, { headers: { "content-type": contentType, "cache-control": "no-store" } });
});
