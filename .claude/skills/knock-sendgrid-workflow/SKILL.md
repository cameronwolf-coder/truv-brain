---
name: knock-sendgrid-workflow
description: Use when creating a Knock workflow to send emails via SendGrid dynamic templates. Triggers on "push to Knock", "create Knock workflow", "Knock SendGrid workflow", "add email to Knock", or when a SendGrid template needs a corresponding Knock workflow for triggering sends.
---

# Knock SendGrid Workflow

Create Knock workflows that send emails through SendGrid dynamic templates via HTTP webhook steps.

## When to Use

- A new SendGrid dynamic template needs a Knock workflow to trigger sends
- Creating one or more Knock workflows for a campaign (e.g., webinar series, drip sequence)
- User says "push to Knock" or "create Knock workflow" after building a SendGrid template

## Required Inputs

Gather these from the user before creating:

| Input | Required | Default | Example |
|---|---|---|---|
| Workflow name | Yes | — | `FCM Webinar - Initial Invite` |
| Workflow key | Yes | — | `fcm-webinar-initial-invite` (kebab-case) |
| SendGrid template ID | Yes | — | `d-c0d164034f3d4ac686fc3a3627fcd6a6` |
| From email | No | `insights@email.truv.com` | `insights@email.truv.com` |
| From name | No | `Truv` | `Truv` |
| Categories | No | `["Marketing"]` | `["Marketing", "Webinar"]` |
| ASM group ID | No | `29127` | `29127` |

If the user doesn't provide a workflow key, derive one from the name (lowercase, spaces to hyphens).

## How It Works

Each workflow uses the `sendgrid-customer-success` HTTP webhook channel to POST directly to the SendGrid v3 mail/send API. The SendGrid API key is stored in Knock environment variables as `{{ vars.sendgrid_api_key }}`. Personalization uses Knock's `recipient.email` and `recipient.name` liquid variables. **Every workflow MUST include the ASM group for unsubscribe compliance** (default: 29127).

## API Call

**Endpoint:** `PUT https://control.knock.app/v1/workflows/{workflow_key}?environment=development&commit=true`

**Auth:** `Authorization: Bearer {KNOCK_SERVICE_TOKEN}`

**Service token:** Use the `KNOCK_SERVICE_TOKEN` environment variable (from `.env`)

### Request Body

```json
{
  "workflow": {
    "name": "{workflow_name}",
    "description": "{description}",
    "categories": ["{categories}"],
    "steps": [
      {
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
          "body": "{\n  \"personalizations\": [{\n    \"to\": [{\"email\": \"{{ recipient.email }}\"}],\n    \"dynamic_template_data\": {\n      \"firstName\": \"{{ recipient.name }}\"\n    }\n  }],\n  \"from\": {\n    \"email\": \"{from_email}\",\n    \"name\": \"{from_name}\"\n  },\n  \"template_id\": \"{sendgrid_template_id}\",\n  \"asm\": {\"group_id\": {asm_group_id}}\n}"
        }
      }
    ]
  }
}
```

## Execution

Use `curl` via Bash to make the API call. For multiple workflows, run them in parallel.

**Verify success:** Response should include `"valid": true` and the steps array should show `"channel_type": "http"`.

## Batch Creation

When creating multiple workflows at once (e.g., a 4-email webinar series), run all curl commands in parallel Bash calls. Each gets its own workflow key and SendGrid template ID.

## Common Mistakes

- **Wrong channel key:** Must be `sendgrid-customer-success` (the HTTP webhook channel), NOT `sendgrid` or `sendgrid---marketing` (those are email-type channels for Knock-composed emails)
- **Missing commit:** Always add `&commit=true` to the query string, otherwise changes stay uncommitted in development
- **Body escaping:** The `body` field is a JSON string containing JSON — escape inner quotes with `\"`
- **Liquid syntax:** Use `{{ recipient.email }}` and `{{ recipient.name }}` (double curly braces, Knock liquid)
- **Missing ASM group:** ALWAYS include `"asm": {"group_id": 29127}` for unsubscribe compliance. Never omit this.
