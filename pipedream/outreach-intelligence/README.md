# Outreach Intelligence

Weekly scoring of dormant HubSpot contacts for re-engagement campaigns. Scores contacts on engagement, timing, deal context, and external triggers, then creates a static list and notifies Slack.

## Quick Reference

| Key | Value |
|-----|-------|
| **Trigger** | Schedule — Every Friday 7:30 AM CST (`30 13 * * 5` UTC) |
| **Pipedream Project** | GTM Automation |
| **Status** | Live in production |

## Data Flow

```
Friday 7:30 AM CST
  → Step 1: Search HubSpot for contacts (200 max)
  → Step 2: Filter out excluded lifecycle stages (customers, disqualified, etc.)
      → Score each contact (engagement 25%, timing 25%, deal context 30%, external 20%)
      → Sort by score, take top 50
  → Step 3: Create static HubSpot list with date-stamped name
  → Step 4: Add top 50 contacts to list
  → Step 5: Send Slack summary to #outreach-intelligence
```

## Code Steps

| File | Step Name | What It Does |
|------|-----------|-------------|
| `step-1-score-and-filter.js` | `code` | Filters contacts by lifecycle stage, scores on 4 dimensions, returns top 50 |

## IDs & Config

| Resource | Value |
|----------|-------|
| Slack Channel | `C0A9Y5HLQAF` (#outreach-intelligence) |
| HubSpot Test List | `101845508` |
| Contacts per list | 50 |

## Scoring Weights

| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| Engagement | 25% | Email opens/clicks recency |
| Timing | 25% | Days since last activity |
| Deal Context | 30% | Lifecycle stage (Closed Lost = 80, Churned = 75, SQL = 60, etc.) |
| External Triggers | 20% | Job changes, company news (placeholder at 40) |

## Full Documentation

See `outreach_intel/pipedream_workflow.md` for the original detailed doc.
