import { ok, route } from "@/server/http/respond";
import { checkElevenLabs } from "@/server/integrations/elevenlabs";

export const dynamic = "force-dynamic";

/** Initiates a real, read-only authentication check. The response never contains the key. */
export const POST = route(async () => ok(await checkElevenLabs({ force: true })));
