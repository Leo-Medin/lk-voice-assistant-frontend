# Voice assistant with OpenAI agent and enabled web search (frontend).

## Development setup

Copy `.env.example` to `.env.local` and fill in all required values:

```env
# LiveKit server
LIVEKIT_URL=wss://...
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# AWS — used to validate tenantId against the S3 registry
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
KB_S3_BUCKET=your-bucket-name
KB_S3_REGION=eu-central-1
```

```shell
pnpm install
pnpm dev
# Open http://localhost:3000 in your browser.
```

## Multi-tenant routing

Every page and API endpoint is tenant-scoped via a `tenantId` query parameter.

| URL | Description |
|---|---|
| `http://localhost:3000/?tenantId=autolife` | Full-page UI for tenant `autolife` |
| `http://localhost:3000/widget?tenantId=autolife&title=Autolife` | Embeddable widget for tenant `autolife` |

If `tenantId` is omitted, it defaults to `autolife`.

`/api/connection-details` validates the requested `tenantId` against `tenants/registry.json` in S3 (the same registry managed by `lk-kb-admin`). Unknown or admin-only tenants receive a `400` response. New tenants created through the admin UI are automatically accepted — no code changes or redeployment needed.

The room name passed to the LiveKit agent encodes the tenant: `{tenantId}-room-{random}`. The agent uses this prefix to load the correct KB and config from S3.

---

## Embeddable Widget

The assistant can be embedded on any external website as a floating chat button — similar to Intercom or Crisp.

### How it works

```
External host page
  └── embed.js (loaded via <script> tag)
        └── Injects floating FAB button + iframe pointing to /widget?tenantId=...
              └── app/widget/page.tsx (self-contained React UI)
                    └── Calls /api/connection-details?tenantId=... (same origin — no CORS needed)
```

The iframe provides hard CSS isolation and sandboxes the LiveKit/WebRTC stack from the host page. The `allow="microphone"` attribute on the iframe grants mic access.

The `/widget` page and `/api/connection-details` endpoint are **public** (no auth cookie required).

### Drop-in script tag

```html
<script
  src="https://yourapp.com/embed.js"
  data-widget-url="https://yourapp.com"
  data-title="AI Assistant"
  data-tenant-id="autolife"
  data-position="bottom-right"
  data-accent-color="#f97316"
  async
></script>
```

### Configuration attributes

| Attribute | Default | Description |
|---|---|---|
| `data-widget-url` | *(required on external sites)* | Base URL of the hosted Next.js app |
| `data-title` | `"AI Assistant"` | Title shown in the widget header |
| `data-tenant-id` | `"autolife"` | Tenant identifier — must exist in the S3 registry |
| `data-position` | `"bottom-right"` | `"bottom-right"` or `"bottom-left"` |
| `data-accent-color` | `"#f97316"` | FAB button background color |
| `data-z-index` | `9999` | CSS z-index of the FAB |

### JavaScript API

After the script loads, `window.LkWidget` is available:

```js
LkWidget.open();
LkWidget.close();
LkWidget.toggle();

LkWidget.on('connected', () => console.log('user started a session'));
LkWidget.on('disconnected', () => console.log('session ended'));
LkWidget.on('closed', () => console.log('widget panel closed'));
LkWidget.on('agent-state', ({ state }) => console.log('agent state:', state));

LkWidget.off('connected', myHandler);
```

### postMessage events

The widget iframe emits these events to `window.parent`:

| `type` | When |
|---|---|
| `lk-widget:ready` | iframe mounted |
| `lk-widget:connected` | agent enters listening or speaking state |
| `lk-widget:disconnected` | session disconnected |
| `lk-widget:closed` | user clicks the header close button |
| `lk-widget:agent-state` | any agent state change (includes `state` field) |

### Safari iOS caveat

Safari on iOS **does not allow microphone access inside cross-origin iframes**. If `embed.js` is loaded on a different domain (e.g. `dealer.example.com`), iOS Safari users cannot use the mic. The widget will display a notification via the `NoAgentNotification` component when mic permission fails.
