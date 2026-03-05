---
name: case-study-linkedin-ads
description: Generate LinkedIn ad copy and branded HTML mockups from existing Truv case study PDFs. This skill should be used when users want to create LinkedIn ads for a case study, build ad creatives from a customer story, or generate social ad variants. Triggers on requests like "create LinkedIn ads for [customer]", "generate ads from the case study", "build LinkedIn creatives for [customer]", or "make social ads for [customer] case study".
---

# Case Study LinkedIn Ads Generator

Generate 5 LinkedIn ad variants (Sponsored Content + Carousel) with branded HTML mockups and optional PNG export from an existing Truv case study.

## Workflow

### Phase 1: Extract Content from Case Study

1. Identify the target case study. List available sources:
   ```
   /Users/cameronwolf/Downloads/Projects/truv-brain/docs/customer-stories/
   ```
   Valid sources are `{slug}-full.html` files.

2. Read the case study HTML:
   `/Users/cameronwolf/Downloads/Projects/truv-brain/docs/customer-stories/{slug}-full.html`

3. Read brand voice reference:
   `/Users/cameronwolf/Downloads/Projects/truv-brain/docs/content-reference.md`

4. Read platform proof points (for brand awareness variant only):
   `/Users/cameronwolf/Downloads/Projects/truv-brain/docs/proof-points.md`

5. Extract from the source document:
   - Company name and description
   - All metrics with exact numbers (sort by impressiveness — largest savings, biggest percentage, most impactful)
   - All quotes with exact wording and attribution (name, title)
   - Challenge/problem statements
   - Before/After comparison data (from the comparison grid)
   - Key outcomes
   - Products and integrations mentioned

### Phase 2: Generate Ad Copy

Create the output directory:
```bash
mkdir -p /Users/cameronwolf/Downloads/Projects/truv-brain/docs/linkedin-ads/{slug}
```

Write `ads-copy.md` with all 5 variants in both formats. Use this structure:

```markdown
# LinkedIn Ads — {Company Name} Case Study

## Variant 1: Metric-led

### Sponsored Content
**Primary text:** [~150 chars, mobile-friendly, lead with the number]
**Headline:** [~70 chars, below the image]
**Description:** [~100 chars, optional subline]
**CTA:** Download Case Study

### Carousel
**Primary text:** [~150 chars, shared across all cards]
**Card 1:** [headline ~40 chars] — [visual description]
**Card 2:** [headline] — [visual description]
**Card 3:** [headline] — [visual description]
**Card 4:** [headline] — [visual description]
**Card 5:** [headline] — [visual description]

---

## Variant 2: Quote-led
...
```

#### The 5 Variants

**1. Metric-led** — Lead with the single most impressive number.
- Sponsored: Large metric as hero, company name, brief context
- Carousel: Card 1 = metric hook → Card 2 = context → Card 3 = how Truv helped → Card 4 = more results → Card 5 = CTA

**2. Quote-led** — Customer quote as social proof.
- Sponsored: Quote in large text, attribution, company name
- Carousel: Card 1 = quote → Card 2 = who + company context → Card 3 = results → Card 4 = CTA

**3. Challenge → Result** — Problem pivots to outcome.
- Sponsored: Split layout — challenge on top, result below, connected by divider
- Carousel: Card 1 = challenge → Card 2 = pain points → Card 3 = solution → Card 4 = results → Card 5 = CTA

**4. Before/After** — Side-by-side comparison from the case study's comparison grid.
- Sponsored: Two-column — "Before" (grey) vs "With Truv" (dark blue), 3-4 rows
- Carousel: Card 1 = before state → Card 2 = with Truv → Card 3 = key savings → Card 4 = CTA

**5. Brand Awareness** — Softer partnership story, not hard metrics.
- Sponsored: Company + Truv logo lockup, narrative headline, warm tone
- Carousel: Card 1 = partnership headline → Card 2 = company overview → Card 3 = what Truv enabled → Card 4 = looking ahead → Card 5 = CTA

#### Copy Guidelines
- Write in Truv's brand voice per `docs/content-reference.md`
- Primary text must work on mobile (front-load the hook before truncation)
- Avoid jargon — write for VP/C-level mortgage lending audience
- Every metric and quote must be verbatim from the source document
- CTA is always "Download Case Study" unless the user specifies otherwise

### Phase 3: Build HTML Mockups

Read the existing case study HTML for design reference — reuse the Truv brand system from the PDF:

**Design tokens:**
```css
:root {
    --truv-primary-blue: #2C64E3;
    --truv-dark-blue: #0F1C47;
    --truv-black: #171717;
    --truv-grey: #F4F4F2;
    --truv-white: #FFFFFF;
    --truv-light-blue: #C5D9F7;
}
```

**Font:** Gilroy via @font-face from `../../branding/fonts/Gilroy-Medium.woff2` and `Gilroy-SemiBold.woff2` (relative to output HTML in `docs/linkedin-ads/{slug}/`)

**Fallback:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

#### Sponsored Content Mockups (1200x627px)

Create one HTML file per variant at:
`docs/linkedin-ads/{slug}/sponsored-{variant-name}.html`

Variant names: `metric-led`, `quote-led`, `challenge-result`, `before-after`, `brand-awareness`

Each file:
- Self-contained (inline CSS, embedded font references)
- Exactly 1200x627px body with `overflow: hidden`
- Clean, modern LinkedIn feed aesthetic
- Truv logo (inline SVG, same as PDF skill) in corner or header
- Company name visible
- High contrast text — must be readable at feed thumbnail size

**Layout by variant:**

1. **Metric-led:** Large metric number (48-64px, bold, blue or white on dark) centered or left-aligned. Company name above or below. One-line context beneath the metric. Dark gradient or white background.

2. **Quote-led:** Quote text (20-28px, italic or regular) with large decorative quote mark. Attribution line below (name, title, company). Light gradient background with subtle brand accent.

3. **Challenge → Result:** Top half = challenge statement on grey/dark background. Bottom half = result statement on blue/white background. Visual divider or arrow between them.

4. **Before/After:** Two-column layout. Left = "Before" card (grey background, 3-4 rows of label + value). Right = "With Truv" card (dark blue background, matching rows). Same data as the case study comparison grid.

5. **Brand Awareness:** Company logo area + Truv logo (partnership lockup). Narrative headline (22-28px). Warm, editorial feel. Subtle gradient background.

#### Carousel Card Mockups (1080x1080px)

Create a folder per variant at:
`docs/linkedin-ads/{slug}/carousel-{variant-name}/`

Each card is a separate HTML file (`card-1.html`, `card-2.html`, etc.), 3-5 cards per variant.

Card design principles:
- Bold, single-message-per-card — one idea per card
- Consistent visual thread across cards (same color scheme, typography, layout position)
- Card 1 = hook (stop the scroll)
- Last card = CTA with "Download the full case study" and Truv branding
- Large text (28-40px headlines) — must be readable on mobile
- Minimal text per card (headline + 1-2 lines max)

### Phase 4: PNG Export (Optional)

After building all HTML mockups, ask the user:
**"Want to export the HTML mockups as PNGs?"**

If yes, use Chrome headless to screenshot each file:

**Sponsored Content (1200x627):**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless --disable-gpu \
  --window-size=1200,627 \
  --screenshot="/Users/cameronwolf/Downloads/Projects/truv-brain/docs/linkedin-ads/{slug}/sponsored-{variant}.png" \
  "/Users/cameronwolf/Downloads/Projects/truv-brain/docs/linkedin-ads/{slug}/sponsored-{variant}.html"
```

**Carousel Cards (1080x1080):**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless --disable-gpu \
  --window-size=1080,1080 \
  --screenshot="/Users/cameronwolf/Downloads/Projects/truv-brain/docs/linkedin-ads/{slug}/carousel-{variant}/card-{n}.png" \
  "/Users/cameronwolf/Downloads/Projects/truv-brain/docs/linkedin-ads/{slug}/carousel-{variant}/card-{n}.html"
```

Open the output folder for the user to review:
```bash
open /Users/cameronwolf/Downloads/Projects/truv-brain/docs/linkedin-ads/{slug}/
```

## Critical Rules

### Content Rules
- **NEVER fabricate metrics.** Every number must come from the source case study HTML.
- **NEVER paraphrase quotes.** Copy verbatim from the source.
- **Platform stats** (96% coverage, 80% savings, <2s API) may only appear in the brand awareness variant and must be attributed to Truv, not the customer.
- **No unverified dates or specifics** not present in the source document.
- **CTA defaults to "Download Case Study"** unless the user specifies otherwise.

### Design Rules
- **ALWAYS use inline SVG** for the Truv logo. Never reference external image files.
- **ALWAYS use the Gilroy font** via @font-face with woff2 from the branding directory.
- **ALWAYS set exact pixel dimensions** on the body (1200x627 or 1080x1080) with `overflow: hidden`.
- **ALWAYS use high-contrast text.** Ads must be readable at thumbnail size in a LinkedIn feed.
- **ALWAYS make each HTML file self-contained.** Inline all CSS. No external stylesheets.
- **ALWAYS use the standard dark gradient** (`135deg, var(--truv-dark-blue) 0%, #1a3a7a 100%`) for dark backgrounds.
- **Keep text minimal on carousel cards.** One idea per card. Headline + 1-2 supporting lines max.

## Available Case Studies

To list all available source documents:
```bash
ls /Users/cameronwolf/Downloads/Projects/truv-brain/docs/customer-stories/*-full.html
```
