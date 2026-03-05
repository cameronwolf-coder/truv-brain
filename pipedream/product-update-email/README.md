# Product Update Email

Manual workflow that pulls monthly product update content from Notion, parses it into SendGrid template variables, and sends personalized emails to a HubSpot list.

## Quick Reference

| Key | Value |
|-----|-------|
| **Trigger** | Manual (click Run in Pipedream when Notion entry Status = "Ready") |
| **Pipedream Project** | GTM Automation |
| **Status** | Live in production |

## Data Flow

```
Cameron clicks "Run" in Pipedream
  → Step 1: Query Notion database for latest "Ready" entry
  → Step 2: Fetch page blocks, parse into template structure:
      → Paragraphs before bullets → intro_text
      → Bullet list before first heading → highlights (up to 5)
      → Each heading → section title (up to 5 sections)
      → Bullets under heading → section bullets (up to 5 each)
      → Images under heading → section images
      → Paragraphs after last section → outro_text
  → Step 3: Fetch recipients from HubSpot list (with pagination)
  → Step 4: Loop recipients, merge Notion data + firstName, send via SendGrid
```

## Code Steps

| File | Step Name | What It Does |
|------|-----------|-------------|
| `step-1-parse-notion.js` | `parse_notion_page` | Queries Notion DB, fetches page blocks, parses into SendGrid template variables |
| `step-2-send-emails.js` | `send_emails` | Loops HubSpot recipients, sends personalized emails via SendGrid |

## IDs & Config

| Resource | Value |
|----------|-------|
| Notion Database | `3f94409218a8434e9951075e9f9cda85` |
| SendGrid Template | `d-c9d363eaac97470bb73ff78f1782005d` |
| From email | `updates@truv.com` / `Truv` |
| Rate limit | Pause 1s every 50 sends |

## Monthly Process

1. Create new row in Notion database, fill in properties (subject, preview_text, hero_date, etc.)
2. Write page body: intro paragraphs → highlight bullets → heading sections with bullets/images → outro
3. Set Status to "Ready"
4. Click Run in Pipedream
5. Verify step outputs, then set Notion Status to "Sent"

## Gotchas

- Notion image URLs expire (~1hr) — always use externally hosted images (Cloudinary, etc.)
- SendGrid template uses triple braces `{{{variable}}}` for HTML content fields
- Pipedream HubSpot app has NO `makeRequest` — use `axios` with OAuth token
- The `Status = "Ready"` filter ensures only finalized content gets sent

## Full Documentation

See `docs/plans/product-update-email-workflow.md` for the original detailed doc.
