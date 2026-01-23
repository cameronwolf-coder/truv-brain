# Marketing Knowledge Base

Central repository for Truv's brand voice, messaging, and customer proof points.

## What's Here

| Document | Purpose | Audience |
|----------|---------|----------|
| `brand-guidelines.md` | Voice, tone, visual identity, competitive positioning | Marketing, Design, Sales |
| `content-reference.md` | 15 customer stories with verified metrics and quotes | Sales, Marketing, Customer Success |
| `overview.md` | Company and product overview | All teams |
| `personas.md` | Buyer personas and ICP definitions | Sales, Marketing |
| `products.md` | Product descriptions and positioning | Sales, Marketing |
| `proof-points.md` | Key statistics and data points | Sales, Marketing |
| `voice-guide.md` | Writing style and terminology | Content creators |

---

## Quick Links

### Need a customer quote?
→ `content-reference.md` — 15 stories organized by vertical with quotable metrics

### Writing customer-facing content?
→ `brand-guidelines.md` — Voice, tone, email structure, terminology

### Building a sales deck?
→ `proof-points.md` — Verified stats you can use

### Targeting a specific persona?
→ `personas.md` — ICP definitions and pain points

---

## Key Documents

### brand-guidelines.md

The source of truth for how Truv communicates.

**Includes:**
- Brand voice characteristics (confident, clear, customer-centric)
- Messaging pillars (cost savings, speed, data quality, conversion)
- Visual identity (colors, typography, design patterns)
- Email structure (REASON + PROBLEM → VALUE + PROOF → CTA)
- Competitive positioning (vs TWN, instant databases)
- Product naming and terminology

### content-reference.md

Customer stories scraped from truv.com with verified metrics.

**Coverage:**
- 15 customer stories
- 10 blog posts
- Organized by vertical (Mortgage, Consumer Lending, Auto, etc.)
- Each story includes: company size, results metrics, quotable text

**Top proof points:**
| Metric | Customer |
|--------|----------|
| $10M/year savings | CrossCountry Mortgage |
| 80% savings vs TWN | AmeriSave |
| 4-hour support response | First Continental |
| +15% fraud detection | HFS Financial |

---

## Subfolders

### plans/

Design documents and implementation plans. See `plans/README.md`.

### branding/

Visual assets (logos, fonts, colors). See `branding/README.md`.

---

## How This Was Built

Content extracted from truv.com using [Firecrawl](https://firecrawl.dev):

```
firecrawl_map (discover URLs) → firecrawl_scrape (extract markdown) → manual curation
```

**Last updated:** January 2025

---

## Updating Content

**New customer story:**
1. Scrape from truv.com: `firecrawl_scrape(url="https://truv.com/customers/[name]")`
2. Extract metrics and quotes
3. Add to `content-reference.md` following existing format

**Brand changes:**
1. Update `brand-guidelines.md`
2. Note change in revision history at bottom of file

**New product/feature:**
1. Update `products.md`
2. Add to relevant messaging sections in `brand-guidelines.md`
