# Truv Brain

The central knowledge base and automation hub for Truv's go-to-market teams.

**What's inside:** Brand guidelines, customer proof points, competitive positioning, campaign frameworks, and automation tools — all in one place.

---

## What You'll Find Here

### For Sales
| Resource | What It Does | Location |
|----------|--------------|----------|
| **Customer Proof Points** | Verified metrics and quotes from 15 customer stories, organized by vertical | `docs/content-reference.md` |
| **Pain Point → Feature Mapping** | Objection handling with specific data points | `docs/plans/2026-01-22-cold-email-framework-design.md` |
| **Competitive Positioning** | Key differentiators vs TWN and other providers | `docs/brand-guidelines.md` |
| **Vertical Messaging** | Tailored value props for Mortgage, Consumer Lending, Auto, etc. | `docs/brand-guidelines.md` |

### For Marketing
| Resource | What It Does | Location |
|----------|--------------|----------|
| **Brand Voice Guidelines** | Tone, style, do's and don'ts for all content | `docs/brand-guidelines.md` |
| **Email Templates** | 3-touch cold outreach framework with proven structure | `docs/plans/2026-01-22-cold-email-framework-design.md` |
| **Segmentation Matrix** | Vertical × Objection × Persona targeting framework | `docs/plans/2026-01-22-cold-email-framework-design.md` |
| **Visual Identity** | Colors, typography, logo usage | `docs/brand-guidelines.md` |

### For RevOps
| Resource | What It Does | Location |
|----------|--------------|----------|
| **Contact Scoring Tool** | Identifies high-potential dormant contacts in HubSpot | `outreach_intel/` |
| **Automated Outreach Lists** | Weekly scored contact lists delivered to Slack | Pipedream workflow |
| **Campaign Segmentation** | Framework for tagging and routing contacts | `docs/plans/2026-01-22-cold-email-framework-design.md` |

---

## Knowledge Base Contents

### Brand & Messaging

**`docs/brand-guidelines.md`** — The source of truth for how Truv communicates.

- **Voice:** Confident, clear, professional but approachable
- **Messaging Pillars:** Cost savings, speed, data quality, conversion, all-in-one platform
- **Visual Identity:** Truv Blue (`#2C64E3`), Gilroy font, design patterns
- **Email Structure:** REASON + PROBLEM → VALUE + PROOF → CTA
- **Terminology:** Preferred terms, acronyms, product naming
- **Competitive Language:** How to position against TWN and instant databases

### Customer Proof Points

**`docs/content-reference.md`** — 15 customer stories with verified, quotable metrics.

| Customer | Vertical | Key Metric | Quote Available |
|----------|----------|------------|-----------------|
| CrossCountry Mortgage | Mortgage | $10M/year savings | Yes |
| AmeriSave | Mortgage | 80% savings vs TWN | Yes |
| First Continental | Mortgage | 4-hour support response | Yes |
| MortgageRight | Mortgage | 80% cost savings | Yes |
| Compass Mortgage | Mortgage | 60-80% savings | Yes |
| AFCU | Credit Union | 80% savings, 65% conversion | Yes |
| HFS Financial | Consumer Lending | +15% fraud detection | Yes |
| TurboPass | Auto Lending | 1.5 days faster funding | Yes |
| Piedmont | Payment Services | 90% reduction in manual tasks | Yes |
| B9 | Fintech | +12% funds deposited | Yes |

**Use these for:** Sales decks, case study references, email proof points, competitive objection handling.

### Campaign Frameworks

**`docs/plans/2026-01-22-cold-email-framework-design.md`** — Complete playbook for closed-lost re-engagement.

**Segmentation Matrix:**
```
Vertical (5)          ×    Objection (5)         ×    Persona (4)
─────────────────────────────────────────────────────────────────
Mortgage                   Price/Budget               VP/Director Ops
Consumer Lending           Timing/Roadmap             CTO/VP Engineering
Auto Lending               Competitor Chosen          CFO/Finance
Background Screening       Internal Bandwidth         CEO/Founder
Tenant Screening           No Decision
```

**Pain Point Mapping:** Each objection type maps to specific Truv features with verified proof points.

**Email Templates:** 3-touch sequence (Day 1, 4, 9) with Clay personalization zones.

---

## Data Sources

All content is scraped and verified from primary sources.

### Website Scraping (Firecrawl)

Extracted from truv.com using [Firecrawl](https://firecrawl.dev):

| Source | Pages | Data Extracted |
|--------|-------|----------------|
| Product pages | ~15 | Value props, feature descriptions, messaging |
| Customer stories | 15 | Metrics, quotes, use cases by vertical |
| Blog posts | 10 | Product updates, thought leadership |
| Pricing page | 1 | Tier structure, feature comparison |

**Process:**
```
firecrawl_map (discover URLs) → firecrawl_scrape (extract markdown) → manual curation → docs/
```

### HubSpot Integration

Contact and deal data for outreach automation:
- Lifecycle stage and deal history
- Email engagement (opens, clicks)
- "Why deal fell through" for objection tagging

---

## Automation Tools

### Outreach Intelligence

Python tool that scores dormant HubSpot contacts for re-engagement.

**Scoring Model:**
| Signal | Weight | What It Measures |
|--------|--------|------------------|
| Engagement | 25% | Email opens/clicks recency |
| Timing | 25% | Days since last activity |
| Deal Context | 30% | Lifecycle stage, deal outcome |
| External Triggers | 20% | Job changes, company news |

**CLI Usage:**
```bash
source venv/bin/activate

# Get top dormant contacts
python -m outreach_intel.cli dormant --limit 25

# Get closed-lost contacts
python -m outreach_intel.cli closed-lost --limit 25

# Create HubSpot list
python -m outreach_intel.cli create-list dormant "Campaign Name" --limit 50
```

**Automated Workflow:**
- Runs every Friday 7:30 AM CST via Pipedream
- Posts top contacts to `#outreach-intelligence` Slack channel
- Creates HubSpot list for campaign execution

---

## Quick Reference

### Key Stats to Know

| Stat | Context |
|------|---------|
| **80%** | Cost savings vs The Work Number |
| **96%** | US workforce coverage |
| **$350** | Savings per closed loan |
| **65-70%** | Typical conversion rates |
| **<1 month** | Implementation time |
| **4 hours** | Support response time |

### Product Names (Correct Capitalization)

- Truv (not TRUV or truv)
- Truv Bridge (SDK/widget)
- Truv Dashboard (admin portal)
- Truv Waterfall (multi-method verification)
- Fannie Mae / Freddie Mac (two words each)
- Encompass® (with ® first mention)

### Verticals We Serve

1. **Mortgage Lending** — Most case studies, strongest proof points
2. **Consumer Lending** — HFS, Piedmont stories
3. **Auto Lending** — TurboPass story
4. **Background Screening** — Use general stats
5. **Tenant Screening** — Use general stats
6. **Retail Banking** — DDS focus

---

## Integrations

| Service | Purpose |
|---------|---------|
| **Firecrawl** | Website scraping for content extraction |
| **HubSpot** | Contact/deal data, list management |
| **Slack** | Notifications and alerts |
| **Pipedream** | Workflow automation |
| **Clay** | Email personalization at scale |
| **Knock/Sendgrid** | Email delivery and tracking |

---

## Project Structure

```
truv-brain/
├── docs/
│   ├── brand-guidelines.md      # Voice, visual identity, messaging
│   ├── content-reference.md     # Customer stories and proof points
│   └── plans/                   # Campaign and feature designs
├── outreach_intel/              # Contact scoring automation
│   ├── cli.py                   # Command line interface
│   ├── service.py               # Query interface
│   ├── scorer.py                # Scoring engine
│   └── hubspot_client.py        # HubSpot API client
├── branding/                    # Brand assets and images
└── tests/                       # Test suite
```

---

## Setup

```bash
git clone https://github.com/cameronwolf-coder/truv-brain.git
cd truv-brain
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export HUBSPOT_ACCESS_TOKEN=your_token
```

---

## Contributing

To update content:
1. **New customer story** → Add to `docs/content-reference.md`
2. **Brand changes** → Update `docs/brand-guidelines.md`
3. **New campaign framework** → Add to `docs/plans/`

To refresh from truv.com:
```bash
# Use Firecrawl MCP in Claude Code
firecrawl_scrape(url="https://truv.com/customers/new-story", formats=["markdown"])
```

---

## Owner

**Cameron Wolf** — Sr. Marketing Manager

Questions? Slack `#marketing` or email cameron@truv.com
