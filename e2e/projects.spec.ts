import { expect, test } from "@playwright/test";

// Requires a running app with a migrated database. If VOCAFORGE_ACCESS_TOKEN is set on the server,
// export E2E_ACCESS_TOKEN with the same value.
const token = process.env.E2E_ACCESS_TOKEN;
test.use({ httpCredentials: token ? { username: "e2e", password: token } : undefined });

test("create a project, see it listed, and keep it after a refresh", async ({ page }) => {
  const name = `E2E ${Date.now()}`;
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Description (optional)").fill("created by the browser test");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  await page.goto(`/projects?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("link", { name })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name })).toBeVisible();
});

test("edit persists, archive hides the project from the active list", async ({ page }) => {
  const name = `E2E edit ${Date.now()}`;
  await page.goto("/projects?new=1");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  await page.getByLabel("Description").fill("edited");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.reload();
  await expect(page.getByLabel("Description")).toHaveValue("edited");

  await page.getByRole("button", { name: "Archive" }).click();
  await page.getByRole("button", { name: "Archive project" }).click();
  await expect(page.getByText("This project is archived")).toBeVisible();
  await page.goto(`/projects?q=${encodeURIComponent(name)}`);
  await expect(page.getByText("No projects match")).toBeVisible();
});

test("future sections are honest and settings shows a real status", async ({ page }) => {
  await page.goto("/test-lab");
  await expect(page.getByText("This section is not implemented yet.")).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByText("ElevenLabs Agents API")).toBeVisible();
});
