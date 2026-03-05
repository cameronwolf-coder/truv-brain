# Linear → HubSpot Task Status Sync

When a Linear Issue state changes, this workflow updates the linked HubSpot task status. Part of the bi-directional sync between HubSpot Tasks and Linear Issues.

## Quick Reference

| Key | Value |
|-----|-------|
| **Trigger** | HTTP Webhook (Linear webhook) |
| **Pipedream Project** | GTM Automation |
| **Status** | Ready to deploy |

## Data Flow

```
Linear Issue state changes (e.g. Todo → Done)
  → Linear webhook POST to Pipedream
  → Step 1: Parse webhook payload
      → Extract issue state, HubSpot Task ID from description
      → Map Linear state → HubSpot task status
  → Step 2: Update HubSpot task
      → Fetch current status (loop prevention)
      → PATCH task with new status
```

## Code Steps

| File | Step Name | What It Does |
|------|-----------|-------------|
| `step-1-parse-webhook.js` | `parse_linear_webhook` | Extracts issue state + HubSpot Task ID from Linear webhook payload |
| `step-2-update-hubspot-task.js` | `update_hubspot_task` | Updates HubSpot task status with loop prevention |

## Setup

1. Deploy workflow in Pipedream, copy webhook URL
2. Register Linear webhook:
   - URL: Pipedream webhook endpoint
   - Resource types: `Issue`
   - Actions: `update`

## Loop Prevention

Before updating HubSpot, step-2 fetches the current task status. If it already matches the target status, the workflow exits early. This prevents infinite loops when HubSpot → Linear sync fires back.
