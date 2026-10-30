import { loadEnvFiles } from "../scripts/_env";
loadEnvFiles();
import { expect, test } from "@playwright/test";
import { getPool } from "../src/server/db/pool";

const token = process.env.VOCAFORGE_ACCESS_TOKEN?.trim() || process.env.E2E_ACCESS_TOKEN?.trim();
test.use({
  httpCredentials: token ? { username: "vocaforge", password: token } : undefined,
});

test.describe("Independent Business Outcome Verification (Outcome Proof) E2E Spec", () => {
  const timestamp = Date.now();
  const projectName = `Outcome Proof Project ${timestamp}`;
  const agentName = `Outcome Receptionist ${timestamp}`;
  const personaName = `Marcus Vance ${timestamp}`;
  const scenarioName = `Tuesday 3PM Dental Booking ${timestamp}`;

  let projectId: string;
  let agentId: string;
  let personaId: string;
  let scenarioId: string;
  let batchId: string;
  let _verifiedRunId: string;
  let _unverifiedRunId: string;
  let _failedRunId: string;

  test.beforeAll(async () => {
    const pool = getPool();

    // 1. Seed project
    const projRes = await pool.query(
      `INSERT INTO projects (name, description, status) VALUES ($1, $2, 'active') RETURNING id`,
      [projectName, "Outcome proof automated browser testing project."]
    );
    projectId = projRes.rows[0].id;

    // 2. Seed agent
    const agentRes = await pool.query(
      `INSERT INTO agents (project_id, name, description, primary_language, remote_agent_id, status, config_version, config)
       VALUES ($1, $2, 'Receptionist', 'en', $3, 'active', 1, '{}') RETURNING id`,
      [projectId, agentName, `agent_remote_${timestamp}`]
    );
    agentId = agentRes.rows[0].id;

    // 3. Seed persona
    const personaRes = await pool.query(
      `INSERT INTO personas (project_id, name, description, status, config)
       VALUES ($1, $2, 'Test Persona', 'ready_for_testing', $3) RETURNING id`,
      [
        projectId,
        personaName,
        JSON.stringify({
          personality: {
            traits: ["Direct"],
            communicationStyle: "direct",
            patienceLevel: 3,
            assertivenessLevel: 3,
            familiarityLevel: 2,
            emotionalResponses: { onConfusion: "Clarifies", onDelays: "Waits", onRepetition: "Notes" },
            mindChangeProbability: 0,
          },
          knowledge: { level: "basic", assumptions: [], withheldInfo: [] },
          language: { primary: "en", additional: [], switchLanguageProbability: 0 },
          startingContext: { situation: "Booking", initialUtterance: "Hello" },
          defaultObjective: { intent: "Book Tuesday 3 PM", mustAchieve: [] },
        }),
      ]
    );
    personaId = personaRes.rows[0].id;

    // 4. Seed scenario with Outcome Contract
    const outcomeContract = {
      enabled: true,
      action: "create_appointment",
      parameters: {
        day: "Tuesday",
        time: "3 PM",
        patientName: "Marcus Vance",
      },
      requiredStatus: "confirmed",
      requiredEvidence: "booking_record",
      claimPatterns: ["booked", "confirmed", "scheduled", "all set"],
    };

    const scenarioRes = await pool.query(
      `INSERT INTO scenarios (project_id, persona_id, target_agent_id, name, description, priority, status, config)
       VALUES ($1, $2, $3, $4, 'Scenario with outcome contract', 'high', 'ready_for_testing', $5) RETURNING id`,
      [
        projectId,
        personaId,
        agentId,
        scenarioName,
        JSON.stringify({
          objective: {
            primaryGoal: "Book Tuesday 3 PM",
            expectedOutcome: "Confirmed booking",
            requiredInformation: ["day", "time", "patientName"],
            deliberatelyWithheld: [],
          },
          evaluation: {
            successCriteria: ["Book Tuesday 3 PM"],
            failureConditions: ["Wrong slot booked"],
            prohibitedOutcomes: [],
          },
          executionLimits: { maxTurns: 10, timeoutSeconds: 120 },
          outcomeContract,
        }),
      ]
    );
    scenarioId = scenarioRes.rows[0].id;

    // 5. Seed Batch
    const batchRes = await pool.query(
      `INSERT INTO simulation_batches (
        project_id, target_agent_id, remote_agent_id, name, status,
        total_scenarios, completed_scenarios, passed_scenarios, failed_scenarios, remote_invocation_id
       ) VALUES ($1, $2, 'remote_agent', 'Outcome Test Batch', 'completed_with_failures', 3, 3, 2, 1, 'inv_outcome_proof_seed') RETURNING id`,
      [projectId, agentId]
    );
    batchId = batchRes.rows[0].id;

    // 6. Seed Run 1: UNVERIFIED (Verbal claim, no tool, no evidence)
    const run1 = await pool.query(
      `INSERT INTO simulation_runs (
        batch_id, project_id, target_agent_id, scenario_id, persona_id,
        scenario_name, persona_name, scenario_snapshot, persona_snapshot,
        status, evaluation_result, transcript, raw_result
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}', 'passed', 'passed', $9, '{}') RETURNING id`,
      [
        batchId,
        projectId,
        agentId,
        scenarioId,
        personaId,
        `${scenarioName} - Unverified`,
        personaName,
        JSON.stringify({ outcomeContract }),
        JSON.stringify([
          { role: "customer", message: "Can you book me for Tuesday at 3 PM?" },
          { role: "agent", message: "Sure thing, you are booked and all set for Tuesday at 3 PM!" },
        ]),
      ]
    );
    _unverifiedRunId = run1.rows[0].id;

    // 7. Seed Run 2: FAILED (Tool invoked with mismatched day: Wednesday)
    const run2 = await pool.query(
      `INSERT INTO simulation_runs (
        batch_id, project_id, target_agent_id, scenario_id, persona_id,
        scenario_name, persona_name, scenario_snapshot, persona_snapshot,
        status, evaluation_result, transcript, raw_result
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}', 'failed_evaluation', 'failed', $9, '{}') RETURNING id`,
      [
        batchId,
        projectId,
        agentId,
        scenarioId,
        personaId,
        `${scenarioName} - Failed`,
        personaName,
        JSON.stringify({ outcomeContract }),
        JSON.stringify([
          { role: "customer", message: "Can you book me for Tuesday at 3 PM?" },
          {
            role: "agent",
            message: "I booked Wednesday at 3 PM for you.",
            toolCalls: [
              {
                tool: "create_appointment",
                parameters: { day: "Wednesday", time: "3 PM", patientName: "Marcus Vance" },
                result: { status: "confirmed", bookingId: "bk_fail_99" },
              },
            ],
          },
        ]),
      ]
    );
    _failedRunId = run2.rows[0].id;

    // 8. Seed Run 3: VERIFIED (Tool invoked with matching day, confirmed by system)
    const run3 = await pool.query(
      `INSERT INTO simulation_runs (
        batch_id, project_id, target_agent_id, scenario_id, persona_id,
        scenario_name, persona_name, scenario_snapshot, persona_snapshot,
        status, evaluation_result, transcript, raw_result
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}', 'passed', 'passed', $9, '{}') RETURNING id`,
      [
        batchId,
        projectId,
        agentId,
        scenarioId,
        personaId,
        `${scenarioName} - Verified`,
        personaName,
        JSON.stringify({ outcomeContract }),
        JSON.stringify([
          { role: "customer", message: "Can you book me for Tuesday at 3 PM?" },
          {
            role: "agent",
            message: "I have confirmed your appointment for Tuesday at 3 PM. Confirmation ID: bk_success_100.",
            toolCalls: [
              {
                tool: "create_appointment",
                parameters: { day: "Tuesday", time: "3 PM", patientName: "Marcus Vance" },
                result: { status: "confirmed", bookingId: "bk_success_100", day: "Tuesday", time: "3 PM" },
              },
            ],
          },
        ]),
      ]
    );
    _verifiedRunId = run3.rows[0].id;
  });

  test("Test A: Verify Outcome Contract Editing and Persistence via Browser UI", async ({ page }) => {
    await page.goto("/virtual-customers");
    await page.waitForLoadState("networkidle");

    // Select project after option is populated
    await page.waitForSelector(`option[value="${projectId}"]`, { state: "attached", timeout: 10000 });
    const projectSelect = page.locator("select").first();
    await projectSelect.selectOption({ value: projectId });
    await page.waitForTimeout(1000);

    // Switch to Scenarios Tab
    await page.getByRole("button", { name: /Test Scenarios/ }).click();
    await page.waitForTimeout(800);

    // Wait for scenario card
    await page.locator(`text=${scenarioName}`).first().waitFor({ state: "visible", timeout: 10000 });

    // Open Scenario Dialog
    const scenarioCard = page.locator("div").filter({ has: page.locator("h3", { hasText: scenarioName }) }).first();
    await scenarioCard.getByRole("button", { name: "Edit" }).click();

    // Verify Outcome Contract section is visible and filled
    await expect(page.getByText("Outcome Contract (Deterministic Outcome Proof)")).toBeVisible();
    await expect(page.locator("#oc-action")).toHaveValue("create_appointment");
    await expect(page.locator("#oc-day")).toHaveValue("Tuesday");
    await expect(page.locator("#oc-time")).toHaveValue("3 PM");
    await expect(page.locator("#oc-patient")).toHaveValue("Marcus Vance");

    // Edit and save
    await page.locator("#oc-day").fill("Tuesday");
    await page.getByRole("button", { name: "Save Test Scenario" }).click();
    await page.waitForTimeout(1000);

    // Reload page to verify persistence across page reloads
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(`option[value="${projectId}"]`, { state: "attached", timeout: 10000 });
    await projectSelect.selectOption({ value: projectId });
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /Test Scenarios/ }).click();
    await page.waitForTimeout(800);

    // Recheck dialog
    await page.locator(`text=${scenarioName}`).first().waitFor({ state: "visible", timeout: 10000 });
    const reopenedCard = page.locator("div").filter({ has: page.locator("h3", { hasText: scenarioName }) }).first();
    await reopenedCard.getByRole("button", { name: "Edit" }).click();
    await expect(page.locator("#oc-day")).toHaveValue("Tuesday");
    await expect(page.locator("#oc-patient")).toHaveValue("Marcus Vance");
  });

  test("Test B: Inspect Verified Business Outcome in Results UI", async ({ page }) => {
    page.on("pageerror", (err) => console.log("BROWSER PAGEERROR:", err.message));
    page.on("console", (msg) => console.log("BROWSER CONSOLE:", msg.type(), msg.text()));
    await page.goto("/results");
    await page.waitForLoadState("networkidle");

    await page.waitForSelector(`option[value="${projectId}"]`, { state: "attached", timeout: 10000 });
    const resultsProjectSelect = page.locator("select").first();
    await resultsProjectSelect.selectOption({ value: projectId });
    await page.waitForTimeout(1500);

    // Inspect Verified run
    const runRows = page.locator("tbody tr");
    const verifiedRow = runRows.filter({ hasText: `${scenarioName} - Verified` }).first();
    await verifiedRow.getByRole("button", { name: /Inspect Transcript/i }).click();

    // Verify OutcomeProofCard renders in Transcript Drawer
    await page.waitForSelector("[data-testid='outcome-proof-card']", { timeout: 15000 });
    await expect(page.locator("[data-testid='outcome-proof-card']")).toBeVisible();
    await expect(page.getByText("Outcome: VERIFIED")).toBeVisible();
    await expect(page.getByText("A. Conversation Claim")).toBeVisible();
    await expect(page.getByText("B. Tool Invocation")).toBeVisible();
    await expect(page.getByText("C. Outcome Evidence")).toBeVisible();
    await expect(page.getByText("create_appointment").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  test("Test C: Inspect Unverified and Failed Business Outcomes in Results UI", async ({ page }) => {
    await page.goto("/results");
    await page.waitForLoadState("networkidle");

    await page.waitForSelector(`option[value="${projectId}"]`, { state: "attached", timeout: 10000 });
    const resultsProjectSelect = page.locator("select").first();
    await resultsProjectSelect.selectOption({ value: projectId });
    await page.waitForTimeout(1500);

    const runRows = page.locator("tbody tr");

    // 1. Inspect Unverified run (Verbal claim only)
    const unverifiedRow = runRows.filter({ hasText: `${scenarioName} - Unverified` }).first();
    await unverifiedRow.getByRole("button", { name: /Inspect Transcript/i }).click();
    await page.waitForSelector("[data-testid='outcome-proof-card']", { timeout: 15000 });
    await expect(page.getByText("Outcome: UNVERIFIED")).toBeVisible();
    await expect(page.getByText(/Verbal claims cannot serve as proof/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // 2. Inspect Failed run (Parameter mismatch)
    const failedRow = runRows.filter({ hasText: `${scenarioName} - Failed` }).first();
    await failedRow.getByRole("button", { name: /Inspect Transcript/i }).click();
    await page.waitForSelector("[data-testid='outcome-proof-card']", { timeout: 15000 });
    await expect(page.getByText("Outcome: FAILED")).toBeVisible();
    await expect(page.getByText("Wednesday").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });
});
