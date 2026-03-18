# Clay Workspace Audit — Truv (Workspace 276559)

**Date:** March 13, 2026
**Account:** Cam Wolf (truv.com)
**Purpose:** Full platform audit to inform transition planning

---

## 1. Workspace Overview

| Metric | Value |
|--------|-------|
| **Top-level folders** | 8 (Archive, Coverage Analysis, Enrichment & Scoring, Find Contacts for AE, Outbound Campaigns, Recruiting, Target Companies, Under Construction) |
| **Standalone workbooks** | 6 ([Inbound] Campaign Master Table, Custom Signal, Find People x4, HIT Summit 2026) |
| **Active users** | 3 — Cam Wolf (you), Kirill Klokov, Sofia Khair |
| **Oldest table** | Aug 21, 2024 (Enrichment & Scoring folder) |
| **Most recently used** | Mar 9, 2026 (Enrichment & Scoring, Custom Signal) |

---

## 2. Core Tables & Row Counts

### Enrichment & Scoring (heaviest usage)

| Table | Rows | Columns | Credits/Row | Owner |
|-------|------|---------|-------------|-------|
| **Enrich new contacts with Email** | 49,793 | 50 | ~12.6 | Kirill Klokov |
| **Enrich new and target companies** | 18,684 | 29 | — | Kirill Klokov |
| **Enrich new contacts with LinkedIn** | 8,830 | 60 | ~8.1 | Kirill Klokov |
| **Enriching the Mobile Phone** | 1,254 | 36 | ~42.5 | Kirill Klokov |
| **LinkedIn Ads Audience** | — | — | — | Cam Wolf |
| **Personalizations** | — | — | — | Kirill Klokov |
| **Find decision makers** | — | — | — | Kirill Klokov |
| **Find Decision Makers Before Enrichment** | — | — | — | Kirill Klokov |

### Inbound Leads (lead scoring/routing)

| Table | Rows | Columns |
|-------|------|---------|
| **Scoring** | 168 | 33 |
| **Government Pool** | 71 | 13 |
| **Nurture to Qualify Sequence** | 210 | 10 |
| **Routing v2** | 124 | 18 |
| **SDR Leads** | 10 | 13 |
| **IMB MQL** | 3 | 14 |
| + 6 Webhook sources | 1,769 total | — |

### Outbound Campaigns

| Workbook | Created | Last Used | Owner |
|----------|---------|-----------|-------|
| HIT Summit | Feb 17, 2026 | Mar 9, 2026 | Cam Wolf |
| [Outbound] CCM Webinar | Dec 2, 2025 | Feb 10, 2026 | Cam Wolf |
| [Outbound] CCM $10m Savings Campaign | Nov 24, 2025 | Dec 11, 2025 | Cam Wolf |
| Closed/Lost Personalization | Sep 10, 2025 | Dec 18, 2025 | Cam Wolf |
| HR1 Campaign | Nov 11, 2025 | Dec 2, 2025 | Cam Wolf |
| [Outbound] Q4 2025 Promo | Nov 3, 2025 | Nov 24, 2025 | Cam Wolf |
| Freddie Mac Connect | Nov 4, 2025 | Nov 24, 2025 | Cam Wolf |
| One-off Verifications | Aug 26, 2025 | never | Kirill Klokov |

**Total estimated rows across all tables: ~80,000+**

---

## 3. Integration Map

### HubSpot (Bidirectional — most critical)
- **Inbound:** Webhook triggers push new contacts/companies from HubSpot into Clay tables
- **Lookup:** Every enrichment table starts with a `Lookup object` action to pull current HubSpot data (contact fields prefixed `Hs_*`)
- **Outbound:** Every enrichment table ends with an `Update object` action pushing enriched data back to HubSpot
- **Import:** Some tables (HIT Summit) use direct HubSpot object imports
- **Fields synced back:** enrichment status, lifecycle stage, LinkedIn URL, work email, phone, first/last name, job title, buying score, use case category, company profile

### Enrichment Providers (Waterfall Pattern)
Clay uses a "waterfall" approach — tries multiple providers in sequence until a match is found:

| Provider | Used For | Tables |
|----------|----------|--------|
| **Clay native enrichment** | Company domain, industry, employee count | Enrich Companies |
| **Clearbit** | Company industry, domain, employees, LinkedIn URL | Enrich Companies |
| **Waterfall Find Work Email** | Work email discovery (multi-provider) | Contact Enrichment (LinkedIn) |
| **Waterfall LinkedIn Profile** | LinkedIn URL lookup (multi-provider) | Contact Enrichment (Email) |
| **Waterfall Mobile Phone** | US/Canada phone numbers (multi-provider) | Mobile Phone Enrichment |
| **Waterfall First/Last Name** | Name resolution from email | Contact Enrichment (Email) |
| **Waterfall Job Title** | Title enrichment | Contact Enrichment (Email) |
| **Claygent (AI agent)** | 2nd-attempt LinkedIn URL finder | Contact Enrichment (Email) |
| **Email Validation** | Deliverability, free email detection | Contact Enrichment (Email) |
| **Phone Validation** | Line type, activity score | Mobile Phone Enrichment |
| **Enrich Person from LinkedIn** | Full profile enrichment from LinkedIn URL | Contact Enrichment (both) |

### AI/Model Scoring
- **Quick Score** — AI buying intent scoring on contacts
- **Buying Score** — numerical score output
- **Primary Use Case Category** — AI classification of companies into Truv use cases
- **Score Contact (2-pass)** — lifecycle stage determination with rationale
- **Research Brief** — AI-generated contact research summaries

### Slack
- `Lookup Mismatch (Slack)` action fires notifications when HubSpot lookups fail
- Channel likely #outreach-intelligence or similar

### Other
- **Webhooks** — 3+ webhook endpoints feeding contact/company data (triggered from HubSpot workflows)
- **CSV Import** — used for one-off list building

---

## 4. Data Flow Architecture

```
HubSpot Contact/Company Created or Updated
          │
          ▼
    HubSpot Workflow fires Webhook
          │
          ▼
    ┌─────────────────────────────────┐
    │        CLAY WORKSPACE           │
    │                                 │
    │  1. Lookup object in HubSpot    │
    │  2. Waterfall enrichment        │
    │     (email/LinkedIn/phone)      │
    │  3. Validate (email/phone)      │
    │  4. AI scoring & classification │
    │  5. Consolidate "Final" fields  │
    │  6. Update object in HubSpot    │
    │                                 │
    │  On failure → Slack alert       │
    └─────────────────────────────────┘
          │
          ▼
    HubSpot contact updated with:
    - Verified work email
    - LinkedIn URL
    - Mobile phone
    - Buying score
    - Use case category
    - Enrichment status
    - Lifecycle stage
```

---

## 5. Who Uses What

| User | Primary Tables | Role |
|------|---------------|------|
| **Kirill Klokov** | Contact Enrichment, Enrich Companies, Inbound Leads, Find Decision Makers, Personalizations, [Inbound] Campaign Master Table | Owns the enrichment engine — all automated pipelines |
| **Cam Wolf** | Outbound Campaigns (7 workbooks), LinkedIn Ads Audience, Custom Signal, HIT Summit 2026 | Campaign list building, outbound targeting, event outreach |
| **Sofia Khair** | Find People (4 workbooks) | Ad hoc people finding |

---

## 6. Features You're Actually Using

### Heavy Use
1. **Waterfall enrichment** (email, LinkedIn, phone, name, title) — the core value prop
2. **HubSpot bidirectional sync** (webhook in, API update out)
3. **AI scoring/classification** (buying intent, use case categorization, lifecycle staging)
4. **Email validation** (deliverability, free email detection)
5. **Phone validation** (line type, activity scoring)

### Moderate Use
6. **Clearbit company enrichment** (industry, employee count)
7. **Slack alerting** (lookup mismatches)
8. **Claygent AI agent** (fallback LinkedIn URL finder)
9. **HubSpot object imports** (direct list pulls for campaigns)
10. **Inbound lead scoring & routing** (webhook → score → route → update)

### Light Use
11. **Find People** (ad hoc prospecting by Sofia)
12. **CSV imports** (one-off campaign lists)
13. **Campaign list building** (outbound workbooks)

---

## 7. Transition Considerations

### What Clay Does That You'd Need to Replicate

| Capability | Complexity to Replace | Notes |
|------------|----------------------|-------|
| **Waterfall email finding** | Medium | Multiple providers tried in sequence. Apollo, Hunter, Clearbit, etc. each have APIs. Your existing `outreach_intel/` Python tooling could orchestrate this. |
| **Waterfall LinkedIn lookup** | Medium | Similar multi-provider approach. Proxycurl, RocketReach, etc. |
| **Waterfall phone enrichment** | Medium-High | ~42.5 credits/row suggests expensive multi-source lookups. Lusha, Cognism, ZoomInfo APIs. |
| **Email validation** | Easy | ZeroBounce, NeverBounce, or Reacher have simple APIs. Already partially built in your data-enrichment tool. |
| **Phone validation** | Easy | Twilio Lookup API or similar. |
| **Company enrichment** | Easy-Medium | Already using Clearbit directly + Clay native. Could use Clearbit API + Firecrawl (you already have this in data-enrichment). |
| **AI scoring/classification** | Easy | Already doing this in `outreach_intel/scorer.py`. Claude/GPT API calls with your own prompts. |
| **HubSpot webhook triggers** | Easy | Pipedream already handles this. |
| **HubSpot API updates** | Easy | Already built in `outreach_intel/hubspot_client.py`. |
| **Slack notifications** | Easy | Already built in Pipedream workflows. |
| **Inbound lead routing** | Medium | The multi-table scoring → routing → pool assignment logic would need to be rebuilt as a Pipedream workflow or Python service. |

### What You Already Have That Overlaps

- **`outreach_intel/hubspot_client.py`** — full HubSpot CRUD (contacts, companies, deals, lists)
- **`data-enrichment/` route** — AI-powered company enrichment with Firecrawl + OpenAI (4 specialized agents)
- **`outreach_intel/scorer.py`** — contact scoring engine (engagement, timing, deal context, external triggers)
- **Pipedream workflows** — webhook handling, HubSpot automation, Slack notifications
- **`outreach_intel/smartlead_uploader.py`** — contact export pipeline

### Recommended Migration Path

1. **Phase 1 — Stop new Outbound Campaign tables in Clay.** You're already doing this with Smartlead + HubSpot + Pipedream. The HIT Summit table was just a HubSpot import anyway.

2. **Phase 2 — Replace company enrichment.** Extend your `data-enrichment` tool to hit Clearbit API directly. You already have Firecrawl + OpenAI agents doing this.

3. **Phase 3 — Replace contact enrichment (the big one).** Build a Pipedream workflow or Python service that:
   - Receives HubSpot webhook
   - Calls email-finding APIs in waterfall (Apollo → Hunter → Clearbit)
   - Calls LinkedIn lookup APIs in waterfall (Proxycurl → RocketReach)
   - Validates emails (ZeroBounce/NeverBounce)
   - Scores with your existing scorer + Claude API
   - Pushes back to HubSpot

4. **Phase 4 — Replace inbound lead scoring.** Migrate the Scoring table logic to a Pipedream workflow using your existing `scorer.py` patterns.

5. **Phase 5 — Decommission.** Turn off HubSpot → Clay webhooks, cancel subscription.

### Cost Comparison
- Clay credits are consumed at 8-42 credits/row depending on table
- Direct API calls to the same providers would likely cost 30-60% less (no Clay markup)
- But you'd own the orchestration complexity

---

## 8. Raw Inventory

### All Tables/Workbooks (complete list)

**Root level:**
1. Archive (folder)
2. Coverage Analysis (folder)
3. Enrichment & Scoring (folder)
4. Find Contacts for AE (folder)
5. Outbound Campaigns (folder)
6. Recruiting (folder)
7. Target Companies (folder)
8. Under Construction (folder)
9. [Inbound] Campaign Master Table (workbook, Kirill)
10. Custom Signal (workbook, Cam)
11. Find People — Nov 4, 2025 (workbook, Sofia)
12. Find People — Nov 5, 2025 (workbook, Sofia)
13. Find People — Nov 6, 2025 (workbook, Sofia)
14. Find People — Jan 29, 2026 (workbook, Sofia)
15. HIT Summit 2026 (workbook, Cam)

**Inside Enrichment & Scoring:**
16. Contact Enrichment (workbook, Kirill) — 3 sub-tables
17. Find decision makers (workbook, Kirill)
18. Find Decision Makers Before Enrichment (workbook, Kirill)
19. Inbound Leads (workbook, Kirill) — 6 sub-tables
20. LinkedIn Ads Audience (workbook, Cam)
21. Personalizations (workbook, Kirill)
22. Enrich new and target companies (table, Kirill)

**Inside Outbound Campaigns:**
23. [Outbound] CCM $10m Savings Campaign (Cam)
24. [Outbound] CCM Webinar (Cam)
25. [Outbound] Q4 2025 Promo (Cam)
26. Closed/Lost Personalization (Cam)
27. Freddie Mac Connect (Cam)
28. HIT Summit (Cam)
29. HR1 Campaign (Cam)
30. One-off Verifications (Kirill)
