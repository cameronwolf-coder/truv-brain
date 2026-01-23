# List Builder Design

**Date:** 2026-01-23
**Status:** Approved
**Owner:** Cameron Wolf

## Overview

A standalone List Builder page for quickly creating targeted HubSpot lists using natural language or manual filters, with full preview and exclusion capabilities before committing.

## Goals

1. **Quick list creation** — Skip email templates, just build lists fast
2. **Natural language input** — Describe audience in plain English (e.g., "mortgage webinar audience")
3. **Advanced filtering** — Time-based, engagement-based, and firmographic filters
4. **Preview before commit** — See actual contacts, exclude individuals or companies

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│  List Builder                                               │
│  Build targeted HubSpot lists with natural language or      │
│  manual filters                                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │ "mortgage webinar audience, decision makers"        │   │
│  │                                        [Build List] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────────────┐  │
│  │ FILTERS (left)      │  │ PREVIEW (right)             │  │
│  │ Quick Segments      │  │ 127 contacts / 89 companies │  │
│  │ ▸ Advanced Filters  │  │ [contact list w/ checkboxes]│  │
│  │ [Clear] [Search]    │  │ [Create HubSpot List]       │  │
│  └─────────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Natural Language Parsing (Hybrid Approach)

### Stage 1: Pattern Matching (instant)

| Keywords | Maps to |
|----------|---------|
| "mortgage", "auto", "personal loan", "fintech" | `vertical` filter |
| "coo", "executives", "decision makers", "c-suite" | `persona` filter (multi) |
| "webinar", "event" | Engaged contacts (opened emails recently) |
| "re-engagement", "dormant", "cold" | No activity in 90+ days |
| "closed lost", "lost deals" | Lifecycle stage = Closed Lost |
| "new leads", "recent" | Created in last 30 days |

### Stage 2: LLM Fallback

If pattern match confidence < 0.7, send to Claude API with segment data as context. Returns structured filters.

### Example

```
Input: "mortgage webinar audience, decision makers"

Parsed:
  → vertical: mortgage
  → personas: [coo, cfo, ceo, vp_lending, vp_underwriting]
  → engagement: opened email in last 60 days
  → exclude: disqualified, customers
```

Parsed filters auto-populate the filter panel so users can see/adjust.

## Filters

### Quick Segments (always visible)
- Persona (multi-select dropdown)
- Vertical (multi-select dropdown)
- Lifecycle Stage (multi-select, defaults exclude customers/disqualified)

### Advanced Filters (collapsible)

**Time-Based:**
- Last activity: before/after/within X days
- Created date: date range
- Last email open: within X days

**Engagement:**
- Email opens: at least X in last Y days
- Email clicks: at least X in last Y days
- Has meeting history: yes/no/any
- Form submissions: any/specific form

**Firmographic:**
- Company size: ranges (1-50, 51-200, 201-1000, 1000+)
- Annual revenue: min/max

**Exclusions:**
- Exclude lifecycle stages (checkboxes)
- Exclude contacts in existing list (dropdown)
- Exclude domains (textarea)

## Preview Panel

### Header Stats
- Total contacts and companies count
- Breakdown by persona
- Select All checkbox
- Excluded count
- "Exclude by Company" dropdown

### Contact List (scrollable)
Each row shows:
- Checkbox (for inclusion/exclusion)
- Name
- Title
- Company
- Last activity date

Excluded contacts stay visible (grayed out) for re-inclusion.

### Footer
- List name input (auto-generated from prompt)
- Final count
- "Create HubSpot List" button

## Technical Implementation

### New Files
```
src/pages/ListBuilder.tsx      — Main UI component
api/search-contacts.ts         — Preview API (search without creating)
src/utils/promptParser.ts      — Natural language → filters logic
```

### API Flow

1. User types prompt or sets filters
2. `POST /api/search-contacts` → returns contacts for preview
3. User reviews, excludes some contacts
4. `POST /api/create-list` with specific contactIds

### HubSpot Properties

**Existing:**
- `jobtitle`, `lifecyclestage`, `sales_vertical`

**Engagement:**
- `hs_email_last_open_date`, `hs_email_last_click_date`

**Activity:**
- `notes_last_updated`, `hs_last_sales_activity_date`

**Firmographic:**
- `annualrevenue`, `numberofemployees`

### Prompt Parser Structure

```typescript
interface ParsedFilters {
  verticals: string[];
  personas: string[];
  lifecycleStages: string[];
  excludeStages: string[];
  engagement: {
    emailOpensWithin?: number;
    emailClicksWithin?: number;
    noActivityDays?: number;
  };
  firmographic: {
    companySize?: string;
    revenueMin?: number;
    revenueMax?: number;
  };
  timeFilters: {
    createdAfter?: Date;
    createdBefore?: Date;
    lastActivityWithin?: number;
  };
  confidence: number; // 0-1, triggers LLM if < 0.7
}
```

## Navigation

- Route: `/list-builder`
- Sidebar: After Email Builder
- Icon: List/users icon

## Smart Defaults

- Exclusions pre-checked: Customer, Disqualified, Opportunity
- Default limit: 200 contacts
- List name auto-generates from parsed prompt

## Error States

- No results: "No contacts match these criteria. Try broadening your filters."
- API error: Toast notification with retry
- Parsing unclear: "I interpreted this as [filters]. Adjust if needed."
