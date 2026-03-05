# SendGrid → HubSpot Email Logging

Catches SendGrid delivery events via webhook and logs them as email engagements on HubSpot contact timelines.

## Quick Reference

| Key | Value |
|-----|-------|
| **Trigger** | HTTP Webhook (real-time) |
| **Endpoint** | `https://eodio59fk7jdiss.m.pipedream.net/` |
| **Pipedream Project** | GTM Automation |
| **Status** | Live in production |

## Data Flow

```
SendGrid sends email
  → SendGrid Event Webhook fires (delivered, open, click, bounce, etc.)
  → Pipedream HTTP endpoint receives event array
  → Step 1: Filter loggable events + deduplicate by email + message ID
  → Step 2: For each event:
      → Search HubSpot for contact by email
      → delivered/bounce/dropped/unsubscribe → Create email engagement on timeline
      → open/click → Update contact date properties + append tracking to engagement
  → Return summary (logged, updated, skipped, errors)
```

## Code Steps

| File | Step Name | What It Does |
|------|-----------|-------------|
| `step-1-filter-events.js` | `filter_events` | Filters SendGrid event array to loggable types, deduplicates by email + message ID |
| `step-2-log-to-hubspot.js` | `log_to_hubspot` | Searches HubSpot contacts, creates/updates email engagements, updates contact properties |

## IDs & Config

| Resource | Value |
|----------|-------|
| HubSpot Portal | `19933594` |
| From email | `insights@email.truv.com` |
| SendGrid webhook events | delivered, open, click, bounce, dropped, unsubscribe |

## Custom HubSpot Contact Properties

| Property | Updated On |
|----------|-----------|
| `sg_last_email_open_date` | Every open event |
| `sg_first_email_open_date` | First open only |
| `sg_last_email_click_date` | Every click event |
| `sg_first_email_click_date` | First click only |

## Gotchas

- HubSpot `hs_email_sender_email` is **READ ONLY** — use `hs_email_headers` JSON string instead
- Associations must use `POST /crm/v3/associations/emails/contacts/batch/create` (NOT v4 PUT)
- Pipedream HubSpot app has NO `makeRequest` — use `axios` with `this.hubspot.$auth.oauth_access_token`
- SendGrid sends events as an array, not individual objects
- `open`/`click` events update existing engagements; `delivered` events create new ones

## Full Documentation

See `outreach_intel/sendgrid_email_logging_workflow.md` for the original detailed doc.
