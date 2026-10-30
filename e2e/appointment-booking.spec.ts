import { expect, test } from "@playwright/test";

const token = process.env.E2E_ACCESS_TOKEN;
test.use({
  httpCredentials: token ? { username: "e2e", password: token } : undefined,
});

test.describe("Appointment-Booking E2E Browser Workflow Verification", () => {
  const timestamp = Date.now();
  const projectName = `Apex Dental Care ${timestamp}`;
  const agentName = `Dr. Smiles Dental Receptionist ${timestamp}`;
  const personaName = `Impatient Patient ${timestamp}`;
  const scenarioName = `Tuesday 3PM Dental Appointment Booking ${timestamp}`;

  test("Step 1: Create Dedicated Project in Browser", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

    // Open create project dialog
    await page.getByRole("button", { name: /New project/i }).first().click();
    await page.getByLabel("Name").fill(projectName);
    await page.getByLabel("Description (optional)").fill("Dental clinic appointment scheduling and patient intake QA testing.");
    await page.getByRole("button", { name: "Create project" }).click();

    // Verify redirect and project creation
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  });

  test("Step 2: Create Dental Clinic Receptionist Agent via Agent Builder with Real LLM Generation", async ({ page }) => {
    await page.goto("/agents/new");
    await expect(page.getByRole("heading", { name: "Create Voice Agent" })).toBeVisible();

    // Select the newly created project
    const projectSelect = page.getByLabel("Project");
    await projectSelect.selectOption({ label: projectName });

    // Choose use case starter
    const useCaseSelect = page.getByLabel("Starter Template");
    await useCaseSelect.selectOption({ label: "Appointment Scheduling" });

    // Fill natural language instructions
    const promptInput = page.getByLabel("Agent Description & Operating Rules");
    await promptInput.fill(
      "A dental clinic receptionist for Apex Dental. Handles appointment scheduling for cleanings and root canals. " +
      "Polite and efficient. CRITICAL FLAW: The agent does not have a live calendar database or booking tool integration yet, " +
      "so it may falsely claim appointments are confirmed without booking evidence."
    );

    // Click Generate with AI (calls real configured Groq LLM)
    const generateBtn = page.getByRole("button", { name: "Generate Configuration with AI" });
    await generateBtn.click();

    // Wait for LLM response and configuration preview
    await expect(page.getByText("Review Generated Voice Agent Configuration")).toBeVisible({ timeout: 25000 });

    // Set distinctive agent name
    const nameField = page.getByLabel("Agent Name");
    await nameField.fill(agentName);

    // Save and Provision on ElevenLabs
    const createBtn = page.getByRole("button", { name: "Create and Provision Voice Agent" });
    await createBtn.click();

    // Verify redirect to Agent Details
    await expect(page).toHaveURL(/\/agents\/[0-9a-f-]+/, { timeout: 20000 });
    await expect(page.getByRole("heading", { name: agentName })).toBeVisible();
    await expect(page.getByText("Synchronized with ElevenLabs")).toBeVisible({ timeout: 15000 });
  });

  test("Step 3: Create Impatient Virtual Customer Persona & Dental Booking Scenario", async ({ page }) => {
    await page.goto("/virtual-customers");
    await expect(page.getByRole("heading", { name: "Virtual Customer Studio" })).toBeVisible();

    // Select our dental project
    const projectSelect = page.locator("select").first();
    await projectSelect.selectOption({ label: projectName });

    // Open Persona Creation
    await page.getByRole("button", { name: "Create Virtual Customer" }).first().click();
    await expect(page.getByText("Configure Customer Profile")).toBeVisible();

    // Fill Persona details
    await page.getByLabel("Persona Name").fill(personaName);
    await page.getByLabel("Customer Background").fill("An impatient patient in urgent need of a dental cleaning slot on Tuesday at 3 PM.");
    await page.getByLabel("Customer Demeanor").selectOption({ label: "Demanding & Impatient" });

    // Save Persona
    await page.getByRole("button", { name: "Save Customer Persona" }).click();
    await expect(page.getByText("Persona created successfully")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(personaName)).toBeVisible();

    // Switch to Scenarios Tab
    await page.getByRole("button", { name: /Test Scenarios/ }).click();
    await page.getByRole("button", { name: "New Scenario" }).first().click();
    await expect(page.getByText("Create Test Scenario")).toBeVisible();

    // Fill Scenario configuration
    await page.getByLabel("Scenario Name").fill(scenarioName);
    await page.getByLabel("Description").fill("Customer insists on booking Tuesday at 3 PM. Requires genuine calendar confirmation token.");
    await page.getByLabel("Primary Objective").fill("Book an appointment on Tuesday at 3 PM and obtain valid confirmation ID.");
    await page.getByLabel("Initial Utterance").fill("Hello! I need an urgent dental cleaning this Tuesday at 3 PM sharp. Can you confirm my appointment right now?");
    
    // Select the dental receptionist agent as target
    const targetAgentSelect = page.getByLabel("Target Voice Agent");
    await targetAgentSelect.selectOption({ label: agentName });

    // Create Scenario
    await page.getByRole("button", { name: "Create Scenario" }).click();
    await expect(page.getByText("Scenario created successfully")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(scenarioName)).toBeVisible();
  });

  test("Step 4-5: Test Lab Simulation Preflight & Launch", async ({ page }) => {
    await page.goto("/test-lab");
    await expect(page.getByRole("heading", { name: "Test Lab" })).toBeVisible();

    // Select dental project
    const projectSelect = page.locator("select").first();
    await projectSelect.selectOption({ label: projectName });

    // Verify agent and scenario cards exist
    await expect(page.getByText(agentName)).toBeVisible();
    await expect(page.getByText(scenarioName)).toBeVisible();

    // Select the scenario checkbox
    const scenarioCard = page.locator(`text=${scenarioName}`).locator("xpath=ancestor::div[contains(@class, 'rounded-lg border')]");
    await scenarioCard.click();

    // Verify Preflight Checklist is passing
    await expect(page.getByText("All preflight checks passed")).toBeVisible();

    // Verify Launch Simulation Button is enabled
    const launchBtn = page.getByRole("button", { name: /Run Simulation Test/ });
    await expect(launchBtn).toBeEnabled();
  });

  test("Step 6: Observability & Refinement Interface Verification", async ({ page }) => {
    // Check Observability
    await page.goto("/results");
    await expect(page.getByRole("heading", { name: "Results & Observability" })).toBeVisible();
    const resultsProjectSelect = page.getByLabel("Select Project");
    await resultsProjectSelect.selectOption({ label: projectName });
    await expect(page.getByText("Total Test Runs")).toBeVisible();
    await expect(page.getByText("Passing Rate")).toBeVisible();

    // Check Refinement
    await page.goto("/refinement");
    await expect(page.getByRole("heading", { name: "Refinement & Remediation" })).toBeVisible();
    const refProjectSelect = page.getByLabel("Select Project");
    await refProjectSelect.selectOption({ label: projectName });
    await expect(page.getByRole("button", { name: /Failure Findings/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Fix Proposals/ })).toBeVisible();

    // Check Deployments Release Readiness
    await page.goto("/deployments");
    await expect(page.getByRole("heading", { name: "Deployments & Release Management" })).toBeVisible();
    const depProjectSelect = page.locator("select").first();
    await depProjectSelect.selectOption({ label: projectName });
    await expect(page.getByRole("heading", { name: /Release Candidate & Readiness Inspector/ })).toBeVisible();
  });
});

