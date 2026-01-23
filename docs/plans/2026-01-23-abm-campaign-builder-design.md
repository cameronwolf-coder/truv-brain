# ABM Campaign Builder - Design Document

**Date:** 2026-01-23
**Status:** Approved
**Owner:** Cameron Wolf

## Overview

Account-based marketing campaign builder that extends the ROI Generator. After generating ROI for a prospect company, users can build targeted email campaigns by analyzing HubSpot contacts, identifying champions, and generating persona-specific multi-touch sequences.

## User Flow

1. **ROI Generator** — User enters company name and loan volume, generates ROI analysis
2. **Build ABM Campaign** — New button passes ROI data to ABM Builder
3. **Company Lookup** — Search/confirm company in HubSpot
4. **Contact Analysis** — Fetch contacts, score for champion potential, group by persona
5. **Campaign Generation** — Select personas, generate emails, create HubSpot list

## Entry Point

ROI Generator gets a "Build ABM Campaign" button that appears after valid ROI is generated. Navigates to `/abm-builder` with ROI data:
- Company name
- Annual savings
- Savings per loan
- Manual reduction %
- Current vs future cost
- Verification breakdown

## Champion Scoring

Each contact receives a Champion Score (0-100) combining four signals:

| Signal | Max Points | Logic |
|--------|------------|-------|
| Engagement Recency | 30 | Last activity: <7 days = 30, <30 days = 20, <90 days = 10, older = 0 |
| Engagement Depth | 25 | Opens (1pt each, max 10) + clicks (3pts each, max 9) + replies (6pts each) |
| Deal Involvement | 25 | Open deal = 25, closed-won = 20, closed-lost = 10, no deal = 0 |
| Persona Priority | 20 | CFO/COO = 20, VP = 15, Director = 10, Manager = 5 |

**Champion Threshold:** Score 60+ = Champion
**Fallback:** If no champions, show top 3 as "Best Bets"

### HubSpot Properties Used

- `hs_email_last_open_date`
- `hs_email_last_click_date`
- `hs_email_last_reply_date`
- `hs_email_open_count`
- `hs_email_click_count`
- `hs_email_reply_count`
- `hs_persona`
- Associated deals via associations API

## Email Generation

### Champion Emails (Top 2)

Personalized 1:1 emails for highest-scoring contacts:
- Reference their specific activity
- Lead with ROI metric relevant to their persona
- Personal tone, not templated

### Multi-Touch Sequence (Per Persona)

5-email sequence per selected persona:

| # | Purpose | ROI Data Used |
|---|---------|---------------|
| 1 | Hook — Pattern interrupt | Annual savings |
| 2 | Problem — Agitate pain | Savings per loan, manual reduction % |
| 3 | Proof — Case study | Proof points from knowledge base |
| 4 | Value Stack — Full breakdown | Cost comparison |
| 5 | CTA — Clear ask | ROI summary |

### Persona-Specific Angles

| Persona | Lead With |
|---------|-----------|
| CFO/Finance | Cost savings, ROI, predictable pricing |
| COO/Ops | Efficiency gains, manual reduction, team time |
| CTO/Tech | Integration ease, API, security |
| VP Production | Speed, turnaround time, volume handling |

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ABM Campaign Builder                                        │
│ Company: {name}  │  ROI: ${annual_savings}/year savings    │
├─────────────────────────────────────────────────────────────┤
│ CHAMPIONS                                                   │
│ ┌─────────────────────┐ ┌─────────────────────┐            │
│ │ ★ {name}            │ │ ★ {name}            │            │
│ │ {persona} · {score} │ │ {persona} · {score} │            │
│ │ {last_activity}     │ │ {last_activity}     │            │
│ │ {deal_status}       │ │ {deal_status}       │            │
│ └─────────────────────┘ └─────────────────────┘            │
├─────────────────────────────────────────────────────────────┤
│ CONTACTS BY PERSONA                                         │
│ ☑ CFO/Finance (n)  ☑ COO/Ops (n)  ☐ CTO (n)  ...          │
├─────────────────────────────────────────────────────────────┤
│ [Generate Emails]              [Create HubSpot List]        │
└─────────────────────────────────────────────────────────────┘
```

### Email Output

- Expandable cards per email
- Subject line + body
- Copy button per email
- "Copy All" for full sequence

## HubSpot Integration

### Company Lookup
- Search companies by name (pre-filled from ROI Generator)
- Display: name, industry, domain, contact count

### Contact Fetch
- Get all contacts associated with company
- Include engagement properties and deal associations

### List Creation
- Static list: `ABM - {Company Name} - {YYYY-MM-DD}`
- Contains selected contacts
- Via Pipedream MCP integration

## Technical Implementation

### New Files
- `src/pages/ABMBuilder.tsx` — Main page component
- `src/hooks/useChampionScoring.ts` — Scoring logic
- `src/hooks/useHubSpotCompany.ts` — Company/contact fetching
- `src/utils/abmEmailGenerator.ts` — Email content generation

### Route
- Path: `/abm-builder`
- Receives ROI data via React Router state or URL params

### API Calls (via Pipedream MCP)
- `hubspot-search-crm` — Company lookup
- `hubspot-get-company` — Company details
- `hubspot-search-crm` — Contacts by company
- `hubspot-get-associated-emails` — Engagement data
- `hubspot-create-list` — List creation (not available, use manual)

Note: HubSpot list creation may require direct API call or manual step if Pipedream action is limited.

## Out of Scope

- Email sequence creation in HubSpot (copy/paste workflow)
- Automated sending
- A/B testing
- Analytics/tracking
