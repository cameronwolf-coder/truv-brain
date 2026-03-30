# Truv Brain

Truv's GTM automation platform. Houses marketing intelligence, lead scoring, campaign orchestration, and internal dashboards in one monorepo.

**Stack:** React 19 + TypeScript + Vite | Express API | Python (outreach + agents) | AWS App Runner + Vercel

---

## Architecture

```
truv-brain/
├── src/                        # React web app (dashboards, tools, builders)
├── api/                        # Express API routes (HubSpot, Scout, email, ads)
├── server.ts                   # Express server (port 3001)
│
├── truv-scout/                 # AI lead scoring agent (AWS App Runner)
│   └── truv_scout/             # Python package — pipeline, scoring, HubSpot sync
│
├── outreach_intel/             # Python outreach tools
│   ├── hubspot_client.py       # HubSpot API client (contacts, deals, companies)
│   ├── scorer.py               # Dormant/closed-lost contact scoring
│   ├── ad_exporter.py          # Meta/Google/LinkedIn ad data export
│   ├── clay_client.py          # Clay enrichment integration
│   ├── smartlead_uploader.py   # Cold outreach lead upload
│   └── cli.py                  # CLI interface
│
├── los-pos-bot/                # LOS/POS tech stack detector (Apollo-powered)
│   └── los_pos_bot/            # Python package — pipeline, normalizer, HubSpot writer
│
├── docs/
│   ├── email-templates/        # SendGrid HTML templates
│   ├── landing-pages/          # Gated landing pages
│   ├── customer-stories/       # Case study PDFs and pages
│   ├── ad-creative/            # LinkedIn and Meta ad mockups
│   ├── knowledge-base/         # Products, personas, proof points, voice guide
│   ├── plans/                  # Implementation plans
│   ├── reports/                # Weekly reports
│   └── presentations/          # Decks and documents
│
├── branding/                   # Logos, fonts, color specs
├── pipedream/                  # Pipedream workflow code (HubSpot events, SmartLead)
├── scripts/                    # One-off scripts (HubSpot snapshot, badge upload)
├── agents/                     # AI agent configs (CMO, etc.)
├── exports/                    # Ad platform CSV exports
├── figma-plugin/               # Truv Ad Generator Figma plugin
├── sendgrid-mcp/               # SendGrid MCP server
├── tests/                      # Python test suite
└── public/                     # Static assets (Gilroy fonts, logos)
```

---

## Quick Start

### Web App (Dashboards + API)

```bash
npm install
npm run dev:local    # Starts Express (3001) + Vite (5173) concurrently
```

> `npm run dev` starts Vite only. API routes require `dev:local`.

### Python Tools

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Outreach Intelligence
python -m outreach_intel.cli dormant --limit 25
python -m outreach_intel.cli closed-lost --limit 25
python -m outreach_intel.cli create-list dormant "Campaign Name" --limit 50

# Tests
pytest tests/ -v
```

### Truv Scout (standalone)

```bash
cd truv-scout
pip install -r requirements.txt
python -m truv_scout.app       # FastAPI on port 8000
```

Production: deployed to AWS App Runner via `deploy.sh`.

---

## Core Systems

### Truv Scout — AI Lead Scoring Agent

Scores self-service dashboard signups, closed-lost re-engagements, and form submissions through a multi-layer enrichment pipeline.

| Layer | What It Does |
|-------|-------------|
| HubSpot lookup | Pull existing CRM data, deal history |
| Company enrichment | Firmographics, tech stack, industry |
| AI scoring (Gemini) | ICP fit score, buying signals, recommended action |
| HubSpot write-back | Update contact properties, create tasks |
| Slack notification | Alert sales in #sales-dashboard-signups |
| SmartLead routing | Route qualified leads to cold outreach sequences |

**Pipelines:** `form_submission`, `closed_lost_reengagement`, `dashboard_signup`

**Deployed at:** AWS App Runner (ECR image)

### Outreach Intelligence — Contact Scoring

Scores dormant HubSpot contacts for re-engagement campaigns.

| Signal | Weight |
|--------|--------|
| Engagement (opens/clicks) | 25% |
| Timing (days since activity) | 25% |
| Deal Context (lifecycle, outcome) | 30% |
| External Triggers (job changes) | 20% |

Runs weekly via Pipedream, posts to `#outreach-intelligence` Slack channel.

### Ad Performance Loop

Export -> Analyze -> Generate -> Launch -> Measure -> Repeat.

```bash
# Export ad data (Meta API, Google/LinkedIn via browser)
python -m outreach_intel.ad_exporter meta --days 30
python -m outreach_intel.ad_exporter all --days 30
```

CSVs land in `exports/`. Analysis and copy generation run through Claude Code skills.

### LOS/POS Bot — Lender Tech Stack Detection

Detects loan origination and point-of-sale systems at mortgage companies using Apollo data, then writes findings back to HubSpot company records.

```bash
cd los-pos-bot
python -m los_pos_bot.cli scan --limit 50
```

---

## Web App Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Home | Navigation hub |
| `/scout-dashboard` | Scout Dashboard | Real-time Truv Scout pipeline monitoring |
| `/showcase/scout` | Scout Showcase | Card-based pipeline navigation |
| `/los-pos-dashboard` | LOS/POS Dashboard | Lender tech stack data |
| `/data-enrichment` | Data Enrichment | AI company enrichment (4 agents, SSE) |
| `/list-builder` | List Builder | HubSpot list creation |
| `/smart-list-builder` | Smart List Builder | Advanced segmented lists |
| `/email-builder` | Email Builder | Template editor |
| `/email-performance` | Email Performance | SendGrid analytics |
| `/hub` | Marketing Hub | Campaign management |
| `/brand` | Brand | Guidelines and assets |
| `/products` | Products | Product reference |
| `/personas` | Personas | Buyer persona library |
| `/proof-points` | Proof Points | Customer metrics |
| `/campaigns` | Campaigns | Campaign tracker |
| `/roi-generator` | ROI Generator | Sales enablement calculator |
| `/video-editor` | Video Editor | Webinar clip tool |

---

## Integrations

| Service | Role | Config |
|---------|------|--------|
| **HubSpot** | CRM — contacts, deals, companies, lists | `outreach_intel/hubspot_client.py` |
| **SendGrid** | Email delivery, templates | `sendgrid-mcp/` |
| **Knock** | Workflow orchestration, email triggers | MCP + Management API |
| **Smartlead** | Cold outreach sequences | `outreach_intel/smartlead_uploader.py` |
| **Clay** | CSV enrichment, work email lookup | `outreach_intel/clay_client.py` |
| **Pipedream** | Event-driven workflow automation | `pipedream/` |
| **Slack** | Notifications, alerts | Scout + Outreach Intel |
| **Apollo** | Company/people data for LOS/POS bot | `los-pos-bot/` |
| **Meta Ads API** | Ad performance export | `outreach_intel/ad_exporter.py` |
| **Firecrawl** | Website scraping for content | AI enrichment agents |
| **Cloudinary** | Email image hosting | Authenticated uploads |

---

## Email Two-Lane Architecture

Contacts are never in both lanes simultaneously. The `outreach_status` HubSpot property controls routing:

| Status | Lane | System |
|--------|------|--------|
| *(empty)* | Cold outreach eligible | Smartlead |
| `active` | In cold sequence | Smartlead |
| `exhausted` | Marketing nurture | Knock/SendGrid |
| `engaged` | Sales working | Neither (manual) |

---

## Key Reference Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | AI assistant instructions, CLI commands, design tokens |
| `docs/knowledge-base/` | Products, personas, proof points, voice guide |
| `docs/email-templates/` | SendGrid HTML templates |
| `docs/plans/` | Campaign and feature implementation plans |
| `branding/` | Logos, Gilroy fonts, color palette |

---

## Deployment

| Component | Platform | Details |
|-----------|----------|---------|
| Web app + API | Vercel | Auto-deploy from main |
| Truv Scout | AWS App Runner | ECR container, `deploy.sh` |
| Pipedream workflows | Pipedream | GTM Automation project |

---

## Owner

**Cameron Wolf** — Sr. Marketing Manager, Truv

Slack: `#marketing` | Email: cameron@truv.com
