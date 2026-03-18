/**
 * Section 1 – Authentication
 *
 * All tests in this file run without any mocking: they hit the real
 * /api/auth endpoint served by the running dev server.
 *
 * Prerequisites:
 *   - pnpm dev running at http://localhost:3000
 *   - mvp_auth cookie NOT set (each test starts with a fresh browser context)
 */

import { test, expect } from "./helpers/fixtures";

// ---------------------------------------------------------------------------
// 1.1  Unauthenticated visit → redirect to /login
// ---------------------------------------------------------------------------

test("1.1 redirects to /login when unauthenticated", async ({ page }) => {
  await page.goto("/");

  // Should land on /login with next param pointing back to /
  await expect(page).toHaveURL(/\/login/);
  await expect(page.url()).toContain("next=%2F");
});

// ---------------------------------------------------------------------------
// 1.2  Wrong password shows error; no cookie; no redirect
// ---------------------------------------------------------------------------

test("1.2 wrong password shows error and stays on login page", async ({
  page,
}) => {
  await page.goto("/login");

  await page.locator('input[type="password"]').fill("wrongpassword");
  await page.getByRole("button", { name: "Unlock" }).click();

  // Error message appears in red
  const errorMsg = page.getByText("Invalid password");
  await expect(errorMsg).toBeVisible();

  // Still on login page
  await expect(page).toHaveURL(/\/login/);

  // Cookie must NOT be set
  const cookies = await page.context().cookies();
  const authCookie = cookies.find((c) => c.name === "mvp_auth");
  expect(authCookie).toBeUndefined();
});

// ---------------------------------------------------------------------------
// 1.3  Correct password → cookie set; redirect to /
// ---------------------------------------------------------------------------

test("1.3 correct password sets cookie and redirects to /", async ({
  page,
}) => {
  await page.goto("/login");

  await page.locator('input[type="password"]').fill("25364888");
  await page.getByRole("button", { name: "Unlock" }).click();

  // Should navigate away from /login
  await expect(page).not.toHaveURL(/\/login/);

  // Cookie must be set
  const cookies = await page.context().cookies();
  const authCookie = cookies.find((c) => c.name === "mvp_auth");
  expect(authCookie).toBeDefined();
  expect(authCookie?.value).toBe("1");
});

// ---------------------------------------------------------------------------
// 1.4  `next` param is honoured after successful login
// ---------------------------------------------------------------------------

test("1.4 next param is followed after login", async ({ page }) => {
  await page.goto("/login?next=%2F%3FtenantId%3Dtenant2");

  await page.locator('input[type="password"]').fill("25364888");
  await page.getByRole("button", { name: "Unlock" }).click();

  // Should end up at /?tenantId=tenant2, not just /
  await expect(page).toHaveURL(/tenantId=tenant2/);
});

// ---------------------------------------------------------------------------
// 1.5  Public paths bypass auth
// ---------------------------------------------------------------------------

test("1.5a /widget loads without auth cookie (no redirect)", async ({
  page,
}) => {
  // Navigate to widget without any auth cookie
  const response = await page.goto("/widget?tenantId=tenant2");

  // Must NOT be redirected to /login
  await expect(page).not.toHaveURL(/\/login/);
  expect(response?.status()).toBeLessThan(400);
});

test("1.5b /api/warmup returns 200 without auth cookie", async ({
  request,
}) => {
  const response = await request.get("/api/warmup");
  expect(response.status()).toBe(200);
  const body = await response.json();
  // ok can be true or false, but the key must exist
  expect(body).toHaveProperty("ok");
});
