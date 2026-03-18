/**
 * Section 7 – embed.js Integration
 *
 * These tests load a minimal HTML page that embeds the widget via the public
 * embed.js script, exactly as an external site would use it.
 *
 * Tests marked [LIVE] require LIVE_INFRA=1 and a running LiveKit agent.
 *
 * NOTE: The current embed.js implementation does NOT forward `data-tenant-id`
 * into the iframe src (the iframe src is built as
 * `{widgetUrl}/widget?title={title}` without tenantId).  Tests 7.1–7.2
 * verify the FAB/panel mechanics and note this gap.  If embed.js is updated
 * to include tenantId, the iframe-src assertions below should be updated.
 */

import { test, expect, liveOnly } from "./helpers/fixtures";

// ---------------------------------------------------------------------------
// Helper: build an inline data-URI HTML page that embeds the widget
// ---------------------------------------------------------------------------

function embedHtml({
  position = "bottom-right",
  accentColor = "#6366f1",
  tenantId = "tenant2",
  title = "Body&Soul",
  widgetUrl = "http://localhost:3000",
}: {
  position?: string;
  accentColor?: string;
  tenantId?: string;
  title?: string;
  widgetUrl?: string;
} = {}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Embed test</title></head>
<body>
  <p>Host page</p>
  <script
    src="${widgetUrl}/embed.js"
    data-widget-url="${widgetUrl}"
    data-title="${title}"
    data-tenant-id="${tenantId}"
    data-accent-color="${accentColor}"
    data-position="${position}"
  ></script>
</body>
</html>
  `.trim();
}

// ---------------------------------------------------------------------------
// 7.1  FAB renders and toggles the panel
// ---------------------------------------------------------------------------

test("7.1a FAB renders with the correct accent colour", async ({ page }) => {
  await page.setContent(embedHtml({ accentColor: "#6366f1" }));
  await page.waitForLoadState("networkidle");

  const fab = page.locator("#lk-widget-fab");
  await expect(fab).toBeVisible();

  const bg = await fab.evaluate((el) => getComputedStyle(el).backgroundColor);
  // rgb(99, 102, 241) is the RGB equivalent of #6366f1
  expect(bg).toBe("rgb(99, 102, 241)");
});

test("7.1b clicking FAB opens the panel", async ({ page }) => {
  await page.setContent(embedHtml());
  await page.waitForLoadState("networkidle");

  const panel = page.locator("#lk-widget-panel");

  // Panel is hidden initially (no lk-open class)
  await expect(panel).not.toHaveClass(/lk-open/);

  // Open
  await page.locator("#lk-widget-fab").click();
  await expect(panel).toHaveClass(/lk-open/);

  // Iframe should be created lazily on first open
  const iframe = page.locator("#lk-widget-iframe");
  await expect(iframe).toBeVisible();
});

test("7.1c clicking FAB again closes the panel", async ({ page }) => {
  await page.setContent(embedHtml());
  await page.waitForLoadState("networkidle");

  // Open then close
  await page.locator("#lk-widget-fab").click();
  await expect(page.locator("#lk-widget-panel")).toHaveClass(/lk-open/);

  await page.locator("#lk-widget-fab").click();
  await expect(page.locator("#lk-widget-panel")).not.toHaveClass(/lk-open/);

  // Iframe must remain in DOM (no reload on reopen)
  await expect(page.locator("#lk-widget-iframe")).toBeAttached();
});

test("7.1d iframe src includes the title param", async ({ page }) => {
  await page.setContent(embedHtml({ title: "Body&Soul" }));
  await page.waitForLoadState("networkidle");
  await page.locator("#lk-widget-fab").click();

  const src = await page.locator("#lk-widget-iframe").getAttribute("src");
  expect(src).toContain("title=Body%26Soul");
});

// ---------------------------------------------------------------------------
// NOTE: embed.js currently does NOT include tenantId in the iframe src.
// The test below documents this gap; it will fail until embed.js is fixed.
// ---------------------------------------------------------------------------
test("7.1e [expected-fail] iframe src includes tenantId (gap in embed.js)", async ({
  page,
}) => {
  test.fail(
    true,
    "embed.js does not yet forward data-tenant-id into the iframe src. " +
      "When fixed, this test should pass and the .fail() annotation removed."
  );

  await page.setContent(embedHtml({ tenantId: "tenant2" }));
  await page.waitForLoadState("networkidle");
  await page.locator("#lk-widget-fab").click();

  const src = await page.locator("#lk-widget-iframe").getAttribute("src");
  expect(src).toContain("tenantId=tenant2");
});

// ---------------------------------------------------------------------------
// 7.2  Position: bottom-left
// ---------------------------------------------------------------------------

test("7.2 data-position=bottom-left places FAB on the left", async ({
  page,
}) => {
  await page.setContent(embedHtml({ position: "bottom-left" }));
  await page.waitForLoadState("networkidle");

  const fab = page.locator("#lk-widget-fab");
  const style = await fab.evaluate((el) => getComputedStyle(el).left);

  // When position is bottom-left the FAB uses `left: 24px` instead of `right`
  expect(parseInt(style)).toBeGreaterThan(0);

  // Verify the panel is also on the left
  await fab.click();
  const panelStyle = await page
    .locator("#lk-widget-panel")
    .evaluate((el) => getComputedStyle(el).left);
  expect(parseInt(panelStyle)).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// 7.3  JavaScript API – LkWidget.open/close/toggle/on/off
// ---------------------------------------------------------------------------

test("7.3a LkWidget.open() opens the panel", async ({ page }) => {
  await page.setContent(embedHtml());
  await page.waitForLoadState("networkidle");

  await page.evaluate(() => (window as Record<string, unknown> & { LkWidget: { open(): void } }).LkWidget.open());
  await expect(page.locator("#lk-widget-panel")).toHaveClass(/lk-open/);
});

test("7.3b LkWidget.close() closes the panel", async ({ page }) => {
  await page.setContent(embedHtml());
  await page.waitForLoadState("networkidle");

  // Open first
  await page.locator("#lk-widget-fab").click();
  await expect(page.locator("#lk-widget-panel")).toHaveClass(/lk-open/);

  await page.evaluate(() => (window as Record<string, unknown> & { LkWidget: { close(): void } }).LkWidget.close());
  await expect(page.locator("#lk-widget-panel")).not.toHaveClass(/lk-open/);
});

test("7.3c LkWidget.toggle() alternates open/closed state", async ({
  page,
}) => {
  await page.setContent(embedHtml());
  await page.waitForLoadState("networkidle");

  const panel = page.locator("#lk-widget-panel");
  await expect(panel).not.toHaveClass(/lk-open/);

  await page.evaluate(() => (window as Record<string, unknown> & { LkWidget: { toggle(): void } }).LkWidget.toggle());
  await expect(panel).toHaveClass(/lk-open/);

  await page.evaluate(() => (window as Record<string, unknown> & { LkWidget: { toggle(): void } }).LkWidget.toggle());
  await expect(panel).not.toHaveClass(/lk-open/);
});

test("7.3d LkWidget.on('open') fires when panel opens", async ({ page }) => {
  await page.setContent(embedHtml());
  await page.waitForLoadState("networkidle");

  const fired = await page.evaluate(() => {
    return new Promise<boolean>((resolve) => {
      (window as Record<string, unknown> & { LkWidget: { on(e: string, fn: () => void): void; open(): void } }).LkWidget.on("open", () => resolve(true));
      (window as Record<string, unknown> & { LkWidget: { open(): void } }).LkWidget.open();
    });
  });

  expect(fired).toBe(true);
});

test("7.3e LkWidget.on('close') fires when panel closes", async ({ page }) => {
  await page.setContent(embedHtml());
  await page.waitForLoadState("networkidle");

  await page.locator("#lk-widget-fab").click(); // open first

  const fired = await page.evaluate(() => {
    return new Promise<boolean>((resolve) => {
      (window as Record<string, unknown> & { LkWidget: { on(e: string, fn: () => void): void; close(): void } }).LkWidget.on("close", () => resolve(true));
      (window as Record<string, unknown> & { LkWidget: { close(): void } }).LkWidget.close();
    });
  });

  expect(fired).toBe(true);
});

// ---------------------------------------------------------------------------
// 7.4  [LIVE] postMessage events from iframe → host page
// ---------------------------------------------------------------------------

test("7.4 [LIVE] widget postMessage lifecycle: ready → connected → disconnected → closed", async ({
  page,
}) => {
  liveOnly();
  test.setTimeout(60_000);

  await page.setContent(embedHtml());
  await page.waitForLoadState("networkidle");

  // Collect events from the iframe via the embed.js message relay
  const events: string[] = [];
  await page.evaluate(() => {
    const w = window as Record<string, unknown> & {
      LkWidget: { on(e: string, fn: (d: unknown) => void): void };
      __lkEvents: string[];
    };
    w.__lkEvents = [];
    for (const ev of ["ready", "connected", "agent-state", "disconnected", "closed"]) {
      w.LkWidget.on(ev, () => w.__lkEvents.push(ev));
    }
  });

  // Open the panel
  await page.locator("#lk-widget-fab").click();

  // Grant mic inside the iframe context
  await page.context().grantPermissions(["microphone"]);

  // Start a session inside the iframe
  const iframeEl = page.locator("#lk-widget-iframe");
  const frame = await iframeEl.contentFrame();
  if (!frame) throw new Error("Could not access iframe content frame");
  await frame.getByRole("button", { name: "Start a conversation" }).click();

  // Wait until connected
  await frame.getByText("listening").waitFor({ timeout: 30_000 });

  // Disconnect inside the iframe
  await frame.getByRole("button", { name: "Close" }).click();

  // Allow events to propagate
  await page.waitForTimeout(1_000);

  events.push(
    ...(await page.evaluate(
      () =>
        (window as Record<string, unknown> & { __lkEvents: string[] }).__lkEvents
    ))
  );

  expect(events).toContain("ready");
  expect(events).toContain("connected");
  expect(events).toContain("disconnected");
});
