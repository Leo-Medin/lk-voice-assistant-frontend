import { test as base, expect, type Page, type Cookie } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AUTH_COOKIE: Cookie = {
  name: "mvp_auth",
  value: "1",
  domain: "localhost",
  path: "/",
  httpOnly: true,
  secure: false,
  sameSite: "Lax",
  expires: -1,
};

export const CORRECT_PASSWORD = "25364888";

/**
 * Fake LiveKit credentials.  The client will try to connect to this URL and
 * fail immediately (no real server), causing the room to stay in "connecting"
 * state.  That is intentional – it lets us verify UI before any real agent
 * interaction is needed.
 */
export const FAKE_CONN_DETAILS = {
  serverUrl: "wss://fake-livekit.invalid",
  roomName: "test-room-e2e",
  participantToken:
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIifQ.fake",
  participantName: "test-user",
};

// ---------------------------------------------------------------------------
// Skip helper
// ---------------------------------------------------------------------------

/**
 * Call at the top of any test that requires a real LiveKit agent.
 *
 * Usage:
 *   test('some test', async ({ page }) => {
 *     liveOnly();
 *     // ...
 *   });
 *
 * Run the full suite including live-infra tests with:
 *   LIVE_INFRA=1 pnpm test:e2e
 */
export function liveOnly() {
  // `test.skip` must be called inside a test body.
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  base.skip(
    !process.env.LIVE_INFRA,
    "Set LIVE_INFRA=1 to run tests that require a real LiveKit agent"
  );
}

// ---------------------------------------------------------------------------
// Custom fixtures
// ---------------------------------------------------------------------------

type CustomFixtures = {
  /** Page with the mvp_auth cookie already set. */
  authedPage: Page;
};

export const test = base.extend<CustomFixtures>({
  authedPage: async ({ page }, provide) => {
    await page.context().addCookies([AUTH_COOKIE]);
    await provide(page);
  },
});

export { expect };
