# HubSpot → Linear Issue Status Sync

When a HubSpot task status changes, this workflow updates the linked Linear issue state. Part of the bi-directional sync between HubSpot Tasks and Linear Issues.

## Quick Reference

| Key | Value |
|-----|-------|
| **Trigger** | HTTP Webhook (HubSpot workflow) |
| **Pipedream Project** | GTM Automation |
| **Status** | Ready to deploy |

## Data Flow

```
HubSpot task status changes (e.g. NOT_STARTED → COMPLETED)
  → HubSpot workflow POST to Pipedream with { taskId, status, linearIssueId }
  → Step 1: Update Linear issue
      → Map HubSpot status → Linear state ID
      → Fetch current issue state (loop prevention)
      → issueUpdate mutation with new stateId
```

## Code Steps

| File | Step Name | What It Does |
|------|-----------|-------------|
| `step-1-update-linear-issue.js` | `update_linear_issue` | Maps HubSpot status → Linear state, updates issue with loop prevention |

## Setup

1. Deploy workflow in Pipedream, copy webhook URL
2. Create HubSpot workflow:
   - Trigger: Task property change (`hs_task_status`)
   - Filter: `linear_issue_id` is known (not empty)
   - Action: POST to Pipedream webhook with `{ taskId, status, linearIssueId }`

## Expected Payload

```json
{
  "taskId": "49444943496",
  "status": "COMPLETED",
  "linearIssueId": "abc-123-def"
}
```

## Loop Prevention

Before updating Linear, step-1 fetches the current issue state. If it already matches the target state, the workflow exits early. This prevents infinite loops when Linear → HubSpot sync fires back.
