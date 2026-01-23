# Truv Brain

Marketing automation toolkit for [Truv](https://truv.com) — the consumer-permissioned data platform for income, employment, and asset verification.

## What This Is

Internal tools and knowledge base for Truv's marketing team to:

1. **Re-engage closed-lost deals** — Score dormant HubSpot contacts and run targeted outreach campaigns
2. **Maintain brand consistency** — Centralized brand guidelines and customer proof points
3. **Automate outreach workflows** — Pipedream integrations for HubSpot and Slack

---

## Outreach Intelligence

Python tool that identifies and scores HubSpot contacts for re-engagement campaigns.

**How it works:**
```
HubSpot Contacts → Scoring Engine → Ranked List → Slack Notification
```

**Scoring Dimensions:**
| Dimension | Weight | Signals |
|-----------|--------|---------|
| Engagement | 25% | Email opens, clicks, recency |
| Timing | 25% | Days since last activity |
| Deal Context | 30% | Lifecycle stage, deal history |
| External Triggers | 20% | Job changes, company news |

**Usage:**
```bash
# Activate environment
source venv/bin/activate

# Get top 25 dormant contacts
python -m outreach_intel.cli dormant --limit 25

# Get closed-lost contacts
python -m outreach_intel.cli closed-lost --limit 25

# Create HubSpot list for campaign
python -m outreach_intel.cli create-list dormant "Q1 Re-engagement" --limit 50
```

**Automation:**
Pipedream workflow runs weekly (Fridays 7:30 AM CST) and posts top contacts to `#outreach-intelligence` Slack channel.

---

## Cold Email Framework

Segmentation system for closed-lost re-engagement campaigns.

**Segmentation Matrix:** Vertical × Objection × Persona

| Verticals | Objection Types | Personas |
|-----------|-----------------|----------|
| Mortgage | Price/Budget | VP/Director Ops |
| Consumer Lending | Timing/Roadmap | CTO/VP Engineering |
| Auto Lending | Competitor Chosen | CFO/Finance |
| Background Screening | Internal Bandwidth | CEO/Founder |
| Tenant Screening | No Decision | |

**Workflow:**
```
HubSpot Closed-Lost → Segment Tags → Clay Personalization → 3-Touch Sequence
```

See `docs/plans/2026-01-22-cold-email-framework-design.md` for full framework.

---

## Brand Knowledge Base

Scraped from truv.com and maintained for consistent messaging.

| Document | Contents |
|----------|----------|
| `docs/brand-guidelines.md` | Voice, tone, colors, typography, messaging pillars |
| `docs/content-reference.md` | 15 customer stories with metrics and quotes |

**Key Proof Points:**
- 80% cost savings vs The Work Number (AmeriSave, AFCU, MortgageRight)
- $10M/year savings (CrossCountry Mortgage)
- 4-hour support response time (First Continental)
- 96% US workforce coverage
- Fannie Mae & Freddie Mac approved

---

## Project Structure

```
truv-brain/
├── outreach_intel/          # Contact scoring tool
│   ├── cli.py               # Command line interface
│   ├── service.py           # Main query interface
│   ├── scorer.py            # Scoring engine
│   └── hubspot_client.py    # HubSpot API client
├── docs/
│   ├── brand-guidelines.md  # Brand voice & visual identity
│   ├── content-reference.md # Customer stories & proof points
│   └── plans/               # Design documents
├── tests/                   # Test suite
└── branding/                # Brand assets
```

---

## Integrations

| Service | Purpose |
|---------|---------|
| **HubSpot** | Contact/deal data, list creation |
| **Slack** | Notifications to #outreach-intelligence |
| **Pipedream** | Workflow automation |
| **Clay** | Email personalization at scale |
| **Knock/Sendgrid** | Email delivery |

---

## Setup

```bash
# Clone
git clone https://github.com/cameronwolf-coder/truv-brain.git
cd truv-brain

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export HUBSPOT_ACCESS_TOKEN=your_token

# Run tests
pytest tests/ -v
```

---

## Owner

**Cameron Wolf** — Sr. Marketing Manager, Truv
