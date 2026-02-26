---
name: campaign-launcher
description: Use when the user wants to launch a full email campaign end-to-end — audience selection from HubSpot, Knock audience creation, email template building, and Knock workflow wiring. Also use when user says "launch a campaign", "send an email to", "set up a send", or describes an audience + email in one request.
---

# Campaign Launcher

End-to-end campaign orchestration: HubSpot audience → Knock audience → SendGrid template → Knock workflow — in one shot with confirmation at each stage.

## When to Use

- User describes an audience AND an email they want to send
- User says "launch a campaign", "set up a send to...", "email these people"
- User wants to go from audience criteria to a ready-to-trigger Knock workflow

## When NOT to Use

- Just building an email template (use `sendgrid-email-builder`)
- Just creating a Knock workflow (use `knock-sendgrid-workflow`)
- Just querying HubSpot with no intent to send

## Required Inputs

Gather upfront — ask for anything missing:

| Input | Required | Example |
|---|---|---|
| **Audience criteria** | Yes | "Email engaged contacts, no deals, not government" |
| **Campaign name** | Yes | "Whitepaper Launch - Feb 2026" |
| **Email content** | Yes | Notion URL, inline copy, or existing SendGrid template ID |
| **CTA URL** | Yes (if building email) | `https://truv.com/whitepaper` |
| **Hero style** | No (default: light) | "dark" for premium content, "light" for updates |

## Pipeline

5 stages, each with a confirmation checkpoint before proceeding.

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 1. AUDIENCE  │───▶│ 2. LIST      │───▶│ 3. KNOCK     │───▶│ 4. EMAIL     │───▶│ 5. WORKFLOW  │
│ Query HS     │    │ Create HS    │    │ Push audience │    │ Build or use │    │ Create Knock │
│ Show results │    │ static list  │    │ to Knock      │    │ SG template  │    │ workflow     │
│ ✋ CONFIRM    │    │ ✋ CONFIRM    │    │ ✋ CONFIRM     │    │ ✋ CONFIRM    │    │ ✋ CONFIRM    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Stage 1: Audience Query

Translate the user's natural language criteria into HubSpot search filters.

**Common filter patterns:**

| Criteria | HubSpot Filter |
|---|---|
| "Email engaged" | `hs_email_click GT 0` or `hs_email_open GT 2` |
| "No deals" | Check `num_associated_deals EQ 0` + association API |
| "Not government" | Exclude `industry CONTAINS government` and `sales_vertical CONTAINS government` |
| "Not customers" | Exclude `lifecyclestage IN [customer, opportunity, evangelist, advocate, disqualified]` |
| "Form submitters" | `recent_conversion_event_name CONTAINS_TOKEN {form name}` |
| "Recent activity" | `hs_email_last_open_date GT {date}` |

**Write a Python script** using `outreach_intel/hubspot_client.py` that:
1. Searches contacts with the criteria
2. Paginates through all results (HubSpot search caps at 10,000)
3. Applies in-code filters for things HubSpot search can't filter directly (lifecycle stage, industry)
4. Checks deal associations where needed

**Present to user:**
- Total count
- Top 10-20 by engagement (clicks/opens)
- Breakdown by lifecycle stage, industry if relevant

**CHECKPOINT:** "Found X contacts matching your criteria. Here are the top engaged ones: [table]. Want to proceed with creating the list?"

### Stage 2: HubSpot List Creation

Create a static list and add contacts:

```python
from outreach_intel.hubspot_client import HubSpotClient
hs = HubSpotClient()

# Create list — name mirrors the campaign name
result = hs.create_list(campaign_name)
list_id = result["list"]["listId"]

# Add contacts in batches of 100
for batch in chunked(contact_ids, 100):
    hs.add_contacts_to_list(str(list_id), batch)
```

**CHECKPOINT:** "Created HubSpot list '{name}' (ID: {id}) with {count} contacts. Proceed to push to Knock?"

### Stage 3: Knock Audience

Push the HubSpot list to Knock using the audience builder:

```python
from outreach_intel.knock_audience import push_to_knock
result = push_to_knock(hubspot_list_id=list_id)
# audience_key is auto-slugified from the HubSpot list name
```

Or via CLI:
```bash
python -m outreach_intel.knock_audience push {list_id}
```

The audience key is derived from the HubSpot list name (slugified). User IDs in Knock are set to the contact's email address for compatibility with existing Knock users.

**CHECKPOINT:** "Audience '{key}' created in Knock with {count} members. Proceed to email template?"

### Stage 4: Email Template

**Two paths:**

**Path A: Existing template** — User provides a SendGrid template ID. Skip to Stage 5.

**Path B: Build new template** — Follow the `sendgrid-email-builder` skill:

1. Get email copy (Notion fetch or inline)
2. Choose base template from `docs/`
3. Build HTML at `docs/sendgrid-{campaign-slug}.html`
4. Apply UTMs: `?utm_source=email&utm_medium=email&utm_campaign={campaign-slug}`
5. Upload to SendGrid via MCP:

```
Use mcp tool: sendgrid create_template
  name: {campaign_name}

Then: sendgrid create_template_version
  template_id: {new_template_id}
  name: "v1"
  subject: {subject_line}
  html_content: {the built HTML}
```

Capture the SendGrid template ID from the response.

**CHECKPOINT:** "Email template ready — SendGrid template ID: {id}. Preview the HTML? Proceed to create Knock workflow?"

### Stage 5: Knock Workflow

Create the Knock workflow using the `knock-sendgrid-workflow` skill pattern:

```bash
curl -s -X PUT \
  -H "Authorization: Bearer $KNOCK_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  "https://control.knock.app/v1/workflows/{workflow_key}?environment=development&commit=true" \
  -d '{
    "workflow": {
      "name": "{campaign_name}",
      "categories": ["Marketing"],
      "steps": [{
        "channel_key": "sendgrid-customer-success",
        "ref": "http_1",
        "type": "channel",
        "template": {
          "method": "post",
          "url": "https://api.sendgrid.com/v3/mail/send",
          "headers": [
            {"key": "Authorization", "value": "Bearer {{ vars.sendgrid_api_key }}"},
            {"key": "Content-Type", "value": "application/json"}
          ],
          "body": "{SENDGRID_PAYLOAD}"
        }
      }]
    }
  }'
```

**SendGrid payload body** (escaped JSON string):
```json
{
  "personalizations": [{
    "to": [{"email": "{{ recipient.email }}"}],
    "dynamic_template_data": {
      "firstName": "{{ recipient.name }}"
    }
  }],
  "from": {"email": "insights@email.truv.com", "name": "Truv"},
  "template_id": "{sendgrid_template_id}",
  "asm": {"group_id": 29127}
}
```

**Workflow key:** Slugified from campaign name (same convention as audience key).

**CHECKPOINT:** "Knock workflow '{key}' created and committed. Ready to trigger for audience '{audience_key}'."

## Stage 6 (Optional): Staged Send

For audiences over ~2,000 or when warming a domain, offer staged sending.
Knock has no built-in send pacing, so we handle it at the trigger level.

```bash
# Dry run — shows plan without sending
python -m outreach_intel.knock_audience trigger {workflow_key} {audience_key} \
  --batch-size 500 --delay-seconds 60 --dry-run

# Execute staged send
python -m outreach_intel.knock_audience trigger {workflow_key} {audience_key} \
  --batch-size 500 --delay-seconds 60
```

**Default pacing:** 500 recipients/batch, 60s delay = ~30,000/hour.

**Recommended pacing by audience size:**

| Audience Size | Batch Size | Delay | Rate |
|---|---|---|---|
| < 2,000 | 500 | 30s | ~60k/hr (fine to send all at once) |
| 2,000–5,000 | 500 | 60s | ~30k/hr |
| 5,000–10,000 | 500 | 120s | ~15k/hr |
| 10,000+ | 300 | 120s | ~9k/hr (conservative ramp) |

If the user doesn't specify, default to 500/60s. Always show a `--dry-run` first.

The trigger stops immediately on any error to prevent partial delivery.

**CHECKPOINT:** "Staged send complete. Triggered {n}/{total} recipients in {batches} batches."

## Final Summary

After all stages, present the complete campaign setup:

```
Campaign: {campaign_name}
──────────────────────────────────
HubSpot List:     {list_name} (ID: {list_id})
Knock Audience:   {audience_key} ({count} members)
SendGrid Template: {template_id}
Knock Workflow:   {workflow_key}

To trigger (staged):
  python -m outreach_intel.knock_audience trigger {workflow_key} {audience_key} --dry-run
  python -m outreach_intel.knock_audience trigger {workflow_key} {audience_key}

To trigger (all at once via API):
  POST https://api.knock.app/v1/workflows/{workflow_key}/trigger
  {"recipients": [{"collection": "audiences", "id": "{audience_key}"}]}
```

## Key References

- **HubSpot client:** `outreach_intel/hubspot_client.py`
- **Knock audience builder:** `outreach_intel/knock_audience.py`
- **Email design system:** `sendgrid-email-builder` skill
- **Knock workflow pattern:** `knock-sendgrid-workflow` skill
- **Knock service token:** `KNOCK_SERVICE_TOKEN` env var (set in `.env`)
- **Knock API token:** `KNOCK_SERVICE_TOKEN` env var (for audience API)
- **SendGrid channel:** `sendgrid-customer-success` (HTTP webhook — NOT `sendgrid`)
- **ASM group:** `29127` (Marketing Communications — ALWAYS include)
- **From address:** `insights@email.truv.com`

## Common Mistakes

- **Wrong Knock channel:** Must use `sendgrid-customer-success` (HTTP webhook), not `sendgrid` or `sendgrid---marketing`
- **Missing ASM group:** Every workflow MUST include `"asm": {"group_id": 29127}` for unsubscribe compliance
- **Missing `&commit=true`:** Knock Management API won't apply changes without this query param
- **HubSpot 10k limit:** Search API caps at 10,000 results. Use tighter filters or split queries for larger audiences
- **Knock user IDs:** Use email as the user ID (not `hs-{contact_id}`) so Knock users match across campaigns and product data
- **UTM encoding:** Use `&amp;` between URL parameters in HTML href attributes
