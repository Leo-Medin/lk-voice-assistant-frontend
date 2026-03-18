/**
 * Section 6 – Widget iframe surface (/widget)
 *
 * Tests marked [LIVE] require LIVE_INFRA=1 and a running LiveKit agent.
 */

import { test, expect, liveOnly } from "./helpers/fixtures";

// ---------------------------------------------------------------------------
// 6.1  Missing tenantId → error message inside widget; no crash
// ---------------------------------------------------------------------------

test("6.1 /widget without tenantId shows error message", async ({ page }) => {
  // /widget is a public path – no auth cookie needed
  await page.goto("/widget");

  // The widget renders an error instead of the voice UI
  await expect(page.getByText("Missing required parameter:")).toBeVisible();
  await expect(page.locator("code").filter({ hasText: "tenantId" })).toBeVisible();

  // No JS exception should have crashed the page
  // (if the page had crashed we would not have got here)
});

// ---------------------------------------------------------------------------
// 6.2  Happy path voice session inside widget
// ---------------------------------------------------------------------------

test("6.2a /widget with tenantId shows correct header title", async ({
  page,
}) => {
  await page.goto("/widget?tenantId=tenant2&title=Body%26Soul");

  // Widget header should show the title from the URL param
  await expect(page.getByText("Body&Soul")).toBeVisible();
});

test("6.2b /widget shows connect button when loaded", async ({ page }) => {
  await page.goto("/widget?tenantId=tenant2&title=Body%26Soul");

  // The connect button for the widget is labelled differently from the main page
  await expect(
    page.getByRole("button", { name: "Start a conversation" })
  ).toBeVisible();
});

test("6.2c [LIVE] widget voice session connects", async ({ page }) => {
  liveOnly();
  await page.goto("/widget?tenantId=tenant2&title=Body%26Soul");
  await page.context().grantPermissions(["microphone"]);

  await page.getByRole("button", { name: "Start a conversation" }).click();
  await expect(page.getByText("listening")).toBeVisible({ timeout: 30_000 });
});

// ---------------------------------------------------------------------------
// 6.3  Close button emits lk-widget:closed postMessage
// ---------------------------------------------------------------------------

test("6.3 widget close button emits lk-widget:closed postMessage", async ({
  page,
}) => {
  await page.goto("/widget?tenantId=tenant2&title=Test");

  // Listen for postMessage events directed at the parent (same page here)
  const messagePromise = page.evaluate(() => {
    return new Promise<{ type: string }>((resolve) => {
      window.addEventListener("message", (e) => {
        if (e.data?.type === "lk-widget:closed") {
          resolve(e.data);
        }
      });
    });
  });

  // Click the close button
  await page.getByRole("button", { name: "Close widget" }).click();

  const message = await messagePromise;
  expect(message.type).toBe("lk-widget:closed");
});

// ---------------------------------------------------------------------------
// 6.4  lk-widget:ready is emitted on mount
// ---------------------------------------------------------------------------

test("6.4 widget emits lk-widget:ready on page load", async ({ page }) => {
  // Navigate to the widget and immediately capture the ready postMessage
  const messagePromise = page.evaluate(() => {
    return new Promise<{ type: string }>((resolve) => {
      window.addEventListener("message", (e) => {
        if (e.data?.type === "lk-widget:ready") resolve(e.data);
      });
    });
  });

  await page.goto("/widget?tenantId=tenant2");

  const message = await messagePromise;
  expect(message.type).toBe("lk-widget:ready");
});
