import { loadEnvFiles } from "./_env";
loadEnvFiles();

import { generateAgentConfig } from "../src/server/generation/service";

// Makes ONE real call to the configured generation provider (costs tokens). Usage:
//   GENERATION_SMOKE_OPT_IN=true npm run generation:check -- "describe your agent here"
async function main() {
  if (process.env.GENERATION_SMOKE_OPT_IN !== "true") { console.error("Refusing to run: set GENERATION_SMOKE_OPT_IN=true to opt in."); process.exit(2); }
  const prompt = process.argv.slice(2).join(" ").trim();
  if (!prompt) { console.error("Pass a description as the first argument."); process.exit(2); }
  try {
    const r = await generateAgentConfig({ prompt });
    console.log(JSON.stringify({ name: r.config.identity.name, language: r.config.language, goals: r.config.behavior.goals, capabilities: r.config.capabilities, openQuestions: r.openQuestions }, null, 2));
  } catch (err) {
    console.error(`${(err as { code?: string }).code ?? "error"}: ${(err as Error).message}`);
    process.exit(1);
  }
}
main();
