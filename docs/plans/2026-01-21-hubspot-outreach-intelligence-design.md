# Truv Outreach Intelligence - Design Document

**Date:** 2026-01-21
**Status:** Draft - Pending Approval

---

## Overview

An AI-powered sales intelligence tool that connects to HubSpot, identifies high-potential dormant contacts, scores them for likelihood to respond, and generates campaign messaging - turning a manual, inconsistent process into a weekly ritual.

### Problem

- Manual process: filtering HubSpot by deal status or persona fit
- Inconsistent execution: happens sporadically, not systematically
- Time-consuming: research, scoring, and messaging creation is slow
- Tribal knowledge: persona logic exists in heads, docs, and HubSpot fields separately

### Solution

A conversational tool that:
1. Analyzes the entire HubSpot database (excluding active customers)
2. Scores contacts using a weighted signal framework
3. Matches against codified persona definitions
4. Generates structured messaging suggestions
5. Creates HubSpot lists for export to sending tools

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        HubSpot                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Contacts   │  │    Deals     │  │ Engagement Data  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              HubSpot API (Private App Token)                │
│  READ:  Contacts, deals, activities, lists, properties      │
│  WRITE: Create lists, manage list membership, tag contacts  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI Scoring Engine                        │
│  • Persona matching (HubSpot fields + docs + tribal logic)  │
│  • Weighted response likelihood scoring                     │
│  • Opportunity surfacing and ranking                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Two Interaction Modes                      │
│  ┌─────────────────────┐    ┌────────────────────────────┐ │
│  │   Weekly Report     │    │   Interactive Queries      │ │
│  │   (automated)       │    │   ("who should I target?") │ │
│  └─────────────────────┘    └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Campaign Builder                          │
│  • Structured messaging suggestions (REPLY method)          │
│  • Editable before export                                   │
│  • Create HubSpot lists                                     │
│  • Export to Knock / SmartLead / CSV                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Source: HubSpot

### Authentication

- **Method:** HubSpot Private App Token
- **Storage:** Environment variable (not hardcoded)

### Required Scopes (confirmed available)

- `crm.objects.contacts.read` / `crm.objects.contacts.write`
- `crm.objects.deals.read`
- `crm.lists.read` / `crm.lists.write`
- `crm.schemas.contacts.read`
- `crm.schemas.deals.read`
- `crm.schemas.companies.read`

---

## Exclusion Logic

### Lifecycle Stages to EXCLUDE

| Stage | Value | Reason |
|-------|-------|--------|
| Open Deal | `opportunity` | Actively being worked |
| Opportunity | `1154636674` | Actively being worked |
| Implementing Customer | `customer` | Active customer |
| Live Customer | `268792390` | Active customer |
| Indirect Customer | `1012659574` | Active customer |
| Customer | `1154761341` | Active customer |
| Advocate | `1070076549` | Active customer |
| Disqualified / Opt-Out | `other` | Opted out |

### Lifecycle Stages to INCLUDE

| Stage | Value | Use Case |
|-------|-------|----------|
| New | `subscriber` | Cold leads that went dormant |
| Lead | `lead` | Cold leads |
| Marketing Qualified Lead | `marketingqualifiedlead` | MQLs that went cold |
| Sales Accepted Lead | `salesqualifiedlead` | SALs that went cold |
| Closed Lost | `268636563` | Re-engagement targets |
| Churned Customer | `268798100` | Win-back targets |

### Deal Stage Exclusions

Exclude contacts with associated deals in "Closed Won" stage in any pipeline:
- Enterprise Sales Pipeline: `1f7d22d8-b3fd-4918-82c3-ddaa9bdb8a52`
- Self-Service Pipeline: `1092340356`
- Renewals Pipeline: `979907381`

---

## Scoring Engine

### Signal Weights (from signals.md)

**Engagement History (25%)**
- Past email opens/clicks
- Meeting attendance
- Website visits
- Content downloads

**Timing Signals (25%)**
- Days since last contact
- Where they stalled in pipeline
- Seasonality factors

**Deal Context (30%)**
- Why they said no (budget, timing, competitor, not ready)
- Deal stage reached before closing
- Historical deal value

**External Triggers (20%)**
- Job changes
- Company news/funding
- Hiring signals

### Persona Matching

Synthesized from three sources:
1. **HubSpot fields:** `jobtitle`, `industry`, `sales_vertical`, `employee_count`, tech stack fields
2. **Documentation:** Customer personas in `/docs/customer-personas.md`
3. **Codified rules:** Industry-specific logic from `/rules/use_cases/*.md`

### Output Scores

Each contact receives:
- **Persona Fit Score** (0-100): How well they match ICP
- **Response Likelihood Score** (0-100): How likely to engage now
- **Priority Rank**: Combined score for sorting

---

## Interaction Modes

### Mode 1: Weekly Report (Proactive)

Automated summary generated weekly:

```
Weekly Outreach Opportunities - [Date]

Settings: Top [N] contacts (configurable)

TOP [N] CONTACTS TO RE-ENGAGE:
┌─────────────────────────────────────────────────────────────┐
│ 1. [Name] ([Title] @ [Company])                             │
│    Score: [X] | [Context] | [Recent signal]                 │
│    Suggested angle: "[Opening hook]"                        │
├─────────────────────────────────────────────────────────────┤
│ 2. ...                                                      │
└─────────────────────────────────────────────────────────────┘

SEGMENTS HEATING UP:
• [Segment] ([N] high-score contacts) - [Reason]

QUICK ACTIONS:
• Create list from top [N]
• Generate campaign for [segment]
• Drill into any contact
```

**List size options:** 10, 25, 50, 100, or custom

### Mode 2: Interactive Queries (On-Demand)

Natural language questions:
- "Who are the best closed-lost deals to re-engage from Q3?"
- "I'm launching a campaign around asset verification - who should I target?"
- "Show me the top 50 dormant contacts in mortgage lending"
- "Why is [contact] ranked so high?"
- "Create a list of 30 contacts for the home equity campaign"

---

## Campaign & Messaging Builder

### Rules Integration

The system uses existing campaign rules from `/rules/`:

| File | Purpose |
|------|---------|
| `copywriting.md` | REPLY method, word counts, prohibited language |
| `signals.md` | Scoring weights, playbooks, priority tiers |
| `personalization.md` | HubSpot fields for personalization |
| `campaign_template/system.md` | Email structure, sequence flow |
| `use_cases/*.md` | Industry-specific pain points and proof points |
| `tech_stack/*.md` | Integration-specific messaging |

### Messaging Output

For a selected segment, AI provides structured suggestions:

```
CAMPAIGN: [Name] ([N] contacts)

SUGGESTED ANGLES:
┌─────────────────────────────────────────────────────────────┐
│ Angle A: "[Name]"                                           │
│ • For: [Segment criteria]                                   │
│ • Hook: [Opening approach]                                  │
│ • Sample: "[Draft email - editable]"                        │
├─────────────────────────────────────────────────────────────┤
│ Angle B: ...                                                │
└─────────────────────────────────────────────────────────────┘
```

### Email Requirements (from copywriting.md)

- **Structure:** REPLY method (Reason → Problem → Value → CTA)
- **Length:** 50-100 words based on seniority
- **Format:** No greeting, no signature, no links, no CTAs
- **Tone:** Human, conversational, not AI slop
- **Prohibited:** Buzzwords, AI mentions, platform language, ROI claims

### Workflow

1. AI generates structured suggestions following rules
2. User reviews and edits copy
3. AI flags deliverability concerns
4. User approves final version
5. Create HubSpot list or export

---

## Export Options

### Primary: HubSpot Lists

- Create named list in HubSpot (e.g., "Q1 Fintech Re-engagement - Jan 2026")
- Add qualified contacts to list
- List serves as paper trail and export source

### Secondary: External Tools

- **Knock:** Push via Knock API (primary sending tool)
- **SmartLead:** Push via SmartLead MCP
- **CSV:** Download for manual import anywhere

---

## Implementation Phases

### Phase 1: Foundation
- [ ] HubSpot API integration (read/write)
- [ ] Load campaign rules into AI context
- [ ] Basic interactive queries ("show me dormant fintech contacts")
- [ ] Simple list creation

### Phase 2: Scoring & Analysis
- [ ] Implement signal scoring from signals.md
- [ ] Persona matching logic
- [ ] Priority ranking algorithm
- [ ] Exclusion filters

### Phase 3: Campaign Generation
- [ ] Messaging suggestions using copywriting.md
- [ ] Edit/refine workflow
- [ ] Angle selection and customization
- [ ] Deliverability flagging

### Phase 4: Automation & Polish
- [ ] Weekly report generation
- [ ] Configurable list sizes
- [ ] Export to Knock/SmartLead
- [ ] Notification delivery (path of least resistance)

---

## Technical Notes

### HubSpot API Endpoints

**Contacts:**
- `GET /crm/v3/objects/contacts` - Query contacts
- `POST /crm/v3/objects/contacts/search` - Search with filters

**Deals:**
- `GET /crm/v3/objects/deals` - Query deals
- Association endpoints for contact-deal relationships

**Lists:**
- `GET /crm/v3/lists` - Get lists
- `POST /crm/v3/lists` - Create list
- `PUT /crm/v3/lists/{listId}/memberships` - Add contacts to list

**Properties:**
- `GET /crm/v3/properties/contacts` - Get contact properties
- `GET /crm/v3/pipelines/deals` - Get deal stages

### Key HubSpot Fields for Personalization

From `personalization.md`:
- `firstname`, `lastname`, `email`, `jobtitle`
- `company.name`, `company.domain`
- `sales_vertical`, `industry`, `employee_count`
- Tech stack: `mortgage_los__new_`, `mortgage_pos__new_`, etc.
- Volume: `mortgage_loan_volume`, `mortgage_loan_count`

---

## Success Criteria

1. **Consistency:** Weekly report generated and reviewed every week
2. **Speed:** Campaign research + messaging in <30 minutes vs. hours
3. **Quality:** Emails follow copywriting rules, no prohibited language
4. **Coverage:** Identify opportunities that would otherwise be missed
5. **Conversion:** Track response rates on AI-assisted campaigns

---

## Open Questions

None - ready for implementation.

---

## Appendix: HubSpot Schema Reference

### Lifecycle Stage Values

| Label | Value |
|-------|-------|
| New | `subscriber` |
| Lead | `lead` |
| Marketing Qualified Lead | `marketingqualifiedlead` |
| Sales Accepted Lead | `salesqualifiedlead` |
| Closed Lost | `268636563` |
| Open Deal | `opportunity` |
| Channel Partner | `1011937310` |
| Implementing Customer | `customer` |
| Live Customer | `268792390` |
| Indirect Customer | `1012659574` |
| Advocate | `1070076549` |
| Churned Customer | `268798100` |
| Disqualified / Opt-Out | `other` |
| Opportunity | `1154636674` |
| Customer | `1154761341` |

### Deal Pipelines

**Enterprise Sales Pipeline** (`a0b189e7-967d-4036-bba5-6023ed5f7262`)
- 00. Research
- 01. Discovery
- 02. Business Case
- 03. Selected Vendor
- 04. Negotiation
- Closed Won (`1f7d22d8-b3fd-4918-82c3-ddaa9bdb8a52`)
- Closed Lost (`539d903e-288f-4549-978e-29548945b1f8`)

**Self-Service Deals Pipeline** (`751261871`)
- Qualified Lead
- Demo
- Decision Maker Bought In
- Closed Won (`1092340356`)
- Closed Lost (`1092340357`)

**Renewals Only Pipeline** (`666967581`)
- Opportunity
- Proposal
- Negotiation
- Contract Sent
- Closed-Won (`979907381`)
- Closed-Lost (`979907382`)
