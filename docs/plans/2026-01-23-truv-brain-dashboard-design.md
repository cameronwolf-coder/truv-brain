# Truv Brain Dashboard Design

> **Created:** January 23, 2026
> **Owner:** Cameron Wolf
> **Status:** Design Complete

---

## Overview

Interactive web dashboard for Truv Brain, deployed on Vercel. A daily work tool for the marketing team to look up proof points and generate campaign emails.

**URL:** truv-brain.vercel.app

**Core Features:**
1. **Proof Points Search** — Find customer quotes, metrics, competitive positioning
2. **Email Builder** — Select segment → get pre-filled template with Clay prompts

**Not in Scope (for now):**
- Contact list viewing (HubSpot integration)
- AI-generated content (Clay handles personalization)

---

## Architecture

### Tech Stack
- **Frontend:** React + TypeScript + Tailwind (existing)
- **Routing:** React Router
- **Data:** Static JSON files (no backend)
- **Deployment:** Vercel (existing)

### Data Approach
Static JSON baked into the app. When content changes:
1. Run `npm run generate-data` to pull from markdown files
2. Redeploy to Vercel

No external dependencies. Fast load times. Simple.

---

## App Structure

```
┌─────────────────────────────────────────────────┐
│  Truv Brain                        [Search...]  │
├──────────┬──────────────────────────────────────┤
│          │                                      │
│  📚 Proof│   [Main content area]                │
│  Points  │                                      │
│          │                                      │
│  ✉️ Email │                                      │
│  Builder │                                      │
│          │                                      │
│──────────│                                      │
│  ⚙️ About │                                      │
└──────────┴──────────────────────────────────────┘
```

**Navigation:**
- **Proof Points** — Search and browse customer quotes, metrics
- **Email Builder** — Select segment → get pre-filled template
- **About** — Links to GitHub, docs, explains Truv Brain

**Global search** in header searches across all proof points.

---

## Page 1: Proof Points

### Layout

```
┌─────────────────────────────────────────────────┐
│ Proof Points                                    │
├─────────────────────────────────────────────────┤
│ Filters: [All Verticals ▼] [All Metrics ▼]     │
│          [Search customer or keyword...]        │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ CrossCountry Mortgage          MORTGAGE     │ │
│ │ $10M/year savings · 70% conversion          │ │
│ │                                             │ │
│ │ "Truv has redefined what partnership        │ │
│ │ means — delivering accurate, trustworthy    │ │
│ │ data..."  — Tom Durney, EVP                 │ │
│ │                                      [Copy] │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ AmeriSave                       MORTGAGE    │ │
│ │ 80% savings vs TWN · 99% uptime             │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Features

| Feature | Description |
|---------|-------------|
| Filter by vertical | Mortgage, Consumer Lending, Auto, Background, Tenant |
| Filter by metric type | Cost savings, Conversion, Speed, Support |
| Search | Fuzzy search across customer name, quote text, metrics |
| Copy button | One-click copy quote or metric to clipboard |
| Card expand | Click to see full story (all metrics, multiple quotes) |

---

## Page 2: Email Builder

### Layout

```
┌─────────────────────────────────────────────────┐
│ Email Builder                                   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Step 1: Select Segment                          │
│ ┌───────────────┐ ┌───────────────┐            │
│ │ Vertical    ▼ │ │ Objection   ▼ │            │
│ │ Mortgage      │ │ Price/Budget  │            │
│ └───────────────┘ └───────────────┘            │
│ ┌───────────────┐                              │
│ │ Persona     ▼ │                              │
│ │ VP Ops        │                              │
│ └───────────────┘                              │
│                                                 │
│ Step 2: Select Touch                            │
│ ○ Touch 1 (Day 1)  ○ Touch 2 (Day 4)  ○ Touch 3│
│                                                 │
├─────────────────────────────────────────────────┤
│ Preview                              [Copy All] │
│ ─────────────────────────────────────────────── │
│ Subject: mortgage verification costs eating...  │
│                                                 │
│ {{clay.opening_hook}}                      [?]  │
│                                                 │
│ When we last spoke, budget was the main        │
│ blocker. Since then, Truv has helped companies │
│ like AmeriSave achieve 80% savings vs TWN.     │
│                                                 │
│ {{clay.pain_reference}}                    [?]  │
│                                                 │
│ Worth a 15-minute call?                         │
│ {{clay.cta}}                               [?]  │
└─────────────────────────────────────────────────┘
```

### How It Works

1. **Select vertical** → filters relevant proof points
2. **Select objection** → pulls matching pain point messaging
3. **Select persona** → adjusts tone/focus
4. **Select touch** (1, 2, or 3) → shows that template
5. Template auto-fills with best proof point for that segment
6. **Copy All** → copies to clipboard, paste into Clay

### Segment Options

**Verticals (5):**
- Mortgage
- Consumer Lending
- Auto Lending
- Background Screening
- Tenant Screening

**Objections (5):**
- Price/Budget
- Timing/Roadmap
- Competitor Chosen
- Internal Bandwidth
- No Decision

**Personas (4):**
- VP/Director Ops
- CTO/VP Engineering
- CFO/Finance
- CEO/Founder

---

## Clay Prompt Suggestions

Each `{{clay.xxx}}` zone shows a suggested prompt for Clay personalization.

### UX

Click the `[?]` icon next to a zone → expands to show prompt with copy button:

```
┌─────────────────────────────────────────────────┐
│ {{clay.opening_hook}}                      [?]  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Clay Prompt:                         [Copy] │ │
│ │ "Write a 1-sentence opener referencing the  │ │
│ │ contact's company or recent news. Be        │ │
│ │ conversational, not salesy."                │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Prompts by Zone

| Zone | Suggested Clay Prompt |
|------|----------------------|
| `{{clay.opening_hook}}` | "Write 1 sentence referencing the contact's company, role, or recent news. Conversational, not salesy. Example: 'Saw {company} just expanded into {state}...'" |
| `{{clay.pain_reference}}` | "Write 1-2 sentences connecting their role ({jobtitle}) to the pain point: {objection}. Use 'you' language, focus on their daily frustrations." |
| `{{clay.cta}}` | "Write a soft CTA asking for 15 minutes. Match tone to {persona} seniority — casual for VPs, more formal for C-suite." |

---

## Data Structure

### File Structure

```
src/data/
├── proofPoints.json      # Customer stories and metrics
├── templates.json        # Email templates with Clay prompts
├── segments.json         # Verticals, objections, personas
└── painPointMapping.json # Objection → feature → proof point
```

### proofPoints.json

```json
[
  {
    "id": "crosscountry",
    "customer": "CrossCountry Mortgage",
    "vertical": "mortgage",
    "metricTypes": ["cost", "conversion"],
    "metrics": [
      { "value": "$10M/year", "label": "savings", "type": "cost" },
      { "value": "70%+", "label": "conversion", "type": "conversion" }
    ],
    "quotes": [
      {
        "text": "Truv has redefined what partnership means — delivering accurate, trustworthy data, rapid implementation, and the agility to help us close loans faster and more confidently.",
        "author": "Tom Durney",
        "title": "EVP Corporate Operations"
      }
    ]
  }
]
```

### templates.json

```json
{
  "touches": [
    {
      "touch": 1,
      "day": 1,
      "subject": "{{vertical}} verification costs eating your margins?",
      "body": "{{clay.opening_hook}}\n\nWhen we last spoke, {{objection_summary}} was the main blocker. Since then, Truv has helped companies like {{proof_company}} achieve {{proof_metric}}.\n\n{{clay.pain_reference}}\n\nWorth a 15-minute call to see if things have changed on your end?\n\n{{clay.cta}}",
      "zones": {
        "opening_hook": {
          "placeholder": "{{clay.opening_hook}}",
          "prompt": "Write 1 sentence referencing the contact's company, role, or recent news. Conversational, not salesy."
        },
        "pain_reference": {
          "placeholder": "{{clay.pain_reference}}",
          "prompt": "Write 1-2 sentences connecting their role ({jobtitle}) to the pain point: {objection}. Use 'you' language."
        },
        "cta": {
          "placeholder": "{{clay.cta}}",
          "prompt": "Write a soft CTA asking for 15 minutes. Match tone to {persona} seniority level."
        }
      }
    }
  ]
}
```

### segments.json

```json
{
  "verticals": [
    { "id": "mortgage", "label": "Mortgage" },
    { "id": "consumer", "label": "Consumer Lending" },
    { "id": "auto", "label": "Auto Lending" },
    { "id": "background", "label": "Background Screening" },
    { "id": "tenant", "label": "Tenant Screening" }
  ],
  "objections": [
    { "id": "price", "label": "Price/Budget", "summary": "budget" },
    { "id": "timing", "label": "Timing/Roadmap", "summary": "timing" },
    { "id": "competitor", "label": "Competitor Chosen", "summary": "going with another provider" },
    { "id": "bandwidth", "label": "Internal Bandwidth", "summary": "internal bandwidth" },
    { "id": "no_decision", "label": "No Decision", "summary": "other priorities" }
  ],
  "personas": [
    { "id": "vp_ops", "label": "VP/Director Ops" },
    { "id": "cto", "label": "CTO/VP Engineering" },
    { "id": "cfo", "label": "CFO/Finance" },
    { "id": "ceo", "label": "CEO/Founder" }
  ]
}
```

### painPointMapping.json

```json
{
  "price": {
    "mortgage": ["amerisave", "crosscountry", "mortgageright", "compass"],
    "consumer": ["hfs", "piedmont"],
    "auto": ["turbopass"],
    "background": [],
    "tenant": []
  },
  "timing": {
    "mortgage": ["crosscountry", "firstcontinental"],
    "consumer": ["piedmont"],
    "auto": [],
    "background": [],
    "tenant": []
  },
  "competitor": {
    "mortgage": ["amerisave", "mortgageright", "afcu"],
    "consumer": ["hfs"],
    "auto": [],
    "background": [],
    "tenant": []
  },
  "bandwidth": {
    "mortgage": ["firstcontinental"],
    "consumer": ["piedmont"],
    "auto": [],
    "background": [],
    "tenant": []
  },
  "no_decision": {
    "mortgage": ["crosscountry", "compass"],
    "consumer": ["hfs", "b9"],
    "auto": ["turbopass"],
    "background": [],
    "tenant": []
  }
}
```

---

## Build Script

`npm run generate-data` — Converts markdown docs to JSON:

```bash
# Reads from:
# - docs/content-reference.md
# - docs/plans/2026-01-22-cold-email-framework-design.md

# Outputs to:
# - src/data/proofPoints.json
# - src/data/templates.json
# - src/data/segments.json
# - src/data/painPointMapping.json
```

Run when content changes, then redeploy.

---

## Implementation Checklist

### Phase 1: Setup
- [ ] Add React Router
- [ ] Create sidebar navigation layout
- [ ] Set up routing (/, /email-builder, /about)

### Phase 2: Data
- [ ] Create src/data/ folder
- [ ] Build proofPoints.json from content-reference.md
- [ ] Build segments.json
- [ ] Build painPointMapping.json
- [ ] Build templates.json with Clay prompts

### Phase 3: Proof Points Page
- [ ] Create ProofPointCard component
- [ ] Build filter dropdowns (vertical, metric type)
- [ ] Add search with fuzzy matching
- [ ] Implement copy-to-clipboard
- [ ] Card expand for full details

### Phase 4: Email Builder Page
- [ ] Create segment selector dropdowns
- [ ] Create touch selector (radio buttons)
- [ ] Build template preview component
- [ ] Auto-fill proof points based on segment
- [ ] Clay prompt expandable zones
- [ ] Copy All button

### Phase 5: Polish
- [ ] Global search in header
- [ ] About page with links
- [ ] Mobile responsive
- [ ] Loading states

---

## Success Criteria

- [ ] Can find any customer proof point in <10 seconds
- [ ] Can generate a segment-specific email template in <30 seconds
- [ ] Copy buttons work reliably
- [ ] Works on mobile for quick lookups

---

## Future Enhancements (Not in Scope)

- HubSpot contact list viewing
- AI-powered email enhancement
- Analytics on usage
- Multi-user accounts
