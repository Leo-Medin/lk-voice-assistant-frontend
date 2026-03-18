# Testing

## Overview

The test suite is Playwright-based and covers the full test plan across all surfaces (full-page UI, widget iframe, embed.js integration) and all supporting flows (auth, tenant validation, inactivity, session cues, citations, API contracts).

Tests are split into two tiers:

| Tier | Requires | Run with |
|------|----------|----------|
| **Automated** | `pnpm dev` running | `pnpm test:e2e` |
| **Live-infra** | dev server + LiveKit agent | `LIVE_INFRA=1 pnpm test:e2e` |

Live-infra tests are skipped automatically unless `LIVE_INFRA=1` is set. They are clearly labelled `[LIVE]` in both their test names and inline with `liveOnly()`.

---

## Prerequisites

```
# Terminal 1 — Next.js dev server
pnpm dev

# Terminal 2 — LiveKit agent (live-infra tests only)
node dist/agent.js dev          # lk-multimodal-agent-node
```

For live-infra tests the browser also needs microphone permission. Playwright grants this automatically via `page.context().grantPermissions(['microphone'])` — no manual browser step required.

Install Playwright browsers once after cloning:

```bash
pnpm exec playwright install chromium
# or install all browsers:
pnpm exec playwright install
```

---

## Running the tests

```bash
# Automated subset only (no agent needed) — the default
pnpm test:e2e

# Full suite including live-infra tests
pnpm test:e2e:live

# Interactive Playwright UI (great for debugging)
pnpm test:e2e:ui

# Run a single file
pnpm test:e2e -- tests/e2e/8-api.spec.ts

# Run tests matching a pattern
pnpm test:e2e -- --grep "auth"

# Chromium only (skip Safari)
pnpm test:e2e -- --project=chromium
```

HTML report is written to `playwright-report/` after each run and can be opened with:

```bash
pnpm exec playwright show-report
```

---

## File layout

```
playwright.config.ts              # Playwright config (baseURL, browsers, timeouts)

tests/e2e/
  helpers/
    fixtures.ts                   # authedPage fixture, liveOnly() helper, shared constants

  1-auth.spec.ts                  # Section 1 – Authentication (fully automated)
  2-voice-session.spec.ts         # Section 2 – Full-page voice session
  3-text-session.spec.ts          # Section 3 – Full-page text session
  4-tenant.spec.ts                # Section 4 – Tenant validation
  5-transcriptions.spec.ts        # Section 5 – Transcriptions
  6-widget.spec.ts                # Section 6 – Widget iframe (/widget)
  7-embed.spec.ts                 # Section 7 – embed.js integration
  8-api.spec.ts                   # Section 8 – API smoke tests (fully automated)
  9-regression.spec.ts            # Section 9 – Regression checks
```

---

## What each file covers

### 1-auth.spec.ts — fully automated

| Test | What it checks |
|------|---------------|
| 1.1 | Unauthenticated visit to `/` redirects to `/login?next=%2F` |
| 1.2 | Wrong password shows "Invalid password"; no cookie set; stays on login page |
| 1.3 | Correct password sets `mvp_auth=1` cookie and redirects away from login |
| 1.4 | `?next=` param is followed after successful login |
| 1.5a | `/widget` loads without auth cookie (public path) |
| 1.5b | `/api/warmup` returns 200 without auth cookie |

### 2-voice-session.spec.ts

| Test | Tier | What it checks |
|------|------|---------------|
| 2.1 | LIVE | Session connects; status reaches "listening"; disconnect returns start buttons |
| 2.2 | LIVE | Start/disconnect cycle completes cleanly |
| 2.3a | auto | Noisy mode checkbox is visible on the main page in the disconnected state |
| 2.3b | auto | "Hold to talk" button is absent when disconnected (requires connected+listening state) |
| 2.3c | LIVE | "Hold to talk" button appears when connected and noisy mode is enabled |
| 2.4 | LIVE | Voice session auto-disconnects after 15 s of silence; inactivity message shown |
| 2.5 | auto | Mic permission denied → alert with error message; session does not start |
| 2.6 | LIVE | Network stats section (`Network: …`) appears during an active session |

### 3-text-session.spec.ts

| Test | Tier | What it checks |
|------|------|---------------|
| 3.1a | auto | "Start Text Session" does not trigger a mic permission dialog |
| 3.1b | LIVE | Noisy mode checkbox is hidden in text session mode |
| 3.1c | LIVE | Text input appears; typing and sending adds a green "You:" bubble |
| 3.2 | LIVE | Text session auto-disconnects after 5 min of inactivity |

### 4-tenant.spec.ts

| Test | Tier | What it checks |
|------|------|---------------|
| 4.1 | LIVE | Valid tenant (`tenant2`) connects |
| 4.2 | LIVE | Missing `tenantId` defaults to `autolife` |
| 4.3 | auto | Unknown tenant → API returns 400 → `NoAgentNotification` banner appears after 10 s |
| 4.4 | auto | Admin tenant → API returns 400 → same notification behaviour |

### 5-transcriptions.spec.ts — all LIVE

| Test | What it checks |
|------|---------------|
| 5.1 | Agent bubbles are gray/left-aligned; `Agent` label present |
| 5.3 | Transcription container renders; short utterances are not filtered |
| 5.4 | Citation pills appear when agent sends citation data |

> **5.2 (unrecognised language placeholder)** is documented as manual-only. It requires speaking in a language outside EN/EL/RU during a live session. The detection logic is in `app/components/Transcriptions.tsx:detectLangByScript()`.

### 6-widget.spec.ts

| Test | Tier | What it checks |
|------|------|---------------|
| 6.1 | auto | `/widget` without `tenantId` renders "Missing required parameter: `tenantId`" |
| 6.2a | auto | Widget header shows the `?title=` param value |
| 6.2b | auto | "Start a conversation" button is visible on load |
| 6.2c | LIVE | Widget voice session connects |
| 6.3 | auto | Close button emits `lk-widget:closed` postMessage |
| 6.4 | auto | `lk-widget:ready` is emitted on page mount |

### 7-embed.spec.ts

| Test | Tier | What it checks |
|------|------|---------------|
| 7.1a | auto | FAB renders with correct accent colour |
| 7.1b | auto | Clicking FAB opens the panel and lazily creates the iframe |
| 7.1c | auto | Clicking FAB again closes the panel; iframe stays in DOM |
| 7.1d | auto | Iframe src includes `title=` param |
| 7.1e | auto | **Expected-fail** — iframe src is missing `tenantId` (known gap, see below) |
| 7.2 | auto | `data-position="bottom-left"` places FAB on the left |
| 7.3a–e | auto | `LkWidget.open/close/toggle/on/off` JavaScript API |
| 7.4 | LIVE | postMessage lifecycle: `ready → connected → disconnected` |

### 8-api.spec.ts — fully automated

| Test | Request | Expected |
|------|---------|----------|
| 8.1 | `GET /api/connection-details` | 400 — missing `tenantId` |
| 8.2 | `GET /api/connection-details?tenantId=xyz_unknown` | 400 — unknown tenant |
| 8.3 | `GET /api/connection-details?tenantId=tenant2` | 200 — `serverUrl`, `roomName`, `participantToken`, `participantName` |
| 8.4 | `GET /api/warmup` | 200 — `{ ok: boolean }` |
| 8.5 | `POST /api/auth` wrong password | 401 — `{ error: "Invalid password" }` |
| 8.6 | `POST /api/auth` correct password | 200 — `{ ok: true }` + `Set-Cookie: mvp_auth` |

### 9-regression.spec.ts

| Test | Tier | What it guards |
|------|------|---------------|
| R1 | LIVE | `autolife` tenant still connects after multi-tenant refactor |
| R2 | LIVE | `tenant2` connects; agent responds |
| R3 | auto | `/api/connection-details` honours live registry (not compiled in) |
| R4 | auto | `/widget` without `tenantId` shows error (no crash) |
| R5 | auto + LIVE | `/widget?tenantId=tenant2` shows connect button; LIVE: actually connects |
| R6 | auto + LIVE | Admin tenant returns 400 from API; LIVE: `NoAgentNotification` shown |

---

## Known gap: `embed.js` does not forward `data-tenant-id`

Test **7.1e** is annotated with `test.fail()` to document this. The current `embed.js` builds the iframe src as:

```
{widgetUrl}/widget?title={title}
```

The `data-tenant-id` attribute is accepted by the script tag but not appended to the URL, so the widget iframe always receives `tenantId=undefined` and shows the "Missing required parameter" error when embedded externally.

**Fix needed in `public/embed.js`**: read `data-tenant-id` and include `&tenantId={tenantId}` in `iframeSrc`. Once fixed, remove the `test.fail()` annotation from 7.1e.

---

## Shared fixtures (`tests/e2e/helpers/fixtures.ts`)

**`authedPage`** — a `Page` with the `mvp_auth=1` cookie pre-set. Use this for any test that accesses a protected route.

```ts
test('example', async ({ authedPage: page }) => {
  await page.goto('/?tenantId=tenant2');
  // ...
});
```

**`liveOnly()`** — skips the current test unless `LIVE_INFRA=1` is set. Call it at the top of any test that needs a real LiveKit agent.

```ts
test('example', async ({ authedPage: page }) => {
  liveOnly();
  // ...
});
```

**`FAKE_CONN_DETAILS`** — fake LiveKit credentials for route-mocking. The client will attempt to connect to `wss://fake-livekit.invalid`, fail, and stay in the "connecting" state — useful for testing UI that only needs the room to be in a connecting/non-disconnected state.

---

## Adding new tests

1. Place the file in `tests/e2e/` following the `N-section.spec.ts` naming convention.
2. Import from `./helpers/fixtures` (not from `@playwright/test` directly) to get `authedPage` and `liveOnly`.
3. Tests that only need the dev server: no extra annotation needed.
4. Tests that need a real LiveKit agent: call `liveOnly()` as the first line of the test body.
5. Keep live-infra tests focused — they're slower and require more infrastructure.
