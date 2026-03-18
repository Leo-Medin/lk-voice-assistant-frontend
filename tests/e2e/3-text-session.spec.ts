/**
 * Section 3 – Full-page Text Session
 *
 * Tests marked [LIVE] require LIVE_INFRA=1 and a running LiveKit agent.
 */

import { test, expect, liveOnly } from "./helpers/fixtures";

// ---------------------------------------------------------------------------
// 3.1  Happy path – UI-level checks (no mic prompt, text input appears)
// ---------------------------------------------------------------------------

test("3.1a Start Text Session does not prompt for microphone", async ({
  authedPage: page,
}) => {
  await page.goto("/?tenantId=tenant2");

  // Listen for any dialog (mic permission or alert)
  let dialogFired = false;
  page.on("dialog", (dialog) => {
    dialogFired = true;
    dialog.accept();
  });

  await page.getByRole("button", { name: "Start Text Session" }).click();

  // Wait a moment – no dialog should fire
  await page.waitForTimeout(2_000);
  expect(dialogFired).toBe(false);
});

test("3.1b Noisy Environment Mode checkbox hidden in text session", async ({
  authedPage: page,
}) => {
  liveOnly();

  await page.goto("/?tenantId=tenant2");
  await page.getByRole("button", { name: "Start Text Session" }).click();

  // Once agent is listening, noisy mode checkbox must be hidden for text mode
  await expect(page.getByText("listening")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#noisy-mode")).not.toBeVisible();
  await expect(page.getByText("Noisy Environment Mode")).not.toBeVisible();
});

test("3.1c [LIVE] text session shows text input and accepts messages", async ({
  authedPage: page,
}) => {
  liveOnly();
  await page.goto("/?tenantId=tenant2");
  await page.getByRole("button", { name: "Start Text Session" }).click();

  // Text input should appear once connected (agent in listening/speaking state)
  const textInput = page.getByPlaceholder("Type a message…");
  await expect(textInput).toBeVisible({ timeout: 30_000 });

  // Send a message
  await textInput.fill("Hello");
  await page.getByRole("button", { name: "Send" }).click();

  // "You: Hello" transcription bubble should appear (green, right-aligned)
  const bubble = page.locator(".bg-green-700").filter({ hasText: "Hello" });
  await expect(bubble).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// 3.2  [LIVE] Inactivity auto-disconnect after 5 minutes (text)
// ---------------------------------------------------------------------------

test("3.2 [LIVE] text session auto-disconnects after 5 minutes of inactivity", async ({
  authedPage: page,
}) => {
  liveOnly();
  // This test is inherently slow; only run it explicitly.
  test.setTimeout(370_000); // 6 min guard

  await page.goto("/?tenantId=tenant2");
  await page.getByRole("button", { name: "Start Text Session" }).click();

  const textInput = page.getByPlaceholder("Type a message…");
  await expect(textInput).toBeVisible({ timeout: 30_000 });

  // Send one message to record activity
  await textInput.fill("Hello");
  await page.getByRole("button", { name: "Send" }).click();

  // Wait 5 min + buffer
  await page.waitForTimeout(310_000);

  await expect(
    page.getByText("Disconnected due to inactivity.")
  ).toBeVisible({ timeout: 10_000 });

  await expect(
    page.getByRole("button", { name: "Start Text Session" })
  ).toBeVisible({ timeout: 10_000 });
});
