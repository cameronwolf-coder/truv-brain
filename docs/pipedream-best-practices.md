# Pipedream Best Practices

Hard-won patterns from building 5+ production Pipedream workflows at Truv. This document is the single source of truth for how we build, test, and deploy Pipedream automations.

---

## Architecture Patterns

### Trigger Types

| Trigger | Use When | Example |
|---------|----------|---------|
| HTTP / Webhook | Real-time, event-driven (HubSpot workflow fires, SendGrid event) | HubSpot Events → Linear sync |
| Schedule (Cron) | Recurring batch jobs | Outreach Intelligence (Fri 7:30 AM CST: `30 13 * * 5` UTC) |
| Manual | One-off or on-demand sends | Notion → SendGrid product update email |

### Step Naming & References

```javascript
// Trigger payload
steps.trigger.event.body          // HTTP webhook body
steps.trigger.event               // Fallback for some webhook shapes

// Robust pattern — always use fallback
const payload = steps.trigger.event.body || steps.trigger.event;

// Named code steps
steps.code.$return_value          // Return value from a code step named "code"
steps.fetch_event.$return_value   // Return value from step named "fetch_event"

// HubSpot built-in actions
steps.search_crm.$return_value?.results || []
```

### Return Value Convention

Every code step should return a clean object describing what happened:

```javascript
return {
  action: "created",       // or "updated", "skipped"
  id: "abc123",
  name: "Human-readable name",
  count: 42,               // if batch operation
};
```

### Graceful Early Exit

Use `$.flow.exit()` to skip runs when there's nothing to do. This prevents empty/broken downstream steps without throwing errors:

```javascript
if (!objectId) {
  $.flow.exit("No objectId found in webhook payload");
}

// For batch operations with no results
if (contacts.length === 0) {
  $.flow.exit("No contacts matched criteria — skipping this run");
}
```

---

## Authentication Patterns

### HubSpot (OAuth via Pipedream App)

```javascript
import { axios } from "@pipedream/platform";

export default defineComponent({
  props: {
    hubspot: {
      type: "app",
      app: "hubspot",
    },
  },
  async run({ steps, $ }) {
    const response = await axios($, {
      url: "https://api.hubapi.com/crm/v3/objects/contacts/search",
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.hubspot.$auth.oauth_access_token}`,
        "Content-Type": "application/json",
      },
      data: { /* ... */ },
    });
  },
});
```

**CRITICAL:** The Pipedream HubSpot app has NO `makeRequest` method. Always use `axios` with `this.hubspot.$auth.oauth_access_token`.

### SendGrid (Pipedream App)

SendGrid's Pipedream app DOES have `makeRequest`:

```javascript
await this.sendgrid.makeRequest({
  method: "POST",
  path: "/v3/mail/send",
  data: { /* ... */ },
});
```

### Linear (Environment Variable)

Linear API key goes in Pipedream's environment variables (Settings → Environment Variables), not as an app connection:

```javascript
const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

await axios($, {
  method: "POST",
  url: "https://api.linear.app/graphql",
  headers: {
    Authorization: LINEAR_API_KEY,  // NO "Bearer" prefix — just the raw key
    "Content-Type": "application/json",
  },
  data: { query, variables },
});
```

### Axios Import — Two Variants

```javascript
// Pattern 1: Pipedream's axios wrapper (most steps)
// Requires $ as first arg, auto-throws on non-2xx
import { axios } from "@pipedream/platform";
await axios($, { url, method, headers, data });

// Pattern 2: Bare axios (for steps that need raw response handling)
// Used in SendGrid → HubSpot logging step
import axios from "axios";
const response = await axios.post(url, data, { headers });
```

---

## Browser Automation (agent-browser)

### Session Login — One-Time Setup

Pipedream requires browser login. Use headed mode for initial auth, then the session persists for headless use:

```bash
# First time: headed browser, user logs in manually
agent-browser --headed --session-name pipedream open https://pipedream.com/

# After login: headless works with saved session
agent-browser --session-name pipedream open https://pipedream.com/workflows
```

**Saved sessions:** `pipedream`, `hubspot`, `sendgrid`, `knock`

### CodeMirror Code Insertion — THE Technique

Pipedream's code editor uses CodeMirror. Standard `fill` and `type` commands don't work. This is the only reliable method:

```bash
# Step 1: Write code to temp file
# /tmp/pd-step-N.js

# Step 2: JSON-escape the code (handles newlines, quotes, special chars)
ESCAPED=$(python3 -c "import json; print(json.dumps(open('/tmp/pd-step-N.js').read()))")

# Step 3: Focus the editor, select all, delete, insert
agent-browser --session-name pipedream eval "(() => {
  const editor = document.querySelector('.cm-content');
  if (!editor) return 'no editor found';
  editor.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  sel.removeAllRanges();
  sel.addRange(range);
  document.execCommand('delete');
  document.execCommand('insertText', false, ${ESCAPED});
  return 'code inserted';
})()"
```

**Why this works:** CodeMirror intercepts all standard input events. `execCommand('insertText')` fires through the browser's native editing pipeline, which CodeMirror does listen to. Clipboard APIs, `.value` setter, and `dispatchEvent(new InputEvent(...))` all fail.

### HubSpot Iframe Handling

HubSpot forms live inside nested iframes. The Create/Edit form for custom objects is in iframe #5 (the `object-builder` embed):

```javascript
// React-controlled inputs (textareas, text inputs)
const setter = Object.getOwnPropertyDescriptor(
  window.HTMLTextAreaElement.prototype, "value"
).set;
setter.call(textarea, "New Value");
textarea.dispatchEvent(new Event("input", { bubbles: true }));
textarea.dispatchEvent(new Event("change", { bubbles: true }));

// React-controlled dropdowns
button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
```

### Pipedream UI Navigation

```bash
# Workflow list
agent-browser --session-name pipedream open https://pipedream.com/workflows

# Specific workflow (get URL from workflow list)
agent-browser --session-name pipedream open https://pipedream.com/workflows/p_XXXXXXX

# Edit mode (click Edit button, creates dev branch)
# Merge to production (click Deploy → Merge to production)
```

---

## HubSpot API Patterns

### Custom Object Fetch

```javascript
const response = await axios($, {
  method: "GET",
  url: `https://api.hubapi.com/crm/v3/objects/${objectTypeId}/${objectId}`,
  headers: {
    Authorization: `Bearer ${this.hubspot.$auth.oauth_access_token}`,
  },
  params: {
    properties: ["prop_a", "prop_b", "prop_c"].join(","),
  },
});
```

**Known custom objects:** Events = `2-56342751`, Portal = `19933594`

### Contact List Pagination (Legacy v1 API)

HubSpot's v1 contacts API uses `vid-offset` / `has-more`, NOT cursor-based:

```javascript
let contacts = [];
let hasMore = true;
let offset = 0;

while (hasMore) {
  const response = await axios($, {
    url: `https://api.hubapi.com/contacts/v1/lists/${listId}/contacts/all`,
    headers: { Authorization: `Bearer ${this.hubspot.$auth.oauth_access_token}` },
    params: { count: 100, vidOffset: offset, property: ["email", "firstname"] },
  });

  const batch = response.contacts.map(c => ({
    email: c.properties?.email?.value
      || c["identity-profiles"]?.[0]?.identities?.find(i => i.type === "EMAIL")?.value,
    firstName: c.properties?.firstname?.value || "",
  }));

  contacts = contacts.concat(batch);
  hasMore = response["has-more"] || false;
  offset = response["vid-offset"] || 0;
}
```

### Email Engagement Logging

```javascript
// READ ONLY fields — DO NOT set directly:
// hs_email_sender_email, hs_email_to_email, hs_email_sender_firstname, etc.

// Use hs_email_headers (JSON string) instead:
properties: {
  hs_timestamp: Date.now(),
  hs_email_direction: "EMAIL",
  hs_email_status: "SENT",
  hs_email_subject: "Subject line",
  hs_email_text: "Body text",
  hs_email_headers: JSON.stringify({
    from: { email: "sender@truv.com", firstName: "Truv", lastName: "Marketing" },
    to: [{ email: "recipient@example.com", firstName: "John", lastName: "Doe" }],
  }),
}

// Association: use v3 batch, NOT v4 PUT
await axios($, {
  method: "POST",
  url: "https://api.hubapi.com/crm/v3/associations/emails/contacts/batch/create",
  data: {
    inputs: [{ from: { id: emailId }, to: { id: contactId }, type: "email_to_contact" }],
  },
});
```

---

## Linear GraphQL Patterns

### Project Search + Upsert

```javascript
const TEAM_ID = "c935c1a0-a0fc-41e5-a598-a537fcd344de";
const projectName = `[MKTG-EVENT] ${event.name}`;

// Search by name (fuzzy) + team filter
const searchRes = await axios($, {
  method: "POST",
  url: "https://api.linear.app/graphql",
  headers: { Authorization: LINEAR_API_KEY, "Content-Type": "application/json" },
  data: {
    query: `query($filter: ProjectFilter) {
      projects(filter: $filter) { nodes { id name } }
    }`,
    variables: {
      filter: {
        name: { containsIgnoreCase: event.name },
        accessibleTeams: { some: { id: { eq: TEAM_ID } } },
      },
    },
  },
});

// Exact match from fuzzy results
const existing = searchRes.data?.projects?.nodes?.find(p => p.name === projectName);

if (existing) {
  // UPDATE — only safe fields
  await gql(`mutation($id: String!, $input: ProjectUpdateInput!) {
    projectUpdate(id: $id, input: $input) { success project { id name } }
  }`, { id: existing.id, input: { description, statusId, startDate, targetDate } });
} else {
  // CREATE
  await gql(`mutation($input: ProjectCreateInput!) {
    projectCreate(input: $input) { success project { id name url } }
  }`, { input: { name: projectName, teamIds: [TEAM_ID], description, statusId } });
}
```

### Status ID Mapping

Linear requires UUID status IDs, not string names:

```javascript
const statusMap = {
  "Upcoming":    "48884dae-a45d-4901-bd82-a9dc8c3b6fbf",  // Planned
  "In Progress": "c7780b3f-4ce9-4f7c-bb58-d80903fe460e",  // In Progress
  "Complete":    "05c3eaf1-a2b0-411d-b8d2-c80694cb2e0e",  // Completed
  "Completed":   "05c3eaf1-a2b0-411d-b8d2-c80694cb2e0e",  // Completed (alias)
};
```

### Project Label Association

```javascript
// Project labels are separate from issue labels — use projectLabelCreate
const PROJECT_LABEL_ID = "f4ddf3c9-3f95-4c3e-8cd6-7b60348a1d8f"; // "Event" label

await gql(`mutation($id: String!, $input: ProjectUpdateInput!) {
  projectUpdate(id: $id, input: $input) { success }
}`, { id: projectId, input: { labelIds: [PROJECT_LABEL_ID] } });
```

---

## Batch Processing

### Knock — Groups of 10 with Promise.all

```javascript
for (let i = 0; i < contacts.length; i += 10) {
  const batch = contacts.slice(i, i + 10);
  const promises = batch.map(contact =>
    axios($, { /* knock trigger */ }).then(r => ({ success: true })).catch(e => ({ error: e.message }))
  );
  await Promise.all(promises);
}
```

### SendGrid — Pause Every 50 Sends

```javascript
let sent = 0;
for (const contact of contacts) {
  await this.sendgrid.makeRequest({ method: "POST", path: "/v3/mail/send", data: { /* ... */ } });
  sent++;
  if (sent % 50 === 0) await new Promise(r => setTimeout(r, 1000));
}
```

---

## Production Deploy Flow

### The Dev → Production Cycle

1. **Click Edit** on the workflow → creates a dev branch (`dev-cameron-wolf-XXXXX`)
2. **Edit code steps** — use CodeMirror insertion technique (see Browser Automation)
3. **Click Test** → runs the workflow with the last trigger event
4. **Check Logs tab** → view `console.log()` output and return values
5. **Debug loop** — add `console.log(JSON.stringify(response))` to trace API issues
6. **Remove debug logs** before merging
7. **Click Deploy → Merge to production** — takes ~1-2 minutes
8. **Verify** — trigger webhook manually via curl:

```bash
curl -X POST "https://ENDPOINT.m.pipedream.net" \
  -H "Content-Type: application/json" \
  -d '{"objectId": "12345", "objectTypeId": "2-56342751", "portalId": 19933594}'
```

### Environment Variables

Set in Pipedream: Settings → Environment Variables. Available as `process.env.VAR_NAME` in all code steps.

Current env vars:
- `LINEAR_API_KEY` — Linear API key (no Bearer prefix)
- HubSpot and SendGrid use Pipedream app OAuth, not env vars

---

## Common Mistakes

1. **Linear `state` field on ProjectCreateInput** — Using string values like `"planned"` causes `INVALID_INPUT` errors. Use `statusId` with UUID values instead.
2. **Linear `icon` field** — Plain names like `"calendar"` fail. Use emoji shortcode format `:calendar:` or omit entirely.
3. **Linear auth header** — No `Bearer` prefix. Just `Authorization: lin_api_XXXXX`.
4. **Linear GraphQL returns 200 on errors** — The HTTP status is 200 even when the `errors` array is present. Always check `response.data.errors`.
5. **Linear `summary` field** — Does NOT exist in `ProjectUpdateInput`. Including it silently fails.
6. **HubSpot email properties are READ ONLY** — `hs_email_sender_email`, `hs_email_to_email`, etc. Use `hs_email_headers` JSON string.
7. **HubSpot associations use v3 batch** — `POST /crm/v3/associations/emails/contacts/batch/create`, NOT v4 PUT.
8. **Pipedream HubSpot app has no `makeRequest`** — Use `axios` with `this.hubspot.$auth.oauth_access_token`.
9. **Pipedream SendGrid app DOES have `makeRequest`** — Use `this.sendgrid.makeRequest()` for SendGrid.
10. **CodeMirror ignores standard input** — Must use `document.execCommand("insertText")` after focus + selectAll. See Browser Automation section.
11. **HubSpot React inputs need prototype setter** — `.value = "x"` doesn't work. Use `Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set`.
12. **Notion image URLs expire** — Notion-hosted images use S3 presigned URLs that expire in ~1 hour. Always use externally hosted images (Cloudinary, etc.).
13. **HubSpot legacy v1 pagination** — Uses `vid-offset` / `has-more`, not cursor-based. Don't mix with v3 pagination patterns.
14. **`$.flow.exit()` vs `return`** — `$.flow.exit()` stops the entire workflow. `return` only ends the current step. Use exit for "nothing to do" cases.
15. **Webhook payload shape varies** — Always use `steps.trigger.event.body || steps.trigger.event` with fallback for robustness.
16. **HubSpot workflow re-enrollment** — Must be explicitly enabled for updates to re-trigger the workflow. Without it, only creates fire.
17. **Knock email categories** — Every Knock → SendGrid workflow body must include `categories: ["Marketing", "{{ workflow.key }}"]` for proper HubSpot engagement labeling.
18. **Rate limits** — HubSpot: 100 req/10 sec. SendGrid: pause 1s every 50 sends. Knock: batch recipients in groups of 10.

---

## Existing Workflows Reference

| Workflow | Trigger | Steps | Doc |
|----------|---------|-------|-----|
| Outreach Intelligence | Schedule (Fri 7:30 AM CST) | Search HubSpot → Score → Create list → Slack | `outreach_intel/pipedream_workflow.md` |
| SendGrid → HubSpot Logging | HTTP Webhook | Filter events → Search contact → Log engagement | `outreach_intel/sendgrid_email_logging_workflow.md` |
| Changelog Weekly | Schedule (Mon 8:00 AM CST) | Fetch RSS → Get subscribers → Trigger Knock | `docs/plans/changelog-weekly-pipedream-workflow.md` |
| HubSpot Events → Linear | HTTP Webhook | Fetch event → Search/Create Linear project | `docs/plans/2026-03-04-hubspot-events-linear-sync.md` |
| Product Update Email | Manual | Query Notion → Parse blocks → Send via SendGrid | `docs/plans/product-update-email-workflow.md` |

All workflows live in the **GTM Automation** project in Pipedream.
