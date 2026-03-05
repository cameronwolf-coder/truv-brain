# Project Map (B.L.A.S.T.)

## Status
- **Phase:** Architect (Building Phase 1)
- **Reference:** `/docs/plans/2026-01-21-hubspot-outreach-intelligence-design.md`
- **Blueprint Approved:** Jan 21, 2026
- **Link Verified:** Jan 21, 2026

---

## Discovery Questions

### North Star
Turn manual, inconsistent campaign research into a **weekly ritual** - campaign research + messaging in **<30 minutes** vs. hours. Track response rates on AI-assisted campaigns.

### Integrations
| Service | Purpose | Status |
|---------|---------|--------|
| HubSpot | Source of truth (contacts, deals, engagement) | ✅ Connected |
| Slack | Deliver reports to #outreach-intelligence | ✅ Connected (C0A9Y5HLQAF) |
| Pipedream | Orchestration & scheduling | ✅ Connected |
| Clay | View scored contacts, enrich, manual review | 🔲 HTTP API (webhook) |
| SmartLead | Email sequence execution | ✅ API available |

### Source of Truth
**HubSpot CRM** via Private App Token
- Contacts + properties
- Deals + pipeline stages
- Engagement data (email opens, clicks, meetings)
- Lists (read/write)

### Delivery Payload
1. **Weekly Report** (automated Friday 7:30 AM CST)
   - Top N contacts ranked by priority
   - Segment insights ("Fintech heating up")
   - Quick actions (create list, generate campaign)

2. **Interactive Queries** (on-demand)
   - "Who are the best closed-lost deals to re-engage from Q3?"
   - "Show me top 50 dormant contacts in mortgage lending"
   - "Create a list of 30 contacts for home equity campaign"

3. **Campaign Builder** (on-demand)
   - Messaging suggestions using REPLY method
   - Edit/refine workflow
   - Export to HubSpot List / SmartLead / CSV

### Behavioral Rules

**1. Exclusion Logic**
| Exclude | Value | Reason |
|---------|-------|--------|
| Open Deal | `opportunity` | Actively worked |
| Opportunity | `1154636674` | Actively worked |
| Implementing Customer | `customer` | Active customer |
| Live Customer | `268792390` | Active customer |
| Indirect Customer | `1012659574` | Active customer |
| Customer | `1154761341` | Active customer |
| Advocate | `1070076549` | Active customer |
| Disqualified | `other` | Opted out |

Also exclude contacts with Closed Won deals in any pipeline.

**2. Include (Dormant Pool)**
| Include | Value | Use Case |
|---------|-------|----------|
| New | `subscriber` | Cold leads gone dormant |
| Lead | `lead` | Cold leads |
| MQL | `marketingqualifiedlead` | MQLs gone cold |
| SAL | `salesqualifiedlead` | SALs gone cold |
| Closed Lost | `268636563` | Re-engagement |
| Churned | `268798100` | Win-back |

---

## Scoring Engine

### Signal Weights

| Dimension | Weight | Signals |
|-----------|--------|---------|
| **Engagement History** | 25% | Email opens/clicks, meeting attendance, website visits, content downloads |
| **Timing Signals** | 25% | Days since last contact, where stalled in pipeline, seasonality |
| **Deal Context** | 30% | Why they said no, deal stage reached, historical deal value |
| **External Triggers** | 20% | Job changes, company news/funding, hiring signals |

### Persona Matching (3 Sources)

1. **HubSpot Fields:** `jobtitle`, `industry`, `sales_vertical`, `employee_count`, tech stack
2. **Documentation:** `/docs/personas.md`
3. **Codified Rules:** `/rules/use_cases/*.md` (to be created)

### Output Scores

| Score | Range | Description |
|-------|-------|-------------|
| Persona Fit | 0-100 | How well they match ICP |
| Response Likelihood | 0-100 | How likely to engage now |
| Priority Rank | Combined | For sorting |

---

## Data Schema

### Input (HubSpot Contact)
```json
{
  "id": "123456",
  "properties": {
    "firstname": "John",
    "lastname": "Smith",
    "email": "john@acmelending.com",
    "jobtitle": "VP Operations",
    "company": "Acme Lending",
    "lifecyclestage": "268636563",
    "hs_lead_status": "Closed Lost - Timing",
    "hs_email_last_open_date": "2025-11-15T10:30:00Z",
    "hs_email_last_click_date": "2025-11-10T14:22:00Z",
    "notes_last_updated": "2025-12-01T09:00:00Z",
    "sales_vertical": "IMB",
    "industry": "Mortgage",
    "mortgage_los__new_": "Encompass",
    "mortgage_loan_volume": "500000000"
  },
  "associations": {
    "deals": [
      {
        "id": "789",
        "properties": {
          "dealstage": "539d903e-288f-4549-978e-29548945b1f8",
          "closedate": "2025-10-15",
          "closed_lost_reason": "Timing - not ready"
        }
      }
    ]
  }
}
```

### Output (Scored Contact)
```json
{
  "id": "123456",
  "name": "John Smith",
  "email": "john@acmelending.com",
  "jobtitle": "VP Operations",
  "company": "Acme Lending",
  "sales_vertical": "IMB",
  "scores": {
    "engagement": 45,
    "timing": 70,
    "deal_context": 80,
    "external_triggers": 40,
    "persona_fit": 85,
    "response_likelihood": 62,
    "priority_rank": 1
  },
  "context": {
    "last_contact": "2025-12-01",
    "days_dormant": 51,
    "closed_lost_reason": "Timing - not ready",
    "deal_stage_reached": "Business Case",
    "recent_signal": "Opened email 2 weeks ago"
  },
  "suggested_angle": "Q1 budget timing + Encompass integration"
}
```

### Output (Weekly Report - Slack)
```
🎯 *Weekly Outreach Intelligence - Jan 24, 2026*

📊 *Summary*
• Contacts analyzed: 1,247
• Dormant pool: 523
• Top opportunities: 50

🔝 *TOP 10 RE-ENGAGEMENT OPPORTUNITIES*

1. *John Smith* (VP Operations @ Acme Lending)
   Score: 85 | Closed Lost - Timing | Opened email 2 weeks ago
   Angle: "Q1 budget timing + Encompass integration"

2. *Jane Doe* (Director @ First National)
   Score: 78 | SAL gone cold | Job change detected
   Angle: "New role congrats + fresh look"

...

📈 *SEGMENTS HEATING UP*
• IMB Closed-Lost (23 high-score contacts) - Q1 budget cycle
• Credit Unions (15 contacts) - Compliance deadline approaching

⚡ *QUICK ACTIONS*
• Create list from top 50
• Generate campaign for IMB segment
• Drill into any contact
```

---

## Implementation Phases

### Phase 1: Foundation ← **START HERE**
- [ ] HubSpot API integration (read contacts, deals, engagement)
- [ ] Basic exclusion filter logic
- [ ] Simple scoring (engagement + timing + deal context)
- [ ] Weekly report to Slack
- [ ] Create HubSpot list from results

### Phase 2: Scoring & Analysis
- [ ] Full signal scoring from design doc
- [ ] Persona matching logic
- [ ] Deal association queries (closed lost reasons)
- [ ] Priority ranking algorithm

### Phase 3: Campaign Generation
- [ ] Create `/rules/` files (copywriting.md, signals.md, etc.)
- [ ] Messaging suggestions using REPLY method
- [ ] Edit/refine workflow
- [ ] Deliverability flagging

### Phase 4: Automation & Polish
- [ ] Interactive query mode
- [ ] Configurable list sizes
- [ ] Export to SmartLead/Knock
- [ ] Response rate tracking

---

## Files to Create

| File | Purpose | Phase |
|------|---------|-------|
| `/rules/copywriting.md` | REPLY method, word counts, prohibited language | Phase 3 |
| `/rules/signals.md` | Scoring weights, playbooks, priority tiers | Phase 2 |
| `/rules/personalization.md` | HubSpot fields for personalization | Phase 3 |
| `/rules/use_cases/*.md` | Industry-specific pain points | Phase 3 |

---

## Context Handoff

- **Jan 21, 2026 (init):** Initialized B.L.A.S.T. Blueprint from design doc.
- **Jan 21, 2026 (link):** Blueprint approved. Link phase complete - HubSpot contacts/deals and Slack verified. Ready for Architect phase.

### Link Verification Results
- HubSpot Contacts: ✅ All properties accessible (lifecyclestage, sales_vertical, engagement dates)
- HubSpot Deals: ✅ closed_lost_reason accessible (sample: "Adam very interested but has other projects ahead of us")
- Slack: ✅ Message sent to C0A9Y5HLQAF

---

## Approval Checklist

- [x] North Star confirmed (weekly ritual, <30 min research)
- [x] Scoring weights approved (Engagement 25%, Timing 25%, Deal 30%, External 20%)
- [x] Exclusion logic approved
- [x] Data schema approved
- [x] Phase 1 scope approved
- [x] **Blueprint approved - Jan 21, 2026**
