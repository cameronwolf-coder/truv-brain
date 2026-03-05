# Pipedream Workflows

All Pipedream automations for Truv GTM. Each subfolder is one workflow with its own README (context, endpoints, data flow) and code steps (the actual JS running in Pipedream).

**Pipedream Project:** GTM Automation

---

## Workflows

| Folder | Name | Trigger | What It Does |
|--------|------|---------|-------------|
| [`sendgrid-event-logging/`](sendgrid-event-logging/) | SendGrid → HubSpot Logging | Webhook (real-time) | Logs email opens, clicks, and deliveries on HubSpot contact timelines |
| [`hubspot-events-to-linear/`](hubspot-events-to-linear/) | HubSpot Events → Linear | Webhook (real-time) | Creates/updates Linear projects when HubSpot Events are created or changed |
| [`outreach-intelligence/`](outreach-intelligence/) | Outreach Intelligence | Schedule (Fri 7:30 AM CST) | Scores dormant contacts and creates re-engagement lists in HubSpot |
| [`changelog-weekly/`](changelog-weekly/) | Changelog Weekly | Schedule (Mon 8:00 AM CST) | Sends weekly changelog digest via Knock → SendGrid |
| [`product-update-email/`](product-update-email/) | Product Update Email | Manual | Pulls content from Notion and sends product update emails via SendGrid |

---

## How to Use This Directory

**Editing an existing workflow:**
1. Open the workflow's folder (e.g., `pipedream/hubspot-events-to-linear/`)
2. Read the `README.md` for full context — endpoint, IDs, data flow, gotchas
3. Edit the code step `.js` files locally
4. Use the Pipedream Builder skill to push changes to Pipedream

**Creating a new workflow:**
1. Create a new subfolder: `pipedream/<workflow-name>/`
2. Add a `README.md` following the pattern of existing workflows
3. Add code step files as `step-1-<name>.js`, `step-2-<name>.js`, etc.
4. Update this index README

---

## Reference

- [Pipedream Best Practices](../docs/pipedream-best-practices.md) — Auth patterns, gotchas, browser automation
- [Pipedream Builder Skill](../.claude/skills/pipedream-builder/) — AI-assisted workflow creation
