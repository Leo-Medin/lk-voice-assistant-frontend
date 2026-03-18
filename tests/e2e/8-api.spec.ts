/**
 * Section 8 – API Smoke Tests
 *
 * All tests here use Playwright's `request` fixture to make raw HTTP requests.
 * No auth cookie or LiveKit infrastructure required.
 */

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// /api/connection-details
// ---------------------------------------------------------------------------

test("8.1 GET /api/connection-details without tenantId → 400", async ({
  request,
}) => {
  const res = await request.get("/api/connection-details");
  expect(res.status()).toBe(400);

  const body = await res.json();
  expect(body.error).toMatch(/tenantId/i);
});

test("8.2 GET /api/connection-details with unknown tenant → 400", async ({
  request,
}) => {
  const res = await request.get("/api/connection-details?tenantId=xyz_unknown");
  expect(res.status()).toBe(400);

  const body = await res.json();
  expect(body.error).toMatch(/unknown tenant/i);
});

test("8.3 GET /api/connection-details with valid tenant → 200 with expected fields", async ({
  request,
}) => {
  const res = await request.get("/api/connection-details?tenantId=tenant2");
  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body).toHaveProperty("serverUrl");
  expect(body).toHaveProperty("roomName");
  expect(body).toHaveProperty("participantToken");
  expect(body).toHaveProperty("participantName");

  // serverUrl should look like a WebSocket URL
  expect(body.serverUrl).toMatch(/^wss?:\/\//);

  // roomName should be scoped to the tenant
  expect(body.roomName).toMatch(/^tenant2-/);
});

// ---------------------------------------------------------------------------
// /api/warmup
// ---------------------------------------------------------------------------

test("8.4 GET /api/warmup → 200 with ok property", async ({ request }) => {
  const res = await request.get("/api/warmup");
  expect(res.status()).toBe(200);

  const body = await res.json();
  // ok can be true or false (skipped if LK env vars not set), but must be present
  expect(body).toHaveProperty("ok");
  expect(typeof body.ok).toBe("boolean");
});

// ---------------------------------------------------------------------------
// /api/auth
// ---------------------------------------------------------------------------

test("8.5 POST /api/auth with wrong password → 401", async ({ request }) => {
  const res = await request.post("/api/auth", {
    data: { password: "wrongpassword" },
  });
  expect(res.status()).toBe(401);

  const body = await res.json();
  expect(body.error).toMatch(/invalid password/i);
});

test("8.6 POST /api/auth with correct password → 200 + cookie set", async ({
  request,
}) => {
  const res = await request.post("/api/auth", {
    data: { password: "25364888" },
  });
  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.ok).toBe(true);

  // Cookie should be set in the response headers
  const headers = res.headers();
  expect(headers["set-cookie"]).toMatch(/mvp_auth/);
});
