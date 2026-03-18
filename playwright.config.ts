import { defineConfig, devices } from "@playwright/test";

/**
 * E2E test configuration.
 *
 * Prerequisites (must be running before any test):
 *   pnpm dev  →  http://localhost:3000
 *
 * Optional: set LIVE_INFRA=1 to also run tests that require a real LiveKit
 * agent (lk-multimodal-agent-node) and a real LiveKit server.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },

  // Run tests sequentially – auth state and cookie checks are easier to
  // reason about without parallel workers sharing the same server.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "safari",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
