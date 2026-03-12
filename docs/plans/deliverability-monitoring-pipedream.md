# Deliverability Monitoring — Pipedream Workflow

Daily automated health checks on Smartlead sending infrastructure with Slack alerts.

---

## Workflow Overview

**Project:** GTM Automation
**Trigger:** Cron — daily at 8:00 AM CST
**Slack Channel:** #outreach-intelligence (C0A9Y5HLQAF)

---

## Steps

### Step 1: Pull Campaign Stats from Smartlead

```javascript
// GET /api/v1/campaigns?api_key=KEY
// For each active campaign, get:
//   - bounce_rate
//   - reply_rate
//   - open_rate
//   - spam_complaint_count
//   - total_sent
//   - status
```

Smartlead API: `https://server.smartlead.ai/api/v1`
Auth: query param `?api_key=KEY`

### Step 2: Check Thresholds

| Metric | Warning | Critical | Action |
|---|---|---|---|
| Bounce rate | >2% | >3% | Pause domain, review list quality |
| Spam complaints | >0.05% | >0.1% | Pause domain immediately |
| Reply rate drop | >30% WoW | >50% WoW | Review copy/targeting |
| Open rate drop | >40% WoW | >60% WoW | Check deliverability, inbox placement |

### Step 3: Slack Alert (if threshold breached)

```
:rotating_light: DELIVERABILITY ALERT

Domain: truvdata.io
Campaign: Wave - encompass-integration - 2026-03-10
Issue: Bounce rate at 3.2% (threshold: 3%)
Action: Domain paused. Review list quality and remove invalid emails.

Metrics:
  Sent: 1,247
  Bounced: 40 (3.2%)
  Replies: 31 (2.5%)
  Spam: 0 (0.0%)
```

### Step 4: Weekly Summary (Fridays only)

```
:bar_chart: WEEKLY OUTREACH SUMMARY

Coverage:
  TAM Size: 15,000
  Contacted This Cycle: 4,800 (32%)
  Remaining: 10,200
  Projected Cycle Completion: April 14

Performance:
  Emails Sent: 2,400
  Positive Replies: 62 (2.6%)
  Meetings Booked: 14
  Bounce Rate: 1.8% (healthy)
  Spam Rate: 0.02% (healthy)

Active Domains:
  truvdata.io — healthy
  truvverify.com — healthy
  truvinsights.co — warming up (day 8/14)
```

---

## Data Storage

Store weekly metrics in a Pipedream data store for week-over-week comparison:

```json
{
  "2026-03-07": {
    "total_sent": 2400,
    "total_replies": 62,
    "total_bounces": 43,
    "total_spam": 0,
    "contacts_reached": 1200,
    "by_domain": {
      "truvdata.io": { "sent": 1200, "bounces": 20, "replies": 31 },
      "truvverify.com": { "sent": 1200, "bounces": 23, "replies": 31 }
    }
  }
}
```

---

## Setup Notes

- Use `axios` for Smartlead API calls (Pipedream doesn't have a native Smartlead app)
- Slack webhook via Pipedream's built-in Slack app to #outreach-intelligence
- Pipedream data store for week-over-week comparison data
- Friday summary uses a `new Date().getDay() === 5` check
