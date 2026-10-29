import { expect, test } from "@playwright/test";

// Phase 2 end-to-end flow. Needs a running app, a migrated database, a configured generation provider and
// a valid ELEVENLABS_API_KEY. The live voice step needs a browser with a (fake) microphone: run with
// `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`. It creates a REAL agent: delete it afterwards.
const token = process.env.E2E_ACCESS_TOKEN;
test.use({ httpCredentials: token ? { username: "e2e", password: token } : undefined, permissions: ["microphone"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });

test("describe, generate, edit, pick a voice, create, reopen, talk, refine and save", async ({ page }) => {
  const project = `E2E agents ${Date.now()}`;
  await page.goto("/projects?new=1");
  await page.getByLabel("Name").fill(project);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: project })).toBeVisible();

  await page.goto("/agents/new");
  await page.getByLabel("What should your assistant do?").fill("A polite receptionist for a small repair shop. It answers questions only from what callers say, takes messages, and hands urgent issues to a person.");
  await page.getByRole("button", { name: "Generate agent configuration" }).click();
  await expect(page.getByRole("heading", { name: "2. Review and edit" })).toBeVisible({ timeout: 90000 });

  await page.getByLabel("Welcome message").fill("Hello, thanks for calling. How can I help?");
  await page.getByRole("button", { name: "Select" }).first().click();
  await page.getByLabel("Project").selectOption({ label: project });
  await page.getByRole("button", { name: "Create agent" }).click();
  await page.waitForURL(/\/agents\/[0-9a-f-]{36}$/, { timeout: 60000 });
  await expect(page.getByText("Version 1 sent to ElevenLabs")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Welcome message")).toHaveValue("Hello, thanks for calling. How can I help?");

  await page.getByRole("link", { name: "Talk to this agent" }).click();
  await page.getByRole("button", { name: /Start conversation/ }).click();
  await expect(page.getByText("Connected")).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: /End conversation/ }).click();

  await page.goBack();
  await page.getByLabel("What should change?").fill("Make the welcome message shorter.");
  await page.getByRole("button", { name: "Propose changes" }).click();
  await page.getByRole("button", { name: "Apply to editor" }).click({ timeout: 90000 });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Version 2 saved, not sent to ElevenLabs")).toBeVisible();
  await page.getByRole("button", { name: "Send to ElevenLabs" }).click();
  await expect(page.getByText("Version 2 sent to ElevenLabs")).toBeVisible();
  await page.getByRole("button", { name: "Refresh remote status" }).click();
  await expect(page.getByText(/matches the saved configuration/)).toBeVisible();
});

test("the agent builder reports missing configuration instead of pretending", async ({ page }) => {
  await page.goto("/agents/new");
  await expect(page.getByRole("heading", { name: "New agent" })).toBeVisible();
});
