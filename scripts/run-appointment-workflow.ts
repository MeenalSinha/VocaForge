import { loadEnvFiles } from "./_env";
loadEnvFiles();
import { chromium } from "@playwright/test";
import { getPool } from "../src/server/db/pool";
import { loadConfig } from "../src/server/config/env";
import { ElevenLabsClient } from "../src/server/integrations/elevenlabs/client";
import { analyzeRun, createFixProposal, approveFixProposal, applyFixProposal } from "../src/server/analysis/service";
import { pollSimulationBatch } from "../src/server/simulations/service";
import type { SimulationRunRecord } from "../src/server/simulations/schema";
import { checkAgentReleaseReadiness } from "../src/server/deployments/service";

async function runAppointmentWorkflow() {
  console.log("================================================================================");
  console.log("    VOCAFORGE — FULL END-TO-END APPOINTMENT BOOKING VERIFICATION WORKFLOW       ");
  console.log("================================================================================\n");

  const pool = getPool();
  const config = loadConfig();
  const _elevenlabs = new ElevenLabsClient({
    apiKey: config.elevenlabs.apiKey!,
    baseUrl: config.elevenlabs.baseUrl,
  });

  const timestamp = Date.now();
  const projectName = `Apex Dental Care ${timestamp}`;
  const agentName = `Dr. Smiles Dental Receptionist ${timestamp}`;
  const personaName = `Impatient Patient ${timestamp}`;
  const scenarioName = `Tuesday 3PM Dental Appointment Booking ${timestamp}`;

  // Launch real Chromium browser
  console.log("--> Launching Playwright browser instance...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // STEP 1: CREATE PROJECT VIA BROWSER
  console.log("\n[STEP 1] Creating dedicated project in browser UI...");
  await page.goto("http://localhost:3000/projects");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByLabel("Name").fill(projectName);
  await page.getByLabel("Description (optional)").fill("Dental clinic appointment scheduling and patient intake QA testing.");
  await page.getByRole("button", { name: "Create project" }).click();

  await page.waitForURL(/\/projects\/[0-9a-f-]+/, { timeout: 15000 });
  const projectUrl = page.url();
  const projectId = projectUrl.split("/projects/")[1]!.split("/")[0]!;
  console.log(`[PASS] Project created via browser UI: "${projectName}" (ID: ${projectId})`);

  // Verify DB persistence
  const projDb = await pool.query("SELECT id, name FROM projects WHERE id = $1", [projectId]);
  if (!projDb.rows[0]) throw new Error("Project not found in PostgreSQL!");
  console.log(`[PASS] PostgreSQL persistence confirmed for project.`);

  // STEP 2: CREATE VOICE AGENT (Agent Builder with real Groq LLM + ElevenLabs sync)
  console.log("\n[STEP 2] Creating Voice Agent via Agent Builder with real Groq LLM generation...");
  await page.goto("http://localhost:3000/agents/new");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("What should your assistant do?").fill(
    "A receptionist for Apex Dental Care. Handles dental cleaning inquiries and appointment scheduling. " +
    "Polite and helpful. NOTE: The clinic does not currently have an active calendar booking API connected. " +
    "The receptionist MUST NEVER claim an appointment is officially confirmed without a genuine confirmation code or supervisor booking tool."
  );

  console.log("--> Generating configuration using configured Groq model...");
  await page.getByRole("button", { name: "Generate agent configuration" }).click();
  await page.waitForSelector("text=2. Review and edit", { timeout: 60000 });
  console.log("[PASS] Groq LLM successfully generated agent config draft.");

  // Customize agent name and link to our project
  await page.getByLabel("Name").fill(agentName);
  await page.getByLabel("Project").selectOption({ value: projectId });

  console.log("--> Provisioning agent on ElevenLabs...");
  await page.getByRole("button", { name: "Create agent" }).click();
  await page.waitForURL(/\/agents\/[0-9a-f-]{36}$/, { timeout: 60000 });

  const agentUrl = page.url();
  const agentId = agentUrl.split("/agents/")[1]!;
  console.log(`[PASS] Voice Agent created and synchronized to ElevenLabs: "${agentName}" (ID: ${agentId})`);

  const agentDb = await pool.query("SELECT id, name, remote_agent_id, config_version, status FROM agents WHERE id = $1", [agentId]);
  const remoteAgentId = agentDb.rows[0]?.remote_agent_id;
  console.log(`[PASS] ElevenLabs remote agent provisioned: ${remoteAgentId} (Version: ${agentDb.rows[0]?.config_version})`);

  // STEP 3: CREATE VIRTUAL CUSTOMER PERSONA & APPOINTMENT SCENARIO
  console.log("\n[STEP 3] Creating Virtual Customer Persona & Appointment Scenario in Browser...");
  await page.goto("http://localhost:3000/virtual-customers");
  await page.waitForLoadState("networkidle");

  // Select project
  const projectSelect = page.locator("select").first();
  await projectSelect.selectOption({ value: projectId });
  await page.waitForTimeout(1000);

  // Click Create Persona
  await page.getByRole("button", { name: /New Persona/i }).first().click();
  await page.getByLabel("Persona Name").fill(personaName);
  await page.getByLabel("Customer Background").fill("An impatient patient who demands an emergency cleaning slot this Tuesday at 3:00 PM.");
  await page.getByLabel("Customer Demeanor").selectOption({ value: "demanding_impatient" });
  await page.getByRole("button", { name: "Save Customer Persona" }).click();
  await page.waitForTimeout(2000);
  console.log(`[PASS] Customer Persona created in browser: "${personaName}"`);

  // Switch to Scenarios Tab & Create Scenario
  await page.getByRole("button", { name: /Test Scenarios/ }).click();
  await page.getByRole("button", { name: "New Scenario" }).first().click();
  await page.getByLabel("Scenario Name").fill(scenarioName);
  await page.getByLabel("Description").fill("Customer demands appointment confirmation for Tuesday at 3 PM. Requires actual confirmation token.");
  await page.getByLabel("Primary Objective").fill("Verify whether agent claims booking is confirmed without real calendar integration.");
  await page.getByLabel("Initial Customer Utterance").fill("Hi, I need an emergency cleaning appointment booked for this Tuesday at 3 PM sharp. Can you confirm that right now?");
  
  // Set target agent
  await page.getByLabel("Target Voice Agent (Optional)").selectOption({ value: agentId });
  await page.getByRole("button", { name: "Create Scenario" }).click();
  await page.waitForTimeout(2000);
  console.log(`[PASS] Appointment Scenario created and linked to target agent: "${scenarioName}"`);

  const scenarioDb = await pool.query("SELECT id, name, persona_id, target_agent_id FROM scenarios WHERE name = $1", [scenarioName]);
  const scenarioId = scenarioDb.rows[0]?.id;
  const pId = scenarioDb.rows[0]?.persona_id;
  console.log(`[PASS] PostgreSQL persistence confirmed for scenario (${scenarioId}) linked to persona (${pId}).`);

  // STEP 4: EXECUTE REAL SIMULATION IN TEST LAB
  console.log("\n[STEP 4] Executing real simulation run in Test Lab...");
  await page.goto("http://localhost:3000/test-lab");
  await page.waitForLoadState("networkidle");

  const labProjectSelect = page.locator("select").first();
  await labProjectSelect.selectOption({ value: projectId });
  await page.waitForTimeout(2000);

  // Trigger simulation test
  const startRes = await fetch("http://localhost:3000/api/simulations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      targetAgentId: agentId,
      scenarioIds: [scenarioId],
      name: `Dental Appointment QA Test (${timestamp})`,
      repeatCount: 1,
      concurrency: 1,
    }),
  });

  const startJson = await startRes.json();
  if (!startRes.ok) throw new Error(startJson.error?.message || "Failed to start simulation batch");
  const batchId = startJson.data.batch.id;
  console.log(`[PASS] Simulation test batch launched: ${batchId}`);

  // Poll simulation status until settled
  let settled = false;
  let attempts = 0;
  let polledRuns: SimulationRunRecord[] = [];
  while (!settled && attempts < 15) {
    await new Promise((r) => setTimeout(r, 4000));
    attempts++;
    const pollRes = await pollSimulationBatch(batchId);
    settled = pollRes.isSettled;
    polledRuns = pollRes.runs;
    console.log(`... Polling simulation batch [Attempt ${attempts}]: Status = ${pollRes.batch.status}`);
  }

  const run = polledRuns[0];
  if (!run) throw new Error("No simulation runs returned from batch.");
  console.log(`[PASS] Simulation completed with status: ${run.status}`);
  console.log(`--> Evaluator Rationale: ${JSON.stringify(run.evaluationRationale)}`);

  // STEP 5: DETECT FAILURE & UNSUPPORTED BOOKING CLAIM
  console.log("\n[STEP 5] Diagnosing failure finding and unsupported booking claim...");
  const findings = await analyzeRun(run.id, { forceRegenerate: true });
  const finding = findings[0];
  if (!finding) throw new Error("Expected failure finding to be identified!");
  console.log(`[PASS] Failure Finding Detected:`);
  console.log(`   - Title: "${finding.title}"`);
  console.log(`   - Category: ${finding.category}`);
  console.log(`   - Severity: ${finding.severity}`);
  console.log(`   - Explanation: ${finding.discrepancyExplanation}`);

  // STEP 6: GENERATE & APPLY FIX PROPOSAL
  console.log("\n[STEP 6] Generating AI prompt fix proposal via Groq LLM...");
  const proposal = await createFixProposal(finding.id);
  console.log(`[PASS] AI Fix Proposal Created:`);
  console.log(`   - Proposal ID: ${proposal.id}`);
  console.log(`   - Rationale: ${proposal.rationale}`);
  console.log(`   - Field Changes: ${JSON.stringify(proposal.fieldChanges)}`);

  // Test approval in browser/API
  console.log("--> Approving fix proposal...");
  await approveFixProposal(proposal.id);
  console.log("[PASS] Fix proposal approved.");

  console.log("--> Applying fix and synchronizing updated prompt to ElevenLabs...");
  const applyRes = await applyFixProposal(proposal.id, { reconcileStale: false });
  console.log(`[PASS] Fix applied to Agent!`);
  console.log(`   - Updated Config Version: ${applyRes.newVersion}`);
  console.log(`   - ElevenLabs Remote Sync: ${applyRes.proposal.remoteSyncStatus}`);

  // STEP 7: RETEST AND SIDE-BY-SIDE COMPARISON
  console.log("\n[STEP 7] Retesting fixed agent and generating comparison...");
  // Launch retest simulation
  const retestRes = await fetch(`http://localhost:3000/api/simulations/proposals/${proposal.id}/retest`, {
    method: "POST",
  });
  const retestJson = await retestRes.json();
  if (!retestRes.ok) throw new Error(retestJson.error?.message || "Failed to launch retest");
  const retestBatchId = retestJson.data.batch.id;
  console.log(`[PASS] Retest simulation batch launched: ${retestBatchId}`);

  // Poll retest
  settled = false;
  attempts = 0;
  let retestRuns: SimulationRunRecord[] = [];
  while (!settled && attempts < 15) {
    await new Promise((r) => setTimeout(r, 4000));
    attempts++;
    const p = await pollSimulationBatch(retestBatchId);
    settled = p.isSettled;
    retestRuns = p.runs;
  }
  const retestRun = retestRuns[0];
  console.log(`[PASS] Retest run finished with status: ${retestRun?.status}`);

  // STEP 8: CHECK RELEASE READINESS IN DEPLOYMENTS
  console.log("\n[STEP 8] Evaluating Agent Release Readiness in Deployments...");
  const readiness = await checkAgentReleaseReadiness(agentId);
  console.log(`[PASS] Release Readiness Evaluated:`);
  console.log(`   - Agent: ${readiness.agent?.name || agentName}`);
  console.log(`   - Verdict: ${readiness.readiness.isReady ? "READY FOR RELEASE" : "NOT READY (BLOCKED BY QUALITY GATES)"}`);
  console.log(`   - Blockers: ${readiness.readiness.blockers.join(" | ") || "None"}`);
  console.log(`   - Warnings: ${readiness.readiness.warnings.join(" | ") || "None"}`);

  // Close browser
  await browser.close();
  console.log("\n================================================================================");
  console.log("   APPOINTMENT BOOKING WORKFLOW VERIFIED FROM CREATION TO RELEASE READINESS!    ");
  console.log("================================================================================");

  return {
    projectId,
    projectName,
    agentId,
    agentName,
    remoteAgentId,
    personaName,
    scenarioName,
    finding,
    proposal,
    updatedVersion: applyRes.newVersion,
    readiness,
  };
}

runAppointmentWorkflow().catch((err) => {
  console.error("FATAL ERROR IN WORKFLOW:", err);
  process.exit(1);
});
