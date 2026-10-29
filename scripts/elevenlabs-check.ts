import { loadEnvFiles } from "./_env";
loadEnvFiles();

import { checkElevenLabs } from "../src/server/integrations/elevenlabs";

// Read-only authentication check. Creates nothing and costs no credits.
checkElevenLabs({ force: true }).then((s) => {
  console.log(JSON.stringify(s, null, 2));
  process.exit(s.state === "connected" ? 0 : 1);
});
