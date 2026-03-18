# Truv Scout — Self-Learning Lead Scoring Agent

**Date:** 2026-03-12
**Author:** Cameron Wolf
**Status:** Design Complete, Not Started

---

## Overview

Truv Scout is a self-learning lead scoring agent built on Agno (forked from [agno-agi/scout](https://github.com/agno-agi/scout)). It combines deterministic scoring rules, prompted ICP logic, knowledge base navigation, and outcome-based learning to score every inbound lead — and gets smarter over time.

### What It Replaces
The current Agno signal agent (static system prompt, no learning, no knowledge access, hardcoded external trigger score of 40).

### What It Keeps
- Deterministic scorer (`scorer.py`) — form fit, engagement, timing, deal context
- Apollo enrichment — person match, org enrich, hiring signals
- HubSpot integration — contact reads, property writes, list management
- Slack notifications — #outreach-intelligence channel

### What It Adds
- Knowledge base navigation (case studies, product docs, persona guides)
- Filtered tech stack matching (LOS/POS + VOI/VOE only)
- Multi-interaction signal boosting (repeat form fills, email clicks compound)
- Similar-deal matching from HubSpot history
- Company news/regulatory triggers via Firecrawl
- Self-learning with PgVector (what worked, what didn't)
- Monthly weight recommendations based on conversion data
- Deal outcome feedback loop
- Enterprise vs self-service routing classification

---

## Lead Routing — Enterprise vs Self-Service

The scorer outputs a routing label alongside the score and tier. For now this is **data only** — written to HubSpot as a contact property for manual review. When ready, this label will drive automation (enterprise → AE path, self-service → product signup).

### Not a Lead (filter out before scoring)
- "How can we help" = "Log in to Truv" → redirect to dashboard.truv.com/login
- "How can we help" = "Verification Help" → redirect to help.truv.com

### Enterprise (talk to sales)
Primary signals (from form — any one qualifies):
- Role is Executive, VP/SVP/EVP, or Director
- Applications per year > 10,000
- Loans per year > 3,000
- Use case is Public Services / Government

Light-weight boost signals (from Apollo — reinforce or upgrade):
- Employee count > 50
- Revenue > $10M
- LOS/POS detected in tech stack (Encompass, Blend, etc.)
- VOI/VOE competitor detected (Work Number, Truework, etc.)

### Self-Service (product signup)
- Role is Manager or Non-Manager
- AND applications per year ≤ 10,000
- AND loans per year ≤ 3,000
- AND use case is NOT Public Services

Override to Enterprise: if Apollo shows 100+ employees or $50M+ revenue, bump to enterprise (small title at a big company).

### Meeting Links (for future automation)
- Enterprise High Priority (Contact Sales): https://meet.truv.com/meetings/kirill-klokov/contact-sales
- Enterprise Medium Priority (SDR/Demo): https://meet.truv.com/meetings/kirill-klokov/demo
- Government: https://meet.truv.com/meetings/kirill-klokov/govt-contact-sales
- Self-Service: https://dashboard.truv.com/login

### HubSpot Property
- Property name: `lead_routing`
- Type: Single-line text
- Values: `enterprise`, `self-service`, `government`, `not-a-lead`
- Written alongside `inbound_lead_tier`, `form_fit_score`, etc.

---

## Architecture — Four Layers

```
Layer 1: Deterministic Scorer (scorer.py — unchanged, runs first)
    ↓ base scores
Layer 2: Enrichment (Apollo — filtered to LOS/POS + VOI/VOE)
    ↓ tech stack + firmographics
Layer 3: Scout Agent (Agno + knowledge base + prompted ICP)
    ↓ adjusted score + reasoning + recommended action
Layer 4: Learning Engine (PgVector — saves outcomes, surfaces recommendations)
```

### Layer 1 — Deterministic Scorer
Runs on every lead. Same form fit, engagement, timing, deal context logic. Produces a base score and tier (hot/warm/cold). Fast, free, predictable.

### Layer 2 — Enrichment
Apollo person match + org enrich. Filtered to two arrays:
- `los_pos_stack`: Encompass, Blend, Byte, MortgageFlex, Calyx, LoanSphere, Mortgage Cadence, LendingPad, OpenClose
- `voi_voe_stack`: Equifax Workforce Solutions / The Work Number, Truework, Argyle, Plaid (income), Finicity (Mastercard), FormFree, PointServ

Plus: employee count, revenue, industry, hiring signals (filtered to lending/compliance roles only).

### Layer 3 — Scout Agent
Agno agent with:
- Prompted ICP rules (existing, upgraded)
- Existing tools (HubSpot, Apollo, Firecrawl)
- New Scout tools (search knowledge base, read document, save discovery)
- Access to `docs/` directory (case studies, product specs, persona guides)

### Layer 4 — Learning Engine
- Saves every scoring decision as a learning
- Searches past learnings before scoring new leads
- Monthly analysis of actual outcomes → weight change recommendations (recommend + approve model)

---

## Tech Stack Filter

### Mortgage LOS/POS (integration fit)
- Encompass (ICE Mortgage Technology)
- Blend
- Byte Software
- MortgageFlex
- Calyx (Point/Path)
- LoanSphere (Black Knight/ICE)
- Mortgage Cadence
- LendingPad
- OpenClose

### VOI/VOE Providers (displacement opportunity)
- Equifax Workforce Solutions / The Work Number
- Truework
- Argyle
- Plaid (income)
- Finicity (Mastercard)
- FormFree
- PointServ

### Scoring Logic
- LOS match + no VOI provider = greenfield opportunity, score UP
- LOS match + legacy VOI (Work Number/Equifax) = displacement play, score UP, recommend cost savings angle
- LOS match + modern VOI competitor (Argyle/Truework) = competitive deal, flag with differentiation talking points
- No LOS match = likely not in mortgage/lending, noted but doesn't affect score

---

## Data Flow — What Happens When a Lead Comes In

1. **Trigger:** HubSpot form submission fires webhook
2. **Deterministic Score:** scorer.py produces base scores (form fit, engagement, timing, deal context)
3. **Filtered Apollo Enrichment:** Person + org + hiring, filtered to LOS/POS and VOI/VOE lists
4. **Scout Agent Reasoning:**
   - Always: search learnings vector DB for similar past leads
   - If LOS detected: search product docs for integration details
   - If VOI/VOE competitor: search competitive intel for displacement talking points
   - If vertical matches case study: pull relevant customer story
   - If 50+ employees: check hiring signals for lending/compliance roles
   - If repeat visitor: compound engagement signal from HubSpot history
5. **Write Back + Notify:** Scores and reasoning to HubSpot, Slack notification
6. **Save Learning:** Agent saves what it discovered for future leads

---

## Knowledge Base — What Scout Navigates

| Source | Directory | When to Search |
|---|---|---|
| Customer Stories | `docs/customer-stories/` | Lead's vertical or company size matches a story |
| Product & ICP | `docs/knowledge-base/` | Every lead — ICP definitions, product fit, personas |
| Competitive Intel | `docs/knowledge-base/` | VOI/VOE competitor detected in tech stack |
| Ad Performance | `memory/ad-experiments.md` | Which messaging resonated with this vertical |
| Past Scoring Learnings | PgVector DB | Every lead — auto-searched |
| Deal Outcomes | PgVector DB | Every lead — auto-searched |

Navigation pattern (from Scout):
1. Check source registry — "do I have anything relevant?"
2. Get metadata — "what files exist in that directory?"
3. Search content — "grep for company name, vertical, or LOS"
4. Read full document only if match found

---

## Self-Learning — Three Mechanisms

### 1. Discovery Savings (every lead)
Agent saves shortcuts when it finds something useful. Stored in PgVector, auto-searched on future leads.

### 2. Outcome Tracking (when deals progress)
When a contact's lifecycle stage changes (Lead → Opportunity → Customer, or Lead → Disqualified), log the original score, signals, tech stack, and time to convert.

### 3. Monthly Weight Review (recommend + approve)
Agent analyzes all scored leads vs actual outcomes. Produces weight change recommendations. Cameron reviews and approves/rejects. Approved changes update scorer weights.

---

## Deployment — Two Phases

### Phase 1: Pipedream + Scout API (current infra)
- Scout API hosted on Railway (~$5-10/month)
- Pipedream receives HubSpot webhook, POSTs to Scout API
- Scout does all scoring/enrichment/reasoning/learning
- Pipedream writes back to HubSpot + sends Slack
- CLI available for on-demand and batch scoring

### Phase 2: Self-Hosted (drop Pipedream)
- Scout API receives HubSpot webhooks directly (FastAPI)
- Scout handles everything: scoring, enrichment, HubSpot writes, Slack notifications
- One system instead of two
- No free-tier limits, full control, single set of logs

---

## Project Structure

```
truv_scout/
├── agent.py              # Main agent — ICP prompt + knowledge + learning config
├── paths.py              # Points to docs/ directory
├── scorer.py             # Import from outreach_intel/scorer.py
├── config/
│   ├── sources.json      # Source registry (docs dirs + when to search)
│   ├── intents.json      # Intent routing (vertical → case study, LOS → product docs)
│   ├── tech_stacks.json  # LOS/POS + VOI/VOE provider lists
│   └── icp_rules.md      # Prompted ICP logic (migrated from current system prompt)
├── tools/
│   ├── hubspot.py        # get_hubspot_activity, get_form_context (existing)
│   ├── apollo.py         # enrich_contact_data, filtered to LOS/POS + VOI/VOE
│   ├── search.py         # search_content — grep docs/ directory (from Scout)
│   ├── awareness.py      # list_sources, get_metadata (from Scout)
│   ├── firecrawl.py      # search_company_news, check_job_changes (existing)
│   └── outcomes.py       # Log deal outcomes, run monthly analysis
├── knowledge/
│   ├── patterns/
│   │   └── scoring_patterns.md
│   └── learnings/        # Auto-populated by the agent
├── evals/
│   ├── test_cases.py     # Lead scoring test cases
│   └── grader.py         # LLM-based grading
└── cli.py                # CLI entry point
```

---

## Cost Estimates

### Per Lead (automated pipeline)
| Component | Cost |
|---|---|
| HubSpot API | $0.00 |
| Deterministic Scorer | $0.00 |
| Apollo (3 credits) | $0.03 |
| Gemini 2.0 Flash | $0.0001 |
| PgVector search | $0.00 |
| Knowledge doc reads | $0.001 (extra tokens) |
| **Total per lead** | **~$0.03** |

### Infrastructure
| Component | Cost |
|---|---|
| Railway API hosting | ~$5-10/month |
| Railway PgVector DB | included |
| Pipedream (Phase 1 only) | $0 (free tier) |

### Monthly Projections
- 100 leads/month: ~$3 API + $5-10 infra = ~$8-13/month
- 500 leads/month: ~$15 API + $5-10 infra = ~$20-25/month
