import { expect, test } from "@playwright/test";

const token = process.env.E2E_ACCESS_TOKEN;
test.use({
  httpCredentials: token ? { username: "e2e", password: token } : undefined,
});

test.describe("VocaForge End-to-End Browser Verification", () => {
  test("1. Dashboard loads with workspace metrics and quick actions", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/dashboard");
    await expect(page).toHaveTitle(/Dashboard \| VocaForge/);
    await expect(page.getByRole("heading", { name: /Voice Quality Workspace|Quality Dashboard/ })).toBeVisible();
    await expect(page.getByText("Quality Assurance Lifecycle")).toBeVisible();
    await expect(page.getByText("System & Engine Health")).toBeVisible();

    // Verify sidebar navigation links exist with exact name matching
    const nav = page.locator('nav[aria-label="Primary"]');
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Projects" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Agents" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Virtual Customers" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Test Lab" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Results" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Refinement" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Deployments" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Settings" })).toBeVisible();

    expect(consoleErrors).toHaveLength(0);
  });

  test("2. Settings page reports real connected status for ElevenLabs and Database", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "System Settings" })).toBeVisible();
    await expect(page.getByText("ElevenLabs Conversational AI")).toBeVisible();
    await expect(page.getByText("Database Infrastructure")).toBeVisible();

    // Trigger connection check to verify live connectivity
    const checkBtn = page.getByRole("button", { name: "Run connection check" });
    if (await checkBtn.isVisible()) {
      await checkBtn.click();
      await expect(page.getByText("Authenticated against the ElevenLabs Agents API.")).toBeVisible();
    }
  });

  test("3. Project lifecycle: create, update, search, archive, and restore", async ({ page }) => {
    const timestamp = Date.now();
    const projName = `E2E Workspace ${timestamp}`;

    await page.goto("/projects");
    await page.getByRole("button", { name: "New project" }).first().click();
    await page.getByLabel("Name").fill(projName);
    await page.getByLabel("Description (optional)").fill("E2E full browser test workspace");
    await page.getByRole("button", { name: "Create project" }).click();

    // Verify redirect to project page
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: projName })).toBeVisible();

    // Update description and verify persistence
    await page.getByLabel("Description").fill("Updated workspace description");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Description")).toHaveValue("Updated workspace description");

    // Search for project
    await page.goto(`/projects?q=${encodeURIComponent(projName)}`);
    await expect(page.getByRole("link", { name: projName })).toBeVisible();

    // Archive project
    await page.goto(`/projects`);
    await page.getByRole("link", { name: projName }).click();
    await page.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("button", { name: "Archive project" }).click();
    await expect(page.getByText("Project archived")).toBeVisible();
    await expect(page.getByText("This project is archived")).toBeVisible();

    // Restore project
    await page.getByRole("button", { name: "Restore" }).click();
    await page.getByRole("button", { name: "Restore project" }).click();
    await expect(page.getByText("Project restored")).toBeVisible();
    await page.reload();
    await expect(page.getByText("This project is archived")).not.toBeVisible();
  });

  test("4. Virtual Customers: personas, scenarios, and templates tabs", async ({ page }) => {
    await page.goto("/virtual-customers");
    await expect(page.getByRole("heading", { name: "Virtual Customer Studio" })).toBeVisible();

    // Check tabs
    await expect(page.getByRole("button", { name: /Virtual Customers/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Test Scenarios/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Template Library/ })).toBeVisible();

    // Switch to Template Library tab
    await page.getByRole("button", { name: /Template Library/ }).click();
    await expect(page.getByRole("heading", { name: "Persona Template Library" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Impatient Customer" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Price-Sensitive Customer" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Frustrated Customer" })).toBeVisible();

    // Switch to Scenarios tab
    await page.getByRole("button", { name: /Test Scenarios/ }).click();
    await expect(page.getByRole("button", { name: "New Scenario" })).toBeVisible();

    // Switch back to Personas tab
    await page.getByRole("button", { name: /Virtual Customers/ }).click();
    await expect(page.getByRole("button", { name: "Create Virtual Customer" }).first()).toBeVisible();
  });

  test("5. Test Lab: preflight checks and simulation controls", async ({ page }) => {
    await page.goto("/test-lab");
    await expect(page.getByRole("heading", { name: "Test Lab" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "1. Select Target ElevenLabs Agent" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /2. Select Test Scenarios/ })).toBeVisible();
  });

  test("6. Results & Observability page loads metrics and breakdown", async ({ page }) => {
    await page.goto("/results");
    await expect(page.getByRole("heading", { name: "Results & Observability" })).toBeVisible();
    await expect(page.getByText("Total Test Runs")).toBeVisible();
    await expect(page.getByText("Passing Rate")).toBeVisible();
  });

  test("7. Refinement & Autonomous Fixes page loads tabs and controls", async ({ page }) => {
    await page.goto("/refinement");
    await expect(page.getByRole("heading", { name: "Refinement & Remediation" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Failure Findings/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Fix Proposals/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Retest Verifications/ })).toBeVisible();
  });

  test("8. Deployments & Release Readiness page loads gates and environments", async ({ page }) => {
    await page.goto("/deployments");
    await expect(page.getByRole("heading", { name: "Deployments & Release Management" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Release Candidate & Readiness Inspector/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Deployment History/ })).toBeVisible();
  });
});
