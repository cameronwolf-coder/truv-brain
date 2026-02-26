---
name: case-study-pdf
description: Generate 6-page print-ready case study PDFs for Truv customer stories. This skill should be used when users want to create a case study PDF, build a customer story PDF, or convert an existing web case study into a print-ready document. Triggers on requests like "create a case study PDF for [customer]", "build a customer story PDF", "make a print-ready case study", or "generate a PDF for [customer] case study".
---

# Case Study PDF Generator

Generate 6-page, 8.5x11in print-ready HTML case study documents for Truv customer stories. Each document follows a strict page structure, Truv brand system, and data accuracy protocol.

## Workflow

### Phase 1: Source Content

1. Read the customer's web case study from:
   `/Users/cameronwolf/Downloads/Projects/truv.com-master/src/shortcodes/customer-stories/{customer-slug}.html`

2. Read the platform proof points from:
   `/Users/cameronwolf/Downloads/Projects/truv-brain/docs/proof-points.md`

3. Read the content reference for brand voice:
   `/Users/cameronwolf/Downloads/Projects/truv-brain/docs/content-reference.md`

4. Extract from the source document:
   - Company name, description, headquarters, size
   - All metrics with exact numbers
   - All quotes with exact wording and attribution
   - Product details (which Truv products, integrations, platforms)
   - Challenge/problem statements
   - Solution details
   - Results and outcomes

### Phase 2: Build the HTML Document

Create a single self-contained HTML file at:
`/Users/cameronwolf/Downloads/Projects/truv-brain/docs/customer-stories/{customer-slug}-full.html`

Read an existing completed case study as a reference template:
- `/Users/cameronwolf/Downloads/Projects/truv-brain/docs/customer-stories/crosscountry-mortgage-full.html`

Follow the design system in `references/design-system.md` for all CSS patterns, colors, typography, spacing, and components.

#### Strict 6-Page Structure

**Page 1 — Cover (dark gradient, no header/footer)**
- Truv logo + "Customer Story" badge in header
- Company name (uppercase label)
- Headline: "[Company] [action verb] [primary metric] with Truv." with the metric in blue highlight span
- Accent divider (64px blue bar)
- Stats bar at bottom: 4 key metrics in grid (largest/most impressive numbers)
- Geometric circle accents (decorative CSS ::before/::after)

**Page 2 — Company Profile + Why Truv (header, no footer)**
- Section label: "About the Company"
- Section title: Company full legal name
- Company description: 2-3 paragraphs about the company
- Bold lead-in pivot: One-sentence bold statement transitioning to the problem (e.g., "The $18M verification problem.")
- Problem paragraphs: 1-2 paragraphs on what drove them to Truv
- Divider line between text and facts
- "At a Glance" facts grid: 2 rows of 4 cells with company facts (market position, loan volume, prior spend, geography, HQ, LOS, POS, etc.). No duplicate values across cells.
- Dark "Why Truv" section at bottom: section label, title, 1-sentence intro, 4 platform stats from proof-points.md (96% coverage, 80% savings, 150+ customers, <2s API)

**Page 3 — The Challenge (header + footer)**
- Dark hero section: section label "The Challenge", headline with dollar/metric anchor, descriptive paragraph. Use compact padding (28px 48px) to prevent bleed.
- 5 challenge cards in vertical stack: each with SVG icon in blue circle + title + description. Cards use `border-left: 3px solid` accent and flex layout. Use tight spacing (gap: 10px, card padding: 12px 16px) — this page has high bleed risk.
- Featured quote block: large decorative quote mark, quote text, avatar with initials + name + title. Keep padding compact (20px 24px).

**Page 4 — The Solution (header + footer)**
- Section label "The Solution" + title describing the solution approach
- 1 paragraph intro
- Integration grid: 2-column cards differentiating platforms (e.g., POS vs LOS) with different accent colors (blue for one, dark blue for the other)
- Transformation flow: 3-step horizontal "Before → Bridge → Result" visual
- Detail content: 2-3 paragraphs expanding on solution
- Inline quote (MUST be a different quote than page 3)

**Page 5 — Outcomes + Partnership (header + footer)**
- Section label: "Outcomes", title: "Key Results"
- 2x2 outcome cards with SVG icons: each highlighting a specific metric + explanation
- Before/After comparison grid: 2-column with 4 rows each (grey "Before" card, dark "With Truv" card). Only use customer-specific metrics.
- Dark partnership section: Use a 3x2 grid of icon tiles (NOT bullet lists — walls of text read poorly in dark sections). Each tile has an icon badge + bold title + one-line description. Use fixed `margin-top: 24px` (not `margin: auto`) since footer follows.
- Page footer at bottom with `margin-top: auto`

**Page 6 — Conclusion + CTA (header, no footer)**
- Section label: "Conclusion"
- Results recap: 4 dark stat cards repeating top metrics
- Conclusion text: 2 paragraphs summarizing impact + forward-looking "Looking Ahead" statement
- About grid: 2-column with "About [Company]" and "About Truv" cards
- Dark CTA section: title, subtitle with emotional bridge ("If [company]'s challenges sound familiar..."), primary + secondary buttons, contact line, footer logo

### Phase 3: Data Accuracy Audit

**This phase is mandatory. Never skip it.**

Read `references/content-sources.md` for the complete accuracy rules. Then perform a line-by-line audit:

1. Re-read the primary source document
2. Check every metric in the PDF against the source
3. Check every quote for exact wording
4. Verify no quote appears more than once
5. Verify platform-level stats (from proof-points.md) are attributed to Truv, not the customer
6. Verify no fabricated specifics (dates, program names, numbers not in source)
7. Verify At a Glance facts have no duplicate values
8. Report all issues found to the user and fix them before proceeding

### Phase 4: Visual Review

Open the HTML in the browser:
```bash
open /Users/cameronwolf/Downloads/Projects/truv-brain/docs/customer-stories/{customer-slug}-full.html
```

Common issues to check and fix:
- **Page bleed (most common):** Content extending past 11in page boundary. Check pages 3 and 5 first — these have the highest content density. Fix by reducing padding, gaps, and font sizes per the design system's "Preventing Page Bleed" section.
- **Whitespace gaps:** Large empty areas caused by competing `margin: auto` values. Fix by using fixed margins on dark sections when a footer follows on the same page.
- **Font size inconsistency:** All body paragraph text must be 13px. Check that challenge card descriptions, integration card descriptions, outcome card descriptions, about card text, and conclusion text all match.
- **Section label visibility:** Labels must be 12px with 0.18em letter-spacing. Anything smaller is hard to read in print.
- **Visual balance:** Each page should feel full but not cramped.
- **Quote placement:** Quotes should appear as visual anchors, not lost in text.
- **Dark section alignment:** Full-bleed sections must touch left/right edges.
- **Partnership section:** Must use icon tile grid (not bullet lists) for visual variety in dark sections.

### Phase 5: Generate PDF

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless --disable-gpu \
  --print-to-pdf="/Users/cameronwolf/Downloads/Projects/truv-brain/docs/customer-stories/{Company}_x_Truv_Case_Study.pdf" \
  --no-pdf-header-footer --print-to-pdf-no-header \
  "/Users/cameronwolf/Downloads/Projects/truv-brain/docs/customer-stories/{customer-slug}-full.html"
```

## Critical Rules

### Content Rules
- **NEVER hallucinate data.** Every number must trace to the source document or proof-points.md.
- **NEVER repeat quotes.** Each quote appears exactly once across all 6 pages.
- **NEVER use unverified dates.** If the source doesn't say when, don't add a year.
- **ALWAYS run the data accuracy audit** before showing the user.
- **ALWAYS differentiate customer metrics from Truv platform metrics.** Platform stats go in the "Why Truv" section only.

### Design Rules
- **ALWAYS use inline SVG** for the Truv logo. Never reference external image files.
- **ALWAYS use the Gilroy font** via @font-face with woff2/woff from the branding directory.
- **ALWAYS set pages to exactly 8.5in x 11in** with overflow: hidden.
- **ALWAYS include print CSS** with @page rules and page-break controls.
- **ALWAYS use the standard dark gradient** (`135deg, var(--truv-dark-blue) 0%, #1a3a7a 100%`) for dark sections.
- **NEVER use more than 2 dark sections per page** to maintain visual variety.
- **ALWAYS make dark sections full-bleed** with `margin: Xpx -48px 0; padding: Xpx 48px Xpx;`
- **ALWAYS use 13px for ALL body paragraph text.** Do not vary between 11px, 12px, 13px, 14px across sections — this creates visual inconsistency in print.
- **ALWAYS use 12px for section labels** with `letter-spacing: 0.18em`. Never less than 12px — labels must be clearly readable.

### Layout Rules
- **Page padding is always 48px horizontal.**
- **Inner pages are flex columns** at fixed 11in height with overflow hidden.
- **Use `margin-top: auto`** on footer elements ONLY — not on dark sections when a footer follows on the same page.
- **Use `flex-shrink: 0`** on elements that must not compress (headers, footers, dark sections).
- **Card grids use CSS Grid** (`grid-template-columns: repeat(N, 1fr)`).
- **Challenge cards stack vertically** with flexbox column layout.
- **SVG icons in cards:** 14-16px with white fill on blue circles (32px) or blue fill on light square badges (24-28px).
- **Prevent page bleed** by using compact spacing on dense pages (Page 3, Page 5). See `references/design-system.md` "Preventing Page Bleed" section for exact values.
- **Use icon tile grids** instead of bullet lists for dark sections (partnership, features). Walls of text in dark sections are visually dense. Use 3-column grids with icon + title + description tiles instead.

## References

- `references/design-system.md` — Complete CSS patterns, colors, typography, spacing, and component specifications
- `references/content-sources.md` — Data sourcing rules, accuracy protocol, and audit checklist

## Available Customer Stories

To list all available source documents:
```
/Users/cameronwolf/Downloads/Projects/truv.com-master/src/shortcodes/customer-stories/
```
Each `.html` file (excluding `customer-stories-main.html` and `old--*` prefixed files) is a valid source.
