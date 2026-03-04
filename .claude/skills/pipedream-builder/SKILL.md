---
name: pipedream-builder
description: Build, edit, test, and deploy Pipedream workflows. Use when creating automations, building webhook pipelines, connecting APIs in Pipedream, or debugging existing workflows. Covers browser-based editing, code step writing, and production deployment.
---

# Pipedream Workflow Builder

Build and deploy Pipedream workflows using browser automation and battle-tested API patterns. Handles the full lifecycle — from requirements to production.

## When to Use

- "Build a Pipedream workflow" / "Create an automation"
- "Connect X to Y in Pipedream" / "Set up a webhook pipeline"
- "Edit the Pipedream workflow" / "Fix the Pipedream step"
- "Deploy to production" / "Merge the workflow"
- Any task involving Pipedream workflow creation or modification

## When NOT to Use

- Just writing a standalone script (no Pipedream involved)
- Querying APIs directly from CLI without Pipedream

## Required Inputs

| Input | Required | Default | Example |
|-------|----------|---------|---------|
| Purpose | Yes | — | "Sync HubSpot events to Linear projects" |
| Trigger type | Yes | HTTP Webhook | HTTP Webhook, Schedule, Manual |
| APIs involved | Yes | — | HubSpot, Linear, SendGrid, Slack, Knock |
| Data flow | Yes | — | "Event created → fetch details → create project" |
| Pipedream project | No | GTM Automation | GTM Automation |

## Reference

**All patterns, code snippets, and gotchas are in `docs/pipedream-best-practices.md`.** Read it before starting any workflow. Key sections:
- Authentication patterns (HubSpot OAuth, Linear env var, SendGrid app)
- Code step patterns (`$.flow.exit()`, step references, batch processing)
- Browser automation (CodeMirror insertion, session login)
- Common mistakes (30+ documented gotchas)

---

## Workflow — 5 Phases

### Phase 1: Requirements & Architecture

1. Clarify the trigger type (webhook, schedule, manual)
2. Identify all APIs and their auth methods:
   - **HubSpot** → Pipedream app prop + OAuth token
   - **SendGrid** → Pipedream app prop + `makeRequest`
   - **Linear** → `process.env.LINEAR_API_KEY` (no Bearer prefix)
   - **Slack** → Pipedream built-in action
   - **Knock** → `process.env.KNOCK_API_KEY`
3. Map the data flow: trigger → step 1 → step 2 → ... → output
4. Check `docs/pipedream-best-practices.md` for existing patterns that match

### Phase 2: Write Code Steps Locally

Write each code step to a temp file for easy iteration:

```
/tmp/pd-step-1.js   # First code step
/tmp/pd-step-2.js   # Second code step
/tmp/pd-step-N.js   # Nth code step
```

**Every code step MUST follow this structure:**

```javascript
import { axios } from "@pipedream/platform";

export default defineComponent({
  // Only include props if using a Pipedream app (HubSpot, SendGrid)
  props: {
    hubspot: { type: "app", app: "hubspot" },
  },
  async run({ steps, $ }) {
    // 1. Extract data from previous steps
    const payload = steps.trigger.event.body || steps.trigger.event;

    // 2. Guard clause — exit early if nothing to do
    if (!payload.objectId) {
      $.flow.exit("No objectId — skipping");
    }

    // 3. Do the work
    const response = await axios($, { /* ... */ });

    // 4. Return clean object for next step
    return {
      action: "created",
      id: response.id,
      name: response.name,
    };
  },
});
```

### Phase 3: Browser Automation — Create/Edit Workflow

**Pre-requisite:** Pipedream session must be authenticated. If not:

```bash
# One-time headed login
agent-browser --headed --session-name pipedream open https://pipedream.com/
# User logs in manually, then session persists
```

**Creating a new workflow:**

```bash
# Open Pipedream workflows
agent-browser --session-name pipedream open https://pipedream.com/workflows

# Navigate and create — use snapshot + click pattern
agent-browser --session-name pipedream snapshot -i
agent-browser --session-name pipedream click @eN  # "New workflow" button
```

**Inserting code into CodeMirror editor:**

This is the ONLY method that works. Standard fill/type commands fail with CodeMirror.

```bash
# 1. JSON-escape the code file
ESCAPED=$(python3 -c "import json; print(json.dumps(open('/tmp/pd-step-N.js').read()))")

# 2. Insert via execCommand (the only reliable method)
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

**IMPORTANT:** If there are multiple CodeMirror editors on the page (e.g., multiple code steps open), target the correct one using `document.querySelectorAll('.cm-content')[INDEX]`.

### Phase 4: Test & Debug

1. **Click Test** button in Pipedream UI (via agent-browser)
2. **Check Logs tab** for output — snapshot the results area
3. **If errors:** Add `console.log(JSON.stringify(response))` to trace the issue
4. **Common debug pattern:**

```javascript
// Temporary — add before API calls to trace errors
console.log("API KEY exists:", !!LINEAR_API_KEY);
console.log("API KEY prefix:", LINEAR_API_KEY?.substring(0, 15));
console.log("searchRes:", JSON.stringify(searchRes));
console.log("createRes:", JSON.stringify(createRes));
```

5. **Fix and re-test** — use the CodeMirror insertion technique to update code
6. **Remove all console.log statements** before proceeding to Phase 5

### Phase 5: Merge to Production

1. Click **Deploy → Merge to production** in the Pipedream UI
2. Wait ~1-2 minutes for merge to complete
3. **Verify** with a manual trigger:

```bash
# For webhook-triggered workflows
curl -X POST "https://ENDPOINT.m.pipedream.net" \
  -H "Content-Type: application/json" \
  -d '{"objectId": "12345"}'
```

4. Check the workflow execution logs in Pipedream to confirm success
5. Create a workflow documentation file in `docs/plans/` following existing patterns

---

## Quick Reference — Auth Headers

| Service | Auth Pattern |
|---------|-------------|
| HubSpot | `Authorization: Bearer ${this.hubspot.$auth.oauth_access_token}` |
| SendGrid | `this.sendgrid.makeRequest({ method, path, data })` |
| Linear | `Authorization: ${process.env.LINEAR_API_KEY}` (NO Bearer) |
| Knock | `Authorization: Bearer ${process.env.KNOCK_API_KEY}` |
| Slack | Use Pipedream built-in "Send Message" action |

## Quick Reference — Step Data Access

| Source | Access Pattern |
|--------|---------------|
| Webhook body | `steps.trigger.event.body \|\| steps.trigger.event` |
| Previous code step | `steps.step_name.$return_value` |
| HubSpot search action | `steps.search_crm.$return_value?.results \|\| []` |
| Environment variable | `process.env.VAR_NAME` |

---

## Common Mistakes

Read `docs/pipedream-best-practices.md` § "Common Mistakes" for the full list (18+ items). The top 5:

1. **Linear returns 200 on errors** — Always check `response.data.errors`, not just HTTP status
2. **HubSpot email properties are READ ONLY** — Use `hs_email_headers` JSON string
3. **CodeMirror ignores fill/type** — Must use `execCommand("insertText")` after focus + selectAll
4. **Pipedream HubSpot app has no `makeRequest`** — Use `axios` + OAuth token
5. **`$.flow.exit()` stops the entire workflow** — Use `return` to only end the current step
