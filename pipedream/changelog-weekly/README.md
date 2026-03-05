# Changelog Weekly Digest

Weekly automation that checks the Truv changelog RSS feed for new posts. If new entries exist from the past 7 days, sends a digest email to subscribers via Knock → SendGrid.

## Quick Reference

| Key | Value |
|-----|-------|
| **Trigger** | Schedule — Every Monday 8:00 AM CST (`0 14 * * 1` UTC) |
| **Pipedream Project** | GTM Automation |
| **Status** | Template + Knock workflow built. Pipedream workflow documented, awaiting RSS feed URL. |

## Data Flow

```
Monday 8:00 AM CST
  → Step 1: Fetch RSS feed, parse XML, filter to entries from last 7 days
      → If no new entries → exit (no empty emails)
  → Step 2: Fetch subscribers from HubSpot list 1799 (with pagination)
  → Step 3: Trigger Knock workflow for each subscriber (batches of 10)
      → Knock sends via SendGrid HTTP channel with dynamic template
```

## Code Steps

| File | Step Name | What It Does |
|------|-----------|-------------|
| `step-1-fetch-rss.js` | `fetch_and_parse_rss` | Fetches RSS, parses XML, filters to last 7 days |
| `step-2-fetch-subscribers.js` | `fetch_hubspot_subscribers` | Paginates HubSpot list 1799 for subscriber emails |
| `step-3-trigger-knock.js` | `trigger_knock_workflow` | Triggers Knock workflow per subscriber in batches of 10 |

## IDs & Config

| Resource | Value |
|----------|-------|
| SendGrid Template | `d-d8a9aeef798844c68a8f09a455c06141` |
| Knock Workflow | `changelog-weekly-digest` |
| ASM Group (unsubscribe) | `29746` (Product Changelog) |
| HubSpot Subscriber List | `1799` |
| RSS Feed URL | `https://truv.com/changelog/rss` *(placeholder — waiting on Anna)* |
| Sender | `insights@email.truv.com` / `Truv` |

## Gotchas

- RSS feed URL is a placeholder — needs real URL from Anna (Astro build)
- HubSpot legacy v1 list API uses `vid-offset` / `has-more`, not cursor pagination
- Knock batches must be groups of 10 to avoid rate limits
- Every Knock → SendGrid body must include `categories: ["Marketing", "{{ workflow.key }}"]` for HubSpot engagement labeling

## Full Documentation

See `docs/plans/changelog-weekly-pipedream-workflow.md` for the original detailed doc.
