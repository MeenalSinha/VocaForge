import { expect, test } from "@playwright/test";

const token = process.env.E2E_ACCESS_TOKEN;
test.use({
  httpCredentials: token ? { username: "e2e", password: token } : undefined,
});

test.describe("Full End-to-End Primary Workflow Acceptance Test", () => {
  const timestamp = Date.now();
  const projectName = `E2E Workflow Project ${timestamp}`;
  const personaName = `E2E Customer ${timestamp}`;
  const scenarioName = `E2E Returns Scenario ${timestamp}`;

  test("Step 1-3: Create project, edit description, and verify persistence", async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("button", { name: "New project" }).first().click();
    await page.getByLabel("Name").fill(projectName);
    await page.getByLabel("Description (optional)").fill("Primary end-to-end acceptance project");
    await page.getByRole("button", { name: "Create project" }).click();

    await page.waitForURL(/\/projects\/[0-9a-f-]+/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

    await page.getByLabel("Description").fill("Primary project with updated persistence");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Description")).toHaveValue("Primary project with updated persistence");
  });

  test("Step 4-6: Create virtual customer persona and testing scenario", async ({ page }) => {
    await page.goto("/virtual-customers");
    await expect(page.getByRole("heading", { name: "Virtual Customer Studio" })).toBeVisible();

    // Select our created project
    const projectSelect = page.locator("select").first();
    await projectSelect.selectOption({ label: projectName });

    // Open Persona Wizard
    await page.getByRole("button", { name: "Create Virtual Customer" }).first().click();
    await expect(page.getByText("Configure Customer Profile")).toBeVisible();

    // Fill Persona Details
    await page.getByLabel("Persona Name").fill(personaName);
    await page.getByLabel("Customer Background").fill("Long-time customer wanting to return a purchased item.");
    
    // Save Persona
    await page.getByRole("button", { name: "Save Customer Persona" }).click();
    await expect(page.getByText("Persona created successfully")).toBeVisible();
    await expect(page.getByText(personaName)).toBeVisible();

    // Switch to Scenarios tab
    await page.getByRole("button", { name: /Test Scenarios/ }).click();
    await page.getByRole("button", { name: "New Scenario" }).first().click();
    await expect(page.getByText("Create Test Scenario")).toBeVisible();

    // Fill Scenario Details
    await page.getByLabel("Scenario Name").fill(scenarioName);
    await page.getByLabel("Description").fill("Test whether the voice agent properly enforces return window policies.");
    await page.getByLabel("Primary Objective").fill("Customer wants to return item past 30-day window.");
    await page.getByRole("button", { name: "Create Scenario" }).click();
    await expect(page.getByText("Scenario created successfully")).toBeVisible();
    await expect(page.getByText(scenarioName)).toBeVisible();
  });

  test("Step 7: Test Lab preflight matrix links project, persona, and scenario", async ({ page }) => {
    await page.goto("/test-lab");
    await expect(page.getByRole("heading", { name: "Test Lab" })).toBeVisible();

    // Select created project
    const projectSelect = page.locator("select").first();
    await projectSelect.selectOption({ label: projectName });

    // Verify scenario matrix detects the created scenario
    await expect(page.getByText(scenarioName)).toBeVisible();
    await expect(page.getByRole("heading", { name: "3. Simulation Preflight Checklist" })).toBeVisible();
  });

  test("Step 8-11: Observability, Refinement, Deployments, and Settings verification", async ({ page }) => {
    // 1. Observability / Results
    await page.goto("/results");
    await expect(page.getByRole("heading", { name: "Results & Observability" })).toBeVisible();
    const resultsProjectSelect = page.getByLabel("Select Project");
    await resultsProjectSelect.selectOption({ label: projectName });
    await expect(page.getByText("Total Test Runs")).toBeVisible();
    await expect(page.getByText("Passing Rate")).toBeVisible();

    // 2. Refinement
    await page.goto("/refinement");
    await expect(page.getByRole("heading", { name: "Refinement & Remediation" })).toBeVisible();
    const refinementProjectSelect = page.getByLabel("Select Project");
    await refinementProjectSelect.selectOption({ label: projectName });
    await expect(page.getByRole("button", { name: /Failure Findings/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Fix Proposals/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Retest Verifications/ })).toBeVisible();

    // 3. Deployments
    await page.goto("/deployments");
    await expect(page.getByRole("heading", { name: "Deployments & Release Management" })).toBeVisible();
    const deploymentsProjectSelect = page.locator("select").first();
    await deploymentsProjectSelect.selectOption({ label: projectName });
    await expect(page.getByRole("heading", { name: /Release Candidate & Readiness Inspector/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Deployment History/ })).toBeVisible();

    // 4. Settings
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "System Settings" })).toBeVisible();
    await expect(page.getByText("ElevenLabs Conversational AI")).toBeVisible();
    await expect(page.getByText("Database Infrastructure")).toBeVisible();
    await expect(page.getByRole("button", { name: "Run connection check" })).toBeVisible();
  });
});

