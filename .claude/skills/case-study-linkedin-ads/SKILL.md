---
name: case-study-linkedin-ads
description: Generate LinkedIn ad copy and branded HTML mockups from existing Truv case study PDFs. This skill should be used when users want to create LinkedIn ads for a case study, build ad creatives from a customer story, generate social ad variants, or create LinkedIn Document Ad PDFs (swipeable multi-page case study ads) with dark/white A/B variants. Triggers on requests like "create LinkedIn ads for [customer]", "generate ads from the case study", "build LinkedIn creatives for [customer]", "make social ads for [customer] case study", "create a LinkedIn document ad", or "make a document ad PDF for [customer]".
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

## LinkedIn Document Ad PDFs

LinkedIn Document Ads (swipeable multi-page PDFs in-feed) are a high-performing format for case studies. This section covers generating Document Ad PDFs from existing case study HTML sources and creating A/B color variants.

### Source Files

Document Ad HTML sources live alongside the full case study PDFs:
```
docs/ad-creative/linkedin/{slug}-document-ad-2026.html       # Dark variant (original)
docs/ad-creative/linkedin/{slug}-document-ad-2026-white.html  # White variant (A/B test)
```

Reference implementation (CCM):
- Dark: `docs/ad-creative/linkedin/ccm-document-ad-2026.html`
- White: `docs/ad-creative/linkedin/ccm-document-ad-2026-white.html`

### Document Ad Structure (6 pages, 8.5x11in)

Document Ads use the same 6-page case study PDF structure but adapted for the LinkedIn reading experience:

**Page 1 — Cover (stop-the-scroll hook)**
- Must work as a standalone thumbnail in the LinkedIn feed
- Headline, company name, and 3-4 key metrics visible without scrolling
- Badge: "Customer Case Study"

**Page 2 — The Challenge**
- Challenge cards with pain points
- Customer quote block at bottom

**Page 3 — Results Teaser (cliffhanger before LinkedIn's gate)**
- LinkedIn gates pages 4+ behind a "Continue Reading" prompt
- This page must tease results with big metric cards and a before/after preview
- CTA banner at bottom: "Unlock the full story..." with button
- This is the most important page for engagement — front-load impressive numbers

**Page 4 — The Solution**
- Integration cards, transformation flow, detail paragraphs
- Second customer quote

**Page 5 — Outcomes + Partnership**
- Outcome metric cards, partnership tile grid

**Page 6 — Conclusion + CTA**
- Recap stats, about cards, CTA section with buttons and platform stats bar

### Creating A/B Color Variants

Always create both dark and white variants for A/B testing.

**Dark variant (default):**
- Cover: dark blue gradient (`165deg, #0a1535 → var(--truv-dark-blue) → #162557 → #1a3068`)
- Page 3: dark gradient background, white text, translucent metric cards
- Quote blocks: dark gradient with white text
- Partnership tiles: dark gradient
- CTA section: dark gradient
- Logo SVGs: white fill on dark pages, dark fill on white pages

**White variant (flipped):**
- Cover: white background with 8px blue accent strip on left edge (`var(--truv-primary-blue)`)
- Cover text: dark blue headline, `$10M` highlighted in `var(--truv-primary-blue)`
- Cover stats bar: `var(--truv-grey)` background with `#e5e7eb` border, dark text
- Page 3: white background, blue metric numbers, grey card backgrounds with blue top borders
- Quote blocks: `var(--truv-grey)` background with `border-left: 4px solid var(--truv-primary-blue)`, dark text
- Partnership tiles: `var(--truv-grey)` background with `border-top: 2px solid var(--truv-primary-blue)`, dark text
- Transform flow: `var(--truv-grey)` background with dark text (not dark gradient)
- CTA section: `var(--truv-primary-blue)` solid background (not dark navy gradient)
- Logo SVGs: always dark fill (`#0F1C47`) — no white logos needed

### Generating Document Ad PDFs

Use headless Chrome with `--no-margins` and `--print-background`:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless --disable-gpu \
  --print-to-pdf="/Users/cameronwolf/Downloads/Projects/truv-brain/docs/ad-creative/linkedin/{Company}_x_Truv_LinkedIn_Document_Ad_2026.pdf" \
  --no-margins --print-background \
  "/Users/cameronwolf/Downloads/Projects/truv-brain/docs/ad-creative/linkedin/{slug}-document-ad-2026.html"
```

For the white variant:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless --disable-gpu \
  --print-to-pdf="/Users/cameronwolf/Downloads/Projects/truv-brain/docs/ad-creative/linkedin/{Company}_x_Truv_LinkedIn_Document_Ad_2026_White.pdf" \
  --no-margins --print-background \
  "/Users/cameronwolf/Downloads/Projects/truv-brain/docs/ad-creative/linkedin/{slug}-document-ad-2026-white.html"
```

### Document Ad Design Rules

- **Page 3 is the gate page.** LinkedIn shows pages 1-3 for free; pages 4-6 require the user to click "Continue Reading" (which counts as a lead). Design page 3 to maximize curiosity.
- **Cover must work at thumbnail size.** Test readability at ~300px wide — that's how it appears in the feed.
- **Use `@page { size: 8.5in 11in; margin: 0; }` and `print-color-adjust: exact`** for accurate PDF output.
- **Each page must be exactly `width: 8.5in; height: 11in; overflow: hidden`** — any bleed will push content to the next PDF page.
- **Use `page-break-after: always`** on each `.page` div.
- **Font files:** Reference Gilroy via `@font-face` from `../../../branding/fonts/Gilroy-{Medium,SemiBold}.woff2` (relative to `docs/ad-creative/linkedin/`).

### Naming Convention

```
docs/ad-creative/linkedin/
├── {slug}-document-ad-2026.html              # Dark HTML source
├── {slug}-document-ad-2026-white.html        # White HTML source
├── {Company}_x_Truv_LinkedIn_Document_Ad_2026.pdf        # Dark PDF
└── {Company}_x_Truv_LinkedIn_Document_Ad_2026_White.pdf  # White PDF
```

## Available Case Studies

To list all available source documents:
```bash
ls /Users/cameronwolf/Downloads/Projects/truv-brain/docs/customer-stories/*-full.html
```
