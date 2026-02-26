# Case Study LinkedIn Ads Skill Design

**Date:** 2026-02-10
**Status:** Approved
**Owner:** Cameron Wolf

## Overview

Standalone companion skill to `case-study-pdf` that generates LinkedIn ad copy and branded HTML mockups (with optional PNG export) from existing case study HTML files. Pulls all content from the source case study — no fabricated data.

## Input

An existing case study HTML file from:
`docs/customer-stories/{slug}-full.html`

## Output

A folder at `docs/linkedin-ads/{slug}/` containing:

```
docs/linkedin-ads/{slug}/
├── ads-copy.md                         # All 5 variants, both formats
├── sponsored-metric-led.html
├── sponsored-metric-led.png            # Optional (Phase 4)
├── sponsored-quote-led.html
├── sponsored-quote-led.png
├── sponsored-challenge-result.html
├── sponsored-challenge-result.png
├── sponsored-before-after.html
├── sponsored-before-after.png
├── sponsored-brand-awareness.html
├── sponsored-brand-awareness.png
├── carousel-metric-led/
│   ├── card-1.html
│   ├── card-1.png
│   ├── card-2.html
│   ├── card-2.png
│   └── ...
├── carousel-quote-led/
├── carousel-challenge-result/
├── carousel-before-after/
└── carousel-brand-awareness/
```

## Ad Formats

### Sponsored Content (Single Image)
- Image: 1200x627px
- Primary text: ~150 chars (mobile-friendly)
- Headline: ~70 chars (below image)
- Description: ~100 chars (optional subline)
- CTA button: "Download Case Study"

### Carousel Ads
- Cards: 1080x1080px, 3-5 cards per variant
- Primary text: ~150 chars (shared across cards)
- Per-card headline: ~40 chars
- CTA button: "Download Case Study"

## 5 Ad Variants

### 1. Metric-led
Lead with the single most impressive number from the case study.
- **Sponsored Content:** Large metric as hero text, company logo/name, brief context line
- **Carousel:** Card 1 = metric hook, Card 2 = context/challenge, Card 3 = how Truv helped, Card 4 = additional results, Card 5 = CTA

### 2. Quote-led
Customer quote as the hero element for social proof.
- **Sponsored Content:** Quote in large text, attribution with name/title, company name
- **Carousel:** Card 1 = quote, Card 2 = who said it + company context, Card 3 = the results they achieved, Card 4 = CTA

### 3. Challenge → Result
Problem statement that pivots to the outcome.
- **Sponsored Content:** Split layout — challenge on top, result on bottom, connected by a visual divider
- **Carousel:** Card 1 = challenge statement, Card 2 = pain points, Card 3 = Truv solution, Card 4 = results, Card 5 = CTA

### 4. Before/After
Side-by-side comparison reusing the comparison grid data from the case study.
- **Sponsored Content:** Two-column layout — "Before" (grey) vs "With Truv" (dark blue), 3-4 key rows
- **Carousel:** Card 1 = "Before" state, Card 2 = "With Truv" state, Card 3 = key delta/savings, Card 4 = CTA

### 5. Brand Awareness
Softer positioning focused on the partnership story.
- **Sponsored Content:** Company name + Truv logo lockup, narrative headline about the partnership, warm tone
- **Carousel:** Card 1 = partnership headline, Card 2 = company overview, Card 3 = what Truv enabled, Card 4 = looking ahead, Card 5 = CTA

## Workflow

### Phase 1: Extract Content

Read the case study HTML at `docs/customer-stories/{slug}-full.html` and extract:
- Company name and description
- All metrics with exact numbers (sorted by impressiveness)
- All quotes with exact wording and attribution
- Challenge statements
- Before/After comparison data
- Key outcomes
- Products/integrations mentioned

Also read:
- `docs/content-reference.md` for brand voice
- `docs/proof-points.md` for Truv platform stats (if needed for context, not for customer-specific claims)

### Phase 2: Generate Ad Copy

Write all 5 variants in both Sponsored Content and Carousel formats. Save to `docs/linkedin-ads/{slug}/ads-copy.md` with this structure per variant:

```markdown
## Variant 1: Metric-led

### Sponsored Content
**Primary text:** ...
**Headline:** ...
**Description:** ...
**CTA:** Download Case Study

### Carousel
**Primary text:** ...
**Card 1:** [headline] — [description]
**Card 2:** [headline] — [description]
...
```

### Phase 3: Build HTML Mockups

Generate self-contained HTML files using Truv brand system:
- Gilroy font (woff2 from `branding/fonts/`)
- Brand colors (--truv-primary-blue, --truv-dark-blue, etc.)
- Clean, modern ad design appropriate for LinkedIn feed

Dimensions:
- Sponsored Content: 1200x627px
- Carousel cards: 1080x1080px

Each HTML file is standalone (inline styles, embedded fonts) so it renders correctly when opened in a browser.

### Phase 4: PNG Export (Optional)

Ask the user: "Want to export the HTML mockups as PNGs?"

If yes, use Chrome headless to screenshot each file:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless --disable-gpu \
  --window-size=1200,627 \
  --screenshot="docs/linkedin-ads/{slug}/sponsored-metric-led.png" \
  "docs/linkedin-ads/{slug}/sponsored-metric-led.html"
```

For carousel cards:
```bash
--window-size=1080,1080 \
--screenshot="docs/linkedin-ads/{slug}/carousel-metric-led/card-1.png"
```

## Content Rules

- **Every metric must trace to the source case study HTML.** No fabricated numbers.
- **Every quote must be verbatim from the source.** No paraphrasing.
- **Platform-level stats** (96% coverage, 80% savings, etc.) may only be used in brand awareness variant and must be attributed to Truv, not the customer.
- **Ad copy follows brand voice** from `docs/content-reference.md`.
- **No unverified dates or specifics** not present in the source document.

## Available Case Studies

```
docs/customer-stories/crosscountry-mortgage-full.html
docs/customer-stories/first-continental-mortgage-full.html
docs/customer-stories/prosperity-home-mortgage-full.html
```
