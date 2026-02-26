# Case Study PDF Design System

## Brand Foundation

### Colors (CSS Custom Properties)
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

### Typography
- **Font Family:** Gilroy (Medium 500, SemiBold 600)
- **Font Source:** `../../branding/fonts/Gilroy-Medium.woff2` and `Gilroy-SemiBold.woff2` (relative to the output HTML)
- **Fallback Stack:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Base:** 16px, weight 500, line-height 1.6

### Font Size Hierarchy (Strict)

All body/paragraph text MUST use a consistent size. Do not vary paragraph font sizes between sections.

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Cover headline | 42px | 600 | Page 1 main headline |
| Section title | 22px | 600 | H2 titles on each page |
| Partnership/dark section title | 18-20px | 600 | Titles inside dark sections |
| Card title (h4) | 13-15px | 600 | Challenge, outcome, integration card headings |
| **Body paragraph** | **13px** | **500** | **ALL body text, descriptions, intros — must be consistent** |
| Section label | 12px | 600 | Uppercase labels above section titles |
| Small descriptive text | 10-11px | 500 | Fact labels, stat labels, card descriptions in dense sections |
| Tiny metadata | 9-10px | 500-600 | Page footer text, comparison labels, transform step labels |

**Critical rule:** Body paragraph text (`.company-description`, `.challenge-hero-text`, `.detail-content`, `.conclusion-content`, `.about-card p`, `.integration-card p`, `.challenge-card p`) must ALL be the same font size (13px). Do not use 11px, 12px, or 14px for body paragraphs — the inconsistency is visually jarring in print.

### Section Labels
```css
font-size: 12px; font-weight: 600; letter-spacing: 0.18em;
text-transform: uppercase; color: var(--truv-primary-blue);
margin-bottom: 8px;
```
Section labels must be prominent enough to be clearly readable. Never use less than 12px.

### Truv Logo (Inline SVG)
The Truv logo MUST be embedded as inline SVG in every instance (header, footer, cover). Never use an external image file. The SVG viewBox is `"0 0 69 25"` with 4 path elements.

- **White fill** for dark backgrounds (cover, CTA, dark sections)
- **Black fill** (actually `var(--truv-dark-blue)`) for light page headers
- **Reduced opacity (0.25)** for page footers

## Page Layout

### Fixed Dimensions
```css
@page { size: 8.5in 11in; margin: 0; }
.page { width: 8.5in; height: 11in; max-height: 11in; overflow: hidden; }
```

### Print Optimization
```css
-webkit-print-color-adjust: exact;
print-color-adjust: exact;
page-break-after: always;
page-break-inside: avoid;
```

### Inner Page Structure
```css
.inner-page {
    padding: 0 48px;
    display: flex;
    flex-direction: column;
    height: 11in;
    max-height: 11in;
    overflow: hidden;
}
```

### Page Header (pages 2-6)
- Logo left, page number right
- `padding: 24px 0 12px`, `border-bottom: 1px solid rgba(0, 0, 0, 0.06)`
- Page number: 11px, font-weight 600, primary blue

### Page Footer (pages 3-5, or as needed)
- Logo left (14px, opacity 0.25), "Company x Truv" right
- `margin-top: auto` to push to bottom
- `border-top: 1px solid rgba(0, 0, 0, 0.06)`

## Preventing Page Bleed (Critical)

Content bleeding past 11in page boundaries is the most common layout issue. Follow these rules:

### Page 3 (Challenge) — High bleed risk
The challenge page has the most content density (hero + 5 cards + quote). Use tighter spacing:
- **Challenge hero:** `padding: 28px 48px` (not 36px), `margin-bottom: 18px` (not 32px)
- **Challenge cards:** `gap: 10px` (not 14px), `margin-bottom: 16px` (not 28px)
- **Challenge card:** `padding: 12px 16px` (not 18px 20px)
- **Quote block:** `padding: 20px 24px` (not 28px 32px), `margin-bottom: 0`
- **Quote text:** `font-size: 14px`, `line-height: 1.45`, `padding-top: 14px`

### Page 5 (Outcomes) — Moderate bleed risk
Three distinct sections compete for space (outcome cards + comparison + partnership):
- **Outcome cards:** `gap: 16px`, `padding: 18px 20px`, `margin-bottom: 20px`
- **Comparison grid:** `gap: 16px`, card `padding: 14px 16px`
- **Partnership section:** fixed `margin-top: 24px` (NOT `margin: auto`) so it sits right below the comparison grid

### General anti-bleed rules
- After building any page, mentally add up the vertical space consumed. If it's close to 11in, reduce padding and gaps preemptively.
- **Never use `margin: auto -48px 0`** on dark sections when there's also a `page-footer` with `margin-top: auto` on the same page — the two auto-margins compete and create large gaps.
- Use fixed `margin-top` on dark sections when a footer follows them on the same page.
- Reserve `margin: auto -48px 0` for dark sections that ARE the last element on their page (no footer below).

## Spacing Scale
- **4px** — Tight (label gaps)
- **8px** — Compact (card internal, margin-bottom for labels)
- **12px** — Standard (grid gaps, small margins)
- **14px** — Medium (card gaps)
- **16px** — Comfortable (section internal gaps, grid gaps)
- **20px** — Section margins
- **24px** — Page header padding, large section gaps
- **28px** — Large section gaps
- **48px** — Page horizontal padding

## Border Radius Scale
- **6px** — Small elements (icon boxes, buttons)
- **8px** — Medium (fact cards, stat cards, partnership tiles)
- **10px** — Standard cards (challenge, outcome, integration, comparison)
- **12px** — Featured elements (quote blocks, result cards)

## Opacity Patterns
### On Light Backgrounds
- Borders: `rgba(0, 0, 0, 0.06)`
- Subtle text: `rgba(23, 23, 23, 0.45)` to `rgba(23, 23, 23, 0.65)`
- Dividers: `rgba(0, 0, 0, 0.08)`

### On Dark Backgrounds
- Borders: `rgba(255, 255, 255, 0.06)` to `rgba(255, 255, 255, 0.08)`
- Subtle text: `rgba(255, 255, 255, 0.45)` to `rgba(255, 255, 255, 0.8)`
- Card backgrounds: `rgba(255, 255, 255, 0.05)` to `rgba(255, 255, 255, 0.06)`

## Dark Section Gradient
All dark sections use the same gradient:
```css
background: linear-gradient(135deg, var(--truv-dark-blue) 0%, #1a3a7a 100%);
```

Full-bleed dark sections (last element on page, no footer below):
```css
margin: auto -48px 0; padding: 24px 48px 28px;
```

Full-bleed dark sections (footer follows on same page):
```css
margin: 24px -48px 0; padding: 20px 48px 22px;
```

## Component Patterns

### Section Labels
```css
font-size: 12px; font-weight: 600; letter-spacing: 0.18em;
text-transform: uppercase; color: var(--truv-primary-blue);
margin-bottom: 8px;
```

### Section Titles
```css
font-size: 22px; font-weight: 600; color: var(--truv-dark-blue);
line-height: 1.2; margin-bottom: 12px;
```

### Card Pattern (Challenge/Outcome/Integration)
- Border: `1px solid rgba(0, 0, 0, 0.06)`
- Border-radius: 10px
- Padding: 14-20px (use 12-16px on dense pages like Challenge)
- Accent: `border-top: 3px solid var(--truv-primary-blue)` or `border-left: 3px`

### Icon Badges (in cards)
- Circle: 32px, `background: var(--truv-primary-blue)`, white SVG icon (16px)
- Square: 24-28px, `background: rgba(44, 100, 227, 0.1)`, blue SVG icon (14-16px)

### Quote Block (Featured)
- Background: `linear-gradient(135deg, rgba(197, 217, 247, 0.35), rgba(232, 240, 252, 0.5))`
- Padding: `20px 24px` (keep compact to prevent page bleed)
- Large decorative quote mark: Georgia serif, 48px, opacity 0.15
- Quote text: 14px, line-height 1.45, padding-top 14px
- Avatar circle: 40px, dark blue, white initials

### Inline Quote
- Background: `var(--truv-grey)`
- `border-left: 3px solid var(--truv-primary-blue)`
- Italic text, cite block below

### Comparison Grid (Before/After)
- 2-column grid, gap 16px
- Card padding: 14px 16px
- Before: grey background, dark text
- After: dark gradient background, white text
- Rows: flex with space-between, border-bottom separators

### Stat Cards (Cover/Results)
- Dark background, white numbers
- Value: 36-46px, weight 600
- Unit suffix: smaller font, primary blue color
- Label: 10px uppercase, 50-60% opacity white

### Partnership Section (Icon Tile Grid)
Use a 3x2 grid of icon tiles instead of bullet lists. Walls of text in dark sections are visually dense and hard to scan.

```css
.partnership-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
}
.partnership-tile {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
}
```

Each tile has:
- Icon badge: 28px, `background: rgba(44, 100, 227, 0.25)`, light-blue SVG (14px)
- Title: 11px, weight 600, white
- Description: 10px, `rgba(255, 255, 255, 0.55)`

### CTA Section
- Dark blue background
- Geometric circle accents (::before, ::after)
- Primary button: blue background, white text
- Secondary button: transparent, white border
- Contact line: small, subtle
- Footer logo: white, 0.3 opacity

### Transformation Flow (horizontal)
- Flex row with arrow separators
- Each step: label (9px uppercase) + value (12px bold)
- Arrows: primary blue, `&#8594;` entity
- Bordered top and bottom
