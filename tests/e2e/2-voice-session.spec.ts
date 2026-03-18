/**
 * Section 2 – Full-page Voice Session
 *
 * Tests marked [LIVE] require LIVE_INFRA=1 and a running LiveKit agent.
 * Tests without that marker run against the dev server only.
 */

import { test, expect, liveOnly, FAKE_CONN_DETAILS } from "./helpers/fixtures";

// ---------------------------------------------------------------------------
// 2.1  [LIVE] Happy path – full voice conversation
// ---------------------------------------------------------------------------

test("2.1 [LIVE] voice session connects and agent reaches listening state", async ({
  authedPage: page,
}) => {
  liveOnly();
  await page.goto("/?tenantId=tenant2");
  await page.context().grantPermissions(["microphone"]);

  await page.getByRole("button", { name: "Start Voice Session" }).click();

  // Status should progress from disconnected → connecting → listening
  await expect(page.getByText("listening")).toBeVisible({ timeout: 30_000 });

  // Bar visualizer should be present
  await expect(page.locator(".agent-visualizer")).toBeVisible();

  // Disconnect
  await page.getByRole("button", { name: "Close" }).click();

  // Session ends; start buttons return
  await expect(
    page.getByRole("button", { name: "Start Voice Session" })
  ).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// 2.2  [LIVE] Ready and stop audio cues
// ---------------------------------------------------------------------------

test("2.2 [LIVE] start button connects and disconnect returns start buttons", async ({
  authedPage: page,
}) => {
  liveOnly();
  await page.goto("/?tenantId=tenant2");
  await page.context().grantPermissions(["microphone"]);

  await page.getByRole("button", { name: "Start Voice Session" }).click();

  // Wait until agent is listening (ready cue should have fired by then)
  await expect(page.getByText("listening")).toBeVisible({ timeout: 30_000 });

  // Disconnect and verify stop cue path (we can't hear audio but can verify
  // that the session ends cleanly and the UI returns to the initial state)
  await page.getByRole("button", { name: "Close" }).click();
  await expect(
    page.getByRole("button", { name: "Start Voice Session" })
  ).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// 2.3  Noisy Environment Mode (push-to-talk) – UI-only part
// ---------------------------------------------------------------------------

test("2.3a noisy mode checkbox is visible on the main page", async ({
  authedPage: page,
}) => {
  await page.goto("/?tenantId=tenant2");

  const checkbox = page.locator("#noisy-mode");
  await expect(checkbox).toBeVisible();
  await expect(checkbox).not.toBeChecked();

  const label = page.getByText("Noisy Environment Mode");
  await expect(label).toBeVisible();
});

test("2.3b checking noisy mode does not immediately show hold-to-talk (needs connected state)", async ({
  authedPage: page,
}) => {
  await page.goto("/?tenantId=tenant2");

  // The "Hold to talk" button only appears when agent is listening/speaking
  // AND noisyMode is enabled. In disconnected state it must be absent.
  await page.locator("#noisy-mode").check();
  await expect(page.getByText("Hold to talk")).not.toBeVisible();
});

test("2.3c [LIVE] hold-to-talk button appears in connected + noisy mode", async ({
  authedPage: page,
}) => {
  liveOnly();
  await page.goto("/?tenantId=tenant2");
  await page.context().grantPermissions(["microphone"]);

  await page.getByRole("button", { name: "Start Voice Session" }).click();
  await expect(page.getByText("listening")).toBeVisible({ timeout: 30_000 });

  // Enable noisy mode while connected
  await page.locator("#noisy-mode").check();

  // Hold-to-talk button should appear
  await expect(page.getByText("Hold to talk")).toBeVisible();

  // Cleanup
  await page.getByRole("button", { name: "Close" }).click();
});

// ---------------------------------------------------------------------------
// 2.4  [LIVE] Inactivity auto-disconnect (15 s silence)
// ---------------------------------------------------------------------------

test("2.4 [LIVE] inactivity auto-disconnects after 15 seconds of silence", async ({
  authedPage: page,
}) => {
  liveOnly();
  // Speed up the inactivity timeout via a shorter real-time wait.
  // This test naturally takes ~20 s end-to-end.
  test.setTimeout(60_000);

  await page.goto("/?tenantId=tenant2");
  await page.context().grantPermissions(["microphone"]);

  await page.getByRole("button", { name: "Start Voice Session" }).click();
  await expect(page.getByText("listening")).toBeVisible({ timeout: 30_000 });

  // Stay silent – inactivity timer fires after 15 s
  await page.waitForTimeout(17_000);

  // System message "Disconnected due to inactivity." should appear
  await expect(
    page.getByText("Disconnected due to inactivity.")
  ).toBeVisible({ timeout: 5_000 });

  // Session should have ended
  await expect(
    page.getByRole("button", { name: "Start Voice Session" })
  ).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// 2.5  Microphone permission denied → alert shown; session does not start
// ---------------------------------------------------------------------------

test("2.5 mic permission denied shows error alert", async ({
  authedPage: page,
}) => {
  // Do NOT grant microphone permission so getUserMedia rejects
  await page.goto("/?tenantId=tenant2");

  // Intercept the alert dialog
  const dialogPromise = page.waitForEvent("dialog");
  await page.getByRole("button", { name: "Start Voice Session" }).click();
  const dialog = await dialogPromise;

  expect(dialog.message()).toContain(
    "Error acquiring camera or microphone permissions"
  );
  await dialog.accept();

  // Session must NOT have started – buttons should still show
  await expect(
    page.getByRole("button", { name: "Start Voice Session" })
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// 2.6  [LIVE] Network quality indicators visible when connected
// ---------------------------------------------------------------------------

test("2.6 [LIVE] network stats section appears during a session", async ({
  authedPage: page,
}) => {
  liveOnly();
  await page.goto("/?tenantId=tenant2");
  await page.context().grantPermissions(["microphone"]);

  await page.getByRole("button", { name: "Start Voice Session" }).click();
  await expect(page.getByText("listening")).toBeVisible({ timeout: 30_000 });

  // The network health label should be visible
  await expect(page.getByText(/Network:/)).toBeVisible();

  // Cleanup
  await page.getByRole("button", { name: "Close" }).click();
});
