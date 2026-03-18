# Truv Scout

Self-learning lead scoring agent that replaces Clay ($720/mo) with a 4-layer pipeline: deterministic scoring, Apollo enrichment, AI reasoning, and outcome-based learning.

Built for Truv's inbound lead flow. Scores every form submission, classifies routing, matches tech stacks, and posts results to HubSpot + Slack.

## Architecture

```
Inbound Lead (HubSpot form / Pipedream webhook)
        |
        v
  Layer 1: Deterministic Scorer
  Score 0-100 across 5 dimensions
        |
        v
  Layer 2: Apollo Enrichment
  Tech stack filtering, firmographics, hiring signals
        |
        v
  Layer 3: Scout Agent (Gemini 2.0 Flash)
  ICP reasoning, knowledge search, +/-15pt adjustment
        |
        v
  Layer 4: Learning Engine (planned)
  PgVector similarity search, outcome feedback
        |
        v
  Output: Score + Tier + Routing + Reasoning
  Written to HubSpot, posted to Slack
```

Each layer degrades gracefully. If Apollo fails, the pipeline continues with base scores. If the agent fails, deterministic results are returned. Nothing blocks.

## Scoring

### Dimensions (Layer 1)

| Dimension | Weight | Source |
|---|---|---|
| Form Fit | 25% | Job title, use case, volume |
| Engagement | 25% | Email opens, clicks, sends since last engagement |
| Timing | 25% | Days since last activity, conversion recency |
| Deal Context | 30% | Lifecycle stage, lead status |
| External Triggers | 20% | Job changes, company news (via Firecrawl) |

### Tiers

| Tier | Score | Meaning |
|---|---|---|
| Hot | 70+ | Route immediately, high intent |
| Warm | 40-69 | Nurture, monitor for signals |
| Cold | <40 | Low priority, passive nurture |

### Routing

| Route | Criteria |
|---|---|
| **Enterprise** | Executive/VP/Director role, OR 10K+ apps/yr, OR 3K+ loans/yr, OR Apollo: 100+ employees / $50M+ revenue |
| **Self-Service** | Manager/IC role with moderate volume at smaller company |
| **Government** | "Public Services" use case |
| **Not-a-Lead** | "Log in to Truv" or "Verification Help" form responses |

### Agent Adjustment (Layer 3)

The Scout agent can adjust the deterministic score by up to +/-15 points based on signals the rules engine can't capture:

- Tech stack intent (greenfield +10, displacement +8, competitive +3)
- Multi-interaction compounding (repeat form fills, email click + form in same week)
- Knowledge base matches (relevant case study, competitive intel)
- Hiring signals (lending/compliance roles)

## Tech Stack Matching

Apollo enrichment data is filtered against known mortgage/lending tech stacks:

**LOS/POS (integration fit):**
Encompass, ICE Mortgage Technology, Blend, Byte Software, MortgageFlex, Calyx, LoanSphere, Black Knight, Mortgage Cadence, LendingPad, OpenClose

**VOI/VOE (displacement opportunity):**
- Legacy (high-cost displacement): Work Number, Equifax Workforce Solutions, PointServ
- Modern competitors: Truework, Argyle, Plaid, Finicity, FormFree

**Intent classification:**

| Intent | Condition | Score Adj |
|---|---|---|
| Greenfield | LOS match + no VOI provider | +10 |
| Displacement | LOS match + legacy VOI | +8 |
| Competitive | LOS match + modern VOI competitor | +3 |
| No Match | No LOS detected | 0 |

## Project Structure

```
truv-scout/
├── docs/
│   ├── 2026-03-12-truv-scout-design.md    # Full design document
│   └── inbound-lead-scoring-pipedream-handoff.md
├── tests/
│   ├── conftest.py                         # Path setup for imports
│   ├── test_scout_api.py                   # FastAPI endpoint tests (4)
│   ├── test_scout_apollo.py                # Tech stack filtering tests (13)
│   └── test_scout_scorer.py                # Routing + tier tests (25)
├── truv_scout/
│   ├── __init__.py
│   ├── agent.py              # Agno Scout agent (Gemini 2.0 Flash)
│   ├── app.py                # FastAPI app (GET /health, POST /score, POST /webhook)
│   ├── cli.py                # Typer CLI (score, score-batch, route, enrich, search, eval)
│   ├── hubspot_writer.py     # Write scores back to HubSpot contact properties
│   ├── models.py             # Pydantic + dataclass models
│   ├── pipeline.py           # 4-layer pipeline orchestrator
│   ├── scorer.py             # Deterministic scorer + lead router
│   ├── settings.py           # Environment config (pydantic-settings)
│   ├── slack.py              # Slack Block Kit notifications
│   ├── config/
│   │   ├── icp_rules.md      # Agent system prompt (ICP logic, scoring rules)
│   │   ├── intents.json      # Tech intent classification + score adjustments
│   │   ├── sources.json      # Knowledge base source registry
│   │   └── tech_stacks.json  # LOS/POS + VOI/VOE provider lists
│   ├── evals/
│   │   ├── grader.py         # Eval runner (routing + tier checks)
│   │   └── test_cases.py     # 22 test lead profiles
│   └── tools/
│       ├── apollo.py         # Filtered Apollo enrichment wrapper
│       ├── awareness.py      # Knowledge source navigation
│       ├── firecrawl.py      # Company news + job change search
│       ├── hubspot.py        # HubSpot activity + engagement history
│       └── search.py         # Knowledge base content search
└── README.md
```

## Setup

### Environment Variables

Create a `.env` file in the project root:

```bash
HUBSPOT_API_TOKEN=pat-na1-...       # HubSpot private app token
APOLLO_API_KEY=...                   # Apollo.io API key
GOOGLE_API_KEY=...                   # Gemini API key (for Scout agent)
SLACK_WEBHOOK_URL=https://hooks...   # Slack incoming webhook
FIRECRAWL_API_KEY=...                # Firecrawl API key (optional)
ENVIRONMENT=development              # development | production
```

### Dependencies

Truv Scout depends on the `outreach_intel` package (sibling directory in the parent repo). Key imports:

| Package | What's Used |
|---|---|
| `outreach_intel.scorer` | `ContactScorer`, `ScoredContact`, scoring weights |
| `outreach_intel.hubspot_client` | `HubSpotClient` for contact CRUD |
| `outreach_intel.enrichment.apollo_client` | `ApolloClient` for person/org/hiring enrichment |
| `outreach_intel.signal_tools` | Agent tools (company news, job changes, HubSpot activity) |

Install Python dependencies:

```bash
pip install fastapi uvicorn pydantic-settings agno google-generativeai requests typer python-dotenv httpx
```

## CLI Usage

```bash
# Score a single lead
python -m truv_scout.cli score <contact_id>
python -m truv_scout.cli score <contact_id> --json
python -m truv_scout.cli score <contact_id> --skip-enrichment --skip-agent

# Score a batch from a HubSpot list
python -m truv_scout.cli score-batch <list_id> --limit 25

# Quick routing check (no enrichment, no agent)
python -m truv_scout.cli route <contact_id>

# Run Apollo enrichment for an email
python -m truv_scout.cli enrich user@company.com

# Search the knowledge base
python -m truv_scout.cli search "mortgage lender"
python -m truv_scout.cli search "Encompass" --dir customer-stories

# Run evaluation suite
python -m truv_scout.cli eval
```

### CLI Output Example

```
🔥 Scout Score: 82.5 (HOT)
   Base Score: 75.0 | Adjustment: +7.5
   Routing: enterprise | Confidence: high

   Breakdown:
     Form Fit: 30
     Engagement: 15
     Timing: 15
     Deal Context: 10
     External: 5

   Enrichment:
     Company: ABC Mortgage Corp
     Employees: 450
     LOS/POS: Encompass
     VOI/VOE: Work Number
     Tech Intent: displacement

   Reasoning: VP at mid-size mortgage lender using Encompass with legacy
   Work Number integration. Strong displacement opportunity — lead with
   60-80% cost savings vs Equifax.
   Action: Route to enterprise AE, share displacement case study.
```

## API

Start the server:

```bash
uvicorn truv_scout.app:app --reload --port 8000
```

### Endpoints

#### `GET /health`

```json
{"status": "ok"}
```

#### `POST /score`

Score a lead through the full pipeline.

```bash
curl -X POST http://localhost:8000/score \
  -H "Content-Type: application/json" \
  -d '{"contact_id": "12345"}'
```

Request body (`ScoreRequest`):

| Field | Type | Required | Default |
|---|---|---|---|
| `contact_id` | string | One of contact_id or email | - |
| `email` | string | One of contact_id or email | - |
| `first_name` | string | No | - |
| `last_name` | string | No | - |
| `company` | string | No | - |
| `domain` | string | No | - |
| `skip_enrichment` | bool | No | false |
| `skip_agent` | bool | No | false |

Response body (`ScoreResponse`):

| Field | Type | Description |
|---|---|---|
| `contact_id` | string | HubSpot contact ID |
| `total_score` | float | Final score (0-100) |
| `tier` | string | hot / warm / cold |
| `routing` | string | enterprise / self-service / government / not-a-lead |
| `reasoning` | string | Agent's reasoning for the score |
| `recommended_action` | string | Suggested next step |
| `confidence` | string | high / medium / low |
| `tech_matches` | object | `{los_pos: [...], voi_voe: [...]}` |
| `form_fit_score` | float | Form fit component |
| `engagement_score` | float | Engagement component |
| `timing_score` | float | Timing component |
| `deal_context_score` | float | Deal context component |
| `external_trigger_score` | float | External trigger component |
| `agent_adjustment` | float | Points added/subtracted by agent |
| `knowledge_sources_used` | array | Docs referenced by agent |

#### `POST /webhook`

Pipedream relay endpoint. Accepts a simplified payload and returns score summary.

```bash
curl -X POST http://localhost:8000/webhook \
  -H "Content-Type: application/json" \
  -d '{"contact_id": "12345", "event_type": "form_submission"}'
```

Response:

```json
{
  "contact_id": "12345",
  "score": 72.5,
  "tier": "hot",
  "routing": "enterprise"
}
```

## HubSpot Properties

When scoring completes, these properties are written to the contact:

| Property | Value |
|---|---|
| `inbound_lead_tier` | hot / warm / cold |
| `form_fit_score` | 0-100 (rounded) |
| `lead_routing` | enterprise / self-service / government / not-a-lead |
| `scout_reasoning` | Agent reasoning (max 1000 chars) |
| `scout_confidence` | high / medium / low |
| `scout_scored_at` | ISO 8601 timestamp |
| `scout_tech_stack_matches` | Matched providers (max 500 chars) |

These properties must be created in HubSpot before first use.

## Slack Notifications

Scored leads are posted to `#outreach-intelligence` via Block Kit messages containing:

- Header with tier emoji and score
- Contact ID and routing
- Score breakdown (form fit, engagement, timing, deal context, external)
- Enrichment summary (company, employees, industry)
- Tech stack matches
- Agent reasoning and recommended action

## Testing

```bash
# Run all Scout tests (42 tests)
pytest truv-scout/tests/ -v

# Run by file
pytest truv-scout/tests/test_scout_scorer.py -v    # 25 routing + tier tests
pytest truv-scout/tests/test_scout_apollo.py -v    # 13 tech stack tests
pytest truv-scout/tests/test_scout_api.py -v       # 4 API endpoint tests

# Run eval suite (22 test leads)
python -m truv_scout.cli eval
```

### Test Coverage

| Area | Tests | What's Covered |
|---|---|---|
| Routing | 12 | Enterprise (role, volume, Apollo override), self-service, government, not-a-lead |
| Tiers | 5 | Hot/warm/cold thresholds, boundary values at 40 and 70 |
| Revenue parsing | 5 | $50M, ranges, billions, None, "Unknown" |
| Tech stack filtering | 7 | LOS/POS matches, VOE matches, case-insensitive, mixed stacks |
| Tech intent | 5 | Greenfield, displacement, competitive, no-match, displacement priority |
| Hiring filter | 2 | Relevant titles kept, irrelevant filtered |
| API endpoints | 4 | Health check, validation, mocked scoring, webhook |
| Eval profiles | 22 | Enterprise, self-service, government, not-a-lead, edge cases |

## Planned (Not Yet Built)

These require AWS infrastructure (RDS PostgreSQL + App Runner):

- **Learning engine** -- PgVector similarity search for matching against past scored leads
- **Outcome tracking** -- Feedback loop from deal outcomes (won/lost) to adjust scoring weights
- **Monthly analysis** -- Automated weight recommendations based on conversion data
- **Containerized deployment** -- Dockerfile + App Runner for production hosting
- **Pipedream webhook relay** -- Production webhook bridge from HubSpot to Scout API
