/**
 * Section 4 – Tenant Validation
 *
 * Tests marked [LIVE] require a running LiveKit agent.
 * The API-level checks (unknown/admin tenant 400s) run without a real agent.
 */

import { test, expect, liveOnly } from "./helpers/fixtures";

// ---------------------------------------------------------------------------
// 4.1  [LIVE] Valid tenant connects and loads KB
// ---------------------------------------------------------------------------

test("4.1 [LIVE] valid tenant (tenant2) connects to agent", async ({
  authedPage: page,
}) => {
  liveOnly();
  await page.goto("/?tenantId=tenant2");
  await page.context().grantPermissions(["microphone"]);

  await page.getByRole("button", { name: "Start Voice Session" }).click();
  await expect(page.getByText("listening")).toBeVisible({ timeout: 30_000 });

  // Cleanup
  await page.getByRole("button", { name: "Close" }).click();
});

// ---------------------------------------------------------------------------
// 4.2  [LIVE] Missing tenantId defaults to autolife
// ---------------------------------------------------------------------------

test("4.2 [LIVE] missing tenantId defaults to autolife tenant", async ({
  authedPage: page,
}) => {
  liveOnly();
  // No tenantId – should default to "autolife"
  await page.goto("/");
  await page.context().grantPermissions(["microphone"]);

  await page.getByRole("button", { name: "Start Voice Session" }).click();
  await expect(page.getByText("listening")).toBeVisible({ timeout: 30_000 });

  // Cleanup
  await page.getByRole("button", { name: "Close" }).click();
});

// ---------------------------------------------------------------------------
// 4.3  Unknown tenant → API returns 400; NoAgentNotification appears
// ---------------------------------------------------------------------------

test("4.3 unknown tenant shows NoAgentNotification after timeout", async ({
  authedPage: page,
}) => {
  // The /api/connection-details endpoint returns 400 for an unknown tenant.
  // The client code does not check response.ok, so it will parse the error
  // JSON and attempt to connect to LiveKit with undefined credentials.
  // The room stays in "connecting" indefinitely; after 10 s the
  // NoAgentNotification banner appears.
  test.setTimeout(30_000);

  await page.goto("/?tenantId=doesnotexist");
  await page.context().grantPermissions(["microphone"]);

  await page.getByRole("button", { name: "Start Voice Session" }).click();

  // Wait for the NoAgentNotification (10 s internal timer)
  await expect(
    page.getByText(/It.s quiet/)
  ).toBeVisible({ timeout: 20_000 });
});

// ---------------------------------------------------------------------------
// 4.4  Admin tenant → same behaviour as unknown tenant (400 from API)
// ---------------------------------------------------------------------------

test("4.4 admin tenant is rejected and never connects (NoAgentNotification)", async ({
  authedPage: page,
}) => {
  test.setTimeout(30_000);

  await page.goto("/?tenantId=admin");
  await page.context().grantPermissions(["microphone"]);

  await page.getByRole("button", { name: "Start Voice Session" }).click();

  // Verify the API actually returns 400 for the admin tenant
  const [apiResponse] = await Promise.all([
    page.waitForResponse((res) =>
      res.url().includes("/api/connection-details") &&
      res.request().method() === "GET"
    ),
  ]);
  expect(apiResponse.status()).toBe(400);

  // NoAgentNotification should appear after 10 s
  await expect(
    page.getByText(/It.s quiet/)
  ).toBeVisible({ timeout: 20_000 });
});
