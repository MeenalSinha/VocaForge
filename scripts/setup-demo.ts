import { loadEnvFiles } from "./_env";
loadEnvFiles();
import { setupDemoWorkspace } from "../src/server/demo/setup";

async function main() {
  const args = process.argv.slice(2);
  const executeSimulation = args.includes("--simulate") || process.env.RUN_DEMO_SIMULATION === "true";

  console.log("===============================================================");
  console.log("        VOCAFORGE — PRESENTATION DEMO WORKSPACE SETUP          ");
  console.log("===============================================================");
  console.log(`Mode: Idempotent Setup | Run Simulation: ${executeSimulation ? "YES" : "NO (ready for live UI run)"}\n`);

  try {
    const result = await setupDemoWorkspace({ executeSimulation });

    console.log("--- 1. PROJECT ---");
    console.log(`[${result.project.status.toUpperCase()}] Project: "${result.project.name}" (ID: ${result.project.id})\n`);

    console.log("--- 2. VOICE AGENTS (ElevenLabs & LLM) ---");
    for (const a of result.agents) {
      if (a.status === "failed") {
        console.log(`[FAILED] ${a.name}: ${a.error}`);
      } else {
        console.log(`[${a.status.toUpperCase()}] "${a.name}" (DB ID: ${a.id}, ElevenLabs Remote ID: ${a.remoteAgentId})`);
      }
    }
    console.log();

    console.log("--- 3. VIRTUAL CUSTOMERS (Personas) ---");
    for (const p of result.personas) {
      console.log(`[${p.status.toUpperCase()}] "${p.name}" (ID: ${p.id})`);
    }
    console.log();

    console.log("--- 4. SCENARIOS (Adversarial & Flow Testing) ---");
    for (const s of result.scenarios) {
      console.log(`[${s.status.toUpperCase()}] "${s.name}" [Priority: ${s.priority}] (ID: ${s.id})`);
    }
    console.log();

    if (result.simulation) {
      console.log("--- 5. SIMULATION EXECUTION ---");
      console.log(`Batch ID: ${result.simulation.batchId}`);
      console.log(`Status: ${result.simulation.status}`);
      console.log(`Scenarios: ${result.simulation.scenariosPassed}/${result.simulation.scenariosTotal} passed`);
      console.log(`Analysis Findings Generated: ${result.simulation.findingsCount}`);
      console.log(`Fix Proposals Created: ${result.simulation.proposalsCount}\n`);
    } else {
      console.log("--- 5. LIVE SIMULATION READY ---");
      console.log("No automatic paid simulation was run. The workspace is fully populated");
      console.log("and ready for you to execute a live simulation in the Test Lab UI!");
      console.log("Tip: Pass '--simulate' or set RUN_DEMO_SIMULATION=true to pre-run a simulation.\n");
    }

    console.log("===============================================================");
    console.log("               DEMO WORKSPACE READY FOR JUDGES!                ");
    console.log("===============================================================");
    process.exit(0);
  } catch (err) {
    console.error("\nSetup failed:", (err as Error).message);
    process.exit(1);
  }
}

main();
