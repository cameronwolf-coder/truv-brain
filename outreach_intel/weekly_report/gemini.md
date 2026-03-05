# Weekly Outreach Intelligence Report - Project Map

**Status:** Phase 2 - Implementation Ready
**Last Updated:** 2026-01-21

---

## North Star

Every Friday at 10 AM, a Slack message surfaces the top re-engagement opportunities with AI-generated rationale, and a HubSpot list is auto-created for immediate action.

---

## Integrations

| Service | Status | Purpose |
|---------|--------|---------|
| HubSpot | ✅ Connected | Source of truth - contacts, deals, engagement |
| Slack | ⏳ Needs setup | Delivery channel (DM for testing, then channels) |
| Pipedream | ⏳ Needs setup | Scheduler (cron) + workflow orchestration |
| OpenAI | ✅ Available | Rationale enhancement (company key in Pipedream) |

**HubSpot Portal ID:** 19933594
**Schedule:** Friday 7:30 AM Central Time
**Slack Target:** DM to Cameron (testing), then configurable channels

---

## Behavioral Rules

### Query Logic
- **Sources:** Dormant + Closed-Lost + Churned (mixed, ranked by score)
- **List size:** Configurable (default: 10)

### Exclusions (Do Not Contact)
1. Contacts emailed within last 30 days (`hs_email_last_send_date`)
2. Contacts with `@truv.com` email domain (internal)
3. Active customers (already excluded by lifecycle stage)

### Rationale Generation
- **Layer 1 (Deterministic):** Rule-based signals
  - "Recent email engagement (opened X days ago)"
  - "Multiple contacts at this account (N total)"
  - "Was in late-stage pipeline (reached [stage])"
  - "Previously had meeting scheduled"
  - "Churned customer - win-back opportunity"
- **Layer 2 (AI):** Claude enhances into natural, actionable sentence

---

## Data Schema

### Input: HubSpot Contact (Raw)
```json
{
  "id": "123456",
  "properties": {
    "firstname": "John",
    "lastname": "Smith",
    "email": "john@company.com",
    "jobtitle": "VP Operations",
    "company": "Acme Corp",
    "lifecyclestage": "268636563",
    "hs_email_last_send_date": "2025-12-15",
    "hs_email_last_open_date": "2025-12-20",
    "notes_last_updated": "2025-11-01",
    "num_associated_deals": "2"
  }
}
```

### Output: Scored Contact with Rationale
```json
{
  "contact_id": "123456",
  "name": "John Smith",
  "title": "VP Operations",
  "company": "Acme Corp",
  "email": "john@company.com",
  "score": 49.5,
  "category": "closed_lost",
  "score_breakdown": {
    "engagement": 15,
    "timing": 70,
    "deal_context": 80,
    "external_trigger": 40
  },
  "signals": [
    "Opened email 32 days ago",
    "Reached Business Case stage before closing",
    "2 deals associated with contact"
  ],
  "rationale": "John was evaluating Truv for consumer underwriting and reached the Business Case stage. Recent email engagement suggests continued interest - good time to re-engage with new product updates."
}
```

### Output: Slack Payload
```json
{
  "channel": "#sales-opportunities",
  "blocks": [
    {
      "type": "header",
      "text": "Weekly Outreach Intelligence - Jan 24, 2026"
    },
    {
      "type": "section",
      "text": "TOP 10 RE-ENGAGEMENT OPPORTUNITIES"
    },
    {
      "type": "section",
      "text": "1. **John Smith** (VP Operations @ Acme Corp)\n   Score: 49.5 | Closed Lost\n   Why now: John was evaluating Truv for consumer underwriting..."
    },
    {
      "type": "section",
      "text": "HubSpot List: <https://app.hubspot.com/contacts/123/lists/9082|Weekly Outreach - Jan 24>"
    }
  ]
}
```

### Output: HubSpot List
```json
{
  "listId": "9082",
  "name": "Weekly Outreach - Jan 24, 2026",
  "url": "https://app.hubspot.com/contacts/{portal_id}/lists/{list_id}",
  "contact_count": 10
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PIPEDREAM WORKFLOW                          │
│                  (Cron: Friday 10:00 AM PT)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STEP 1: FETCH & FILTER                       │
│  • Query HubSpot: dormant + closed-lost + churned               │
│  • Apply exclusions: 30-day email, @truv.com domain             │
│  • Score all contacts                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STEP 2: GENERATE RATIONALE                     │
│  • Extract signals (deterministic rules)                        │
│  • Send to Claude API for natural language enhancement          │
│  • Return enriched contact list                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STEP 3: CREATE HUBSPOT LIST                    │
│  • Create list: "Weekly Outreach - {date}"                      │
│  • Add top N contacts to list                                   │
│  • Generate list URL                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STEP 4: SEND SLACK MESSAGE                     │
│  • Format Slack blocks with contacts + rationale                │
│  • Include HubSpot list link                                    │
│  • Post to configured channel                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
outreach_intel/weekly_report/
├── gemini.md              # This file - Project Map
├── architecture/
│   └── weekly_report.md   # SOP for the workflow
├── tools/
│   ├── fetch_contacts.py  # Step 1: Query + filter + score
│   ├── generate_rationale.py  # Step 2: Signals + Claude
│   ├── create_list.py     # Step 3: HubSpot list
│   └── send_slack.py      # Step 4: Slack message
└── .tmp/                  # Intermediate files (ephemeral)
```

---

## Implementation Phases

### Phase 1: Link (Connectivity)
- [x] Set up Slack webhook/app
- [x] Verify OpenAI API key (using company key in Pipedream)
- [x] Test Pipedream → HubSpot connection

### Phase 2: Architect (Build Tools)
- [x] Step 1: `fetch_contacts` - Query + filter + 30-day exclusion + domain filter
- [x] Step 2: `score_contacts` - Engagement/timing/deal scoring
- [x] Step 3: `generate_rationale` - Signal extraction + OpenAI call
- [x] Step 4: `create_hubspot_list` - Create list + add contacts
- [x] Step 5: `send_slack` - Format blocks + DM to Cameron (U09D29RJKRA)

### Phase 3: Stylize (Refinement)
- [ ] Polish Slack message formatting
- [ ] Test with real data
- [ ] User feedback loop

### Phase 4: Trigger (Deployment)
- [ ] Deploy to Pipedream
- [ ] Set cron schedule (Friday 10 AM PT)
- [ ] Document maintenance procedures

---

## Open Questions

~~All resolved.~~

---

## Context Handoff

**2026-01-21 (AM):** Blueprint created and approved. All integrations confirmed.

**2026-01-21 (PM):** Full Pipedream workflow built:
- 5-step Node.js workflow ready to paste into Pipedream
- Cron: `30 13 * * 5` (Friday 7:30 AM CT / 1:30 PM UTC)
- Slack DM target: U09D29RJKRA (Cameron)
- Using OpenAI gpt-4o-mini for rationale generation
Next step: Paste code into Pipedream, connect apps, run manual test.
