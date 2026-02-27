# SendGrid → HubSpot Email Logging (Pipedream Workflow)

## Overview
Catches SendGrid delivery events via webhook and logs them as email engagements on HubSpot contact timelines. Works for all SendGrid sends — Knock-triggered, manual, or automated.

**Trigger:** SendGrid Event Webhook (real-time)
**Events captured:** delivered, open, click, bounce, dropped, unsubscribe

---

## Architecture

```
SendGrid Email Sent
  → SendGrid Event Webhook fires on delivery events
  → Pipedream HTTP endpoint receives event
  → Code step: filter event type + deduplicate
  → HubSpot: search contact by recipient email
  → HubSpot: create email engagement on contact timeline
  → HubSpot: associate engagement with contact
```

---

## Setup Instructions

### Step 1: Create Pipedream Workflow

1. Go to https://pipedream.com/new
2. Click "New Workflow"

### Step 2: Add HTTP Trigger

- **Trigger Type:** HTTP / Webhook
- **HTTP Method:** POST
- **Response:** 200 OK (immediate — SendGrid retries on non-2xx)
- Copy the generated endpoint URL (you'll need it for Step 3)

### Step 3: Configure SendGrid Event Webhook

1. Go to **SendGrid → Settings → Mail Settings → Event Webhook**
2. Set **HTTP POST URL** to the Pipedream endpoint from Step 2
3. Enable these event types:
   - **Delivered** (primary — triggers the HubSpot log)
   - **Opened** (optional — updates engagement)
   - **Clicked** (optional — updates engagement)
   - **Bounced** (logs delivery failure)
   - **Dropped** (logs delivery failure)
   - **Unsubscribed** (logs opt-out)
4. Click **Save**
5. Click **Test Your Integration** to verify Pipedream receives events

### Step 4: Add Code Step — Filter & Parse Events

- **Language:** Node.js

```javascript
export default defineComponent({
  async run({ steps, $ }) {
    // SendGrid sends events as an array
    const events = steps.trigger.event.body;

    if (!Array.isArray(events) || events.length === 0) {
      $.flow.exit("No events in payload");
    }

    // Events we want to log to HubSpot
    const LOGGABLE_EVENTS = ["delivered", "open", "click", "bounce", "dropped", "unsubscribe"];

    // Map SendGrid event types to HubSpot email status
    const STATUS_MAP = {
      delivered: "SENT",
      open: "SENT",
      click: "SENT",
      bounce: "BOUNCED",
      dropped: "FAILED",
      unsubscribe: "SENT",
    };

    const parsed = events
      .filter(e => LOGGABLE_EVENTS.includes(e.event))
      .map(e => ({
        email: e.email,
        event: e.event,
        timestamp: new Date(e.timestamp * 1000).toISOString(),
        sg_message_id: e.sg_message_id?.split(".")[0] || "",
        subject: e.subject || "Email from Truv",
        category: Array.isArray(e.category) ? e.category.join(", ") : (e.category || "Marketing"),
        status: STATUS_MAP[e.event] || "SENT",
        url: e.url || null,  // For click events
      }));

    if (parsed.length === 0) {
      $.flow.exit("No loggable events");
    }

    // Deduplicate by email + sg_message_id (only log once per message per recipient)
    // For "delivered" — always log. For "open"/"click" — skip if already logged.
    const deliveryEvents = parsed.filter(e => e.event === "delivered");
    const otherEvents = parsed.filter(e => e.event !== "delivered");

    // Prioritize delivery events; if none, pass through others
    const toProcess = deliveryEvents.length > 0 ? deliveryEvents : otherEvents;

    // Deduplicate by email + message ID
    const seen = new Set();
    const unique = toProcess.filter(e => {
      const key = `${e.email}:${e.sg_message_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { events: unique, count: unique.length };
  },
});
```

### Step 5: Add Code Step — Log to HubSpot

- **Language:** Node.js
- **Pipedream version:** v5

> **Important:** Pipedream's HubSpot app does NOT have a `makeRequest` method.
> Use `axios` directly with `this.hubspot.$auth.oauth_access_token`.
> HubSpot email properties like `hs_email_sender_email` are **READ ONLY** —
> use `hs_email_headers` (JSON string) for sender/recipient metadata instead.
> Associations must use the v3 batch endpoint, not v4 PUT.

**Dedup logic:** Only `delivered`/`bounce`/`dropped`/`unsubscribe` events create email engagements.
`open`/`click` events update **contact-level date properties** only — no duplicate timeline entries.

**Custom contact properties** (created Feb 2026):
- `sg_last_email_open_date` — updated on every open event
- `sg_first_email_open_date` — set once on first open
- `sg_last_email_click_date` — updated on every click event
- `sg_first_email_click_date` — set once on first click

```javascript
import axios from "axios"

export default defineComponent({
  props: {
    hubspot: {
      type: "app",
      app: "hubspot",
    },
  },
  async run({ steps, $ }) {
    const events = steps.filter_events.$return_value?.events || [];
    if (!events || events.length === 0) {
      $.flow.exit("No events to process");
    }

    const token = this.hubspot.$auth.oauth_access_token;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const results = [];

    // Events that create a new email engagement
    const CREATE_EVENTS = new Set(["delivered", "bounce", "dropped", "unsubscribe"]);
    // Events that only update contact properties (no new engagement)
    const UPDATE_EVENTS = new Set(["open", "click"]);

    for (const event of events) {
      try {
        // 1. Search for contact by email
        const searchRes = await axios.post(
          "https://api.hubapi.com/crm/v3/objects/contacts/search",
          {
            filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: event.email }] }],
            properties: ["firstname", "lastname", "email", "sg_first_email_open_date", "sg_first_email_click_date"],
            limit: 1,
          },
          { headers }
        );

        const contact = searchRes.data?.results?.[0];
        if (!contact) {
          results.push({ email: event.email, status: "skipped", reason: "Contact not found" });
          continue;
        }

        // 2a. For open/click events — update contact date properties only
        if (UPDATE_EVENTS.has(event.event)) {
          if (event.event === "open") {
            const contactUpdates = { sg_last_email_open_date: event.timestamp };
            if (!contact.properties?.sg_first_email_open_date) {
              contactUpdates.sg_first_email_open_date = event.timestamp;
            }
            await axios.patch(
              `https://api.hubapi.com/crm/v3/objects/contacts/${contact.id}`,
              { properties: contactUpdates },
              { headers }
            );
          }

          if (event.event === "click") {
            const contactUpdates = { sg_last_email_click_date: event.timestamp };
            if (!contact.properties?.sg_first_email_click_date) {
              contactUpdates.sg_first_email_click_date = event.timestamp;
            }
            await axios.patch(
              `https://api.hubapi.com/crm/v3/objects/contacts/${contact.id}`,
              { properties: contactUpdates },
              { headers }
            );
          }

          results.push({ email: event.email, contactId: contact.id, event: event.event, status: "updated" });
          continue;
        }

        // 2b. For delivered/bounce/dropped/unsubscribe — create email engagement
        if (CREATE_EVENTS.has(event.event)) {
          // Build a descriptive subject line
          const category = event.category || "Marketing";
          const rawSubject = event.subject || "";
          let emailSubject;
          if (rawSubject && rawSubject !== "Email from Truv" && rawSubject !== "") {
            emailSubject = rawSubject;
          } else {
            emailSubject = `Truv Marketing Email — ${category}`;
          }

          // Build a rich body with all available details
          const sentDate = new Date(event.timestamp).toLocaleDateString("en-US", {
            year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short"
          });
          const statusLabel = event.event === "delivered" ? "Delivered" : event.event === "bounce" ? "Bounced" : event.event === "dropped" ? "Dropped" : "Unsubscribed";
          const bodyLines = [
            `Status: ${statusLabel}`,
            `Campaign: ${category}`,
            `Sent: ${sentDate}`,
            `Channel: SendGrid`,
            `Message ID: ${event.sg_message_id}`,
          ];
          if (rawSubject && rawSubject !== emailSubject) {
            bodyLines.splice(1, 0, `Subject: ${rawSubject}`);
          }

          const emailRes = await axios.post(
            "https://api.hubapi.com/crm/v3/objects/emails",
            {
              properties: {
                hs_timestamp: event.timestamp,
                hs_email_direction: "EMAIL",
                hs_email_status: event.status,
                hs_email_subject: emailSubject,
                hs_email_text: bodyLines.join("\n"),
                hs_email_headers: JSON.stringify({
                  from: { email: "insights@email.truv.com", firstName: "Truv", lastName: "Marketing" },
                  to: [{ email: event.email, firstName: contact.properties?.firstname || "", lastName: contact.properties?.lastname || "" }],
                }),
              },
            },
            { headers }
          );

          // Associate email to contact
          await axios.post(
            "https://api.hubapi.com/crm/v3/associations/emails/contacts/batch/create",
            {
              inputs: [{ from: { id: emailRes.data.id }, to: { id: contact.id }, type: "email_to_contact" }],
            },
            { headers }
          );

          results.push({ email: event.email, contactId: contact.id, engagementId: emailRes.data.id, event: event.event, status: "logged" });
        }
      } catch (err) {
        results.push({ email: event.email, event: event.event, status: "error", error: err.message });
      }
    }

    const logged = results.filter(r => r.status === "logged").length;
    const updated = results.filter(r => r.status === "updated").length;
    const skipped = results.filter(r => r.status === "skipped").length;
    const errors = results.filter(r => r.status === "error").length;

    $.export("$summary", `Logged: ${logged}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
    return { summary: `Logged: ${logged}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`, results };
  },
});
```

---

## Configuration Values

| Setting | Value |
|---------|-------|
| Trigger | SendGrid Event Webhook (HTTP POST) |
| From email | `insights@email.truv.com` |
| Association type ID | 198 (email → contact) |
| HubSpot portal | 19933594 |

## SendGrid Event Webhook Payload Reference

Each event in the array includes:

| Field | Example | Notes |
|-------|---------|-------|
| `email` | `john@example.com` | Recipient |
| `event` | `delivered` | Event type |
| `timestamp` | `1706400000` | Unix epoch seconds |
| `sg_message_id` | `abc123.filter...` | Unique message ID |
| `subject` | `Your Product Update` | Email subject line |
| `category` | `["Marketing"]` | SendGrid categories |
| `url` | `https://truv.com` | Click events only |

## What Shows Up in HubSpot

### Timeline (email engagements — delivered events only)

- **Type:** Email (logged)
- **Direction:** Outbound
- **Subject:** The email subject from SendGrid (or "Truv Marketing Email — {category}" if no subject)
- **From:** insights@email.truv.com (Truv Marketing)
- **Body:** Status, Campaign, Sent date, Channel, Message ID
- **Status:** SENT, BOUNCED, or FAILED

### Contact properties (open/click events)

- `sg_first_email_open_date` — first time contact opened a SendGrid email
- `sg_last_email_open_date` — most recent open
- `sg_first_email_click_date` — first time contact clicked a SendGrid email
- `sg_last_email_click_date` — most recent click

These properties can be used in HubSpot lists and workflows for remarketing segments.

## Required: Add subject and categories in Knock Workflows

Every Knock workflow that sends email via the SendGrid HTTP channel **must** include `subject` and `categories` fields. Without these, the HubSpot engagement will fall back to "Truv Marketing Email — Marketing" with no way to identify which email the contact received.

### Knock HTTP webhook body template

```json
{
  "personalizations": [{
    "to": [{"email": "{{ recipient.email }}"}],
    "dynamic_template_data": {
      "firstName": "{{ recipient.name }}"
    }
  }],
  "from": {
    "email": "insights@email.truv.com",
    "name": "Truv"
  },
  "template_id": "d-xxxxxxxxxxxx",
  "subject": "Your Q1 2026 Product Update from Truv",
  "categories": ["Marketing", "Product Update Q1 2026"],
  "asm": {"group_id": 29127}
}
```

### What each field does

| Field | Required | Purpose |
|-------|----------|---------|
| `subject` | **Yes** | Becomes the HubSpot timeline entry subject. Use a descriptive, human-readable subject. |
| `categories` | **Yes** | Logged in HubSpot body as "Campaign: ...". Also filterable in SendGrid Activity. Use specific tags like `["Marketing", "Product Update Q1 2026"]` — not just `["Marketing"]`. |
| `template_id` | Yes | The SendGrid dynamic template to render. |
| `asm.group_id` | Yes | SendGrid unsubscribe group (29127 = Marketing). |

### How it flows through

1. Knock triggers the SendGrid HTTP channel with the body above
2. SendGrid sends the email and fires webhook events (`delivered`, `open`, `click`)
3. The webhook payload includes `subject` and `category` from the original send
4. Pipedream's `log_to_hubspot` step uses these to create a descriptive HubSpot engagement:
   - **Subject:** "Your Q1 2026 Product Update from Truv"
   - **Body:** Status: Delivered / Campaign: Marketing, Product Update Q1 2026 / Sent: Feb 27, 2026 / Channel: SendGrid

### Checklist for new Knock workflows

- [ ] `subject` is set to a descriptive, campaign-specific subject line
- [ ] `categories` includes at least 2 tags: a general category (e.g., "Marketing") and a specific campaign name (e.g., "NPS Survey Jan 2026")
- [ ] `template_id` points to the correct SendGrid template
- [ ] `asm.group_id` is set (29127 for Marketing)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No events arriving | Check SendGrid Event Webhook is enabled and URL is correct |
| Contact not found | Email must match exactly in HubSpot. Check for aliases. |
| Duplicate logs | Only `delivered`/`bounce`/`dropped`/`unsubscribe` create engagements; `open`/`click` update contact properties only |
| 429 rate limit | HubSpot allows 100 requests/10 sec. Batch sends of 100+ contacts may need throttling. Add a delay step if needed. |
| Missing subject | Add `subject` field to the Knock workflow SendGrid body (see above) |
