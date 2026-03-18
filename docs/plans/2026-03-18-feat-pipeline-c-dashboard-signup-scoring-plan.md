---
title: "feat: Pipeline C — Dashboard Signup Scoring"
type: feat
status: completed
date: 2026-03-18
---

# Pipeline C — Dashboard Signup Scoring

## Overview

A new real-time + batch pipeline that scores Truv Dashboard signups — the highest-intent leads we have. These people actually created an account and used the product, but most have never been qualified or reached out to. Pipeline C watches `#dashboard-signups` for DashBot notifications, finds or creates the contact in HubSpot, runs the full Scout scoring pipeline, and alerts the team on hot leads.

**Why this matters:** There's a massive backlog of unscored Dashboard signups. Even one-off "sales dashboard" users could be enterprise-fit — we just never looked. This pipeline closes that gap permanently.

## Problem Statement

1. **Dashboard signups are the highest-intent signal we have** — someone created an account and used the product — but they're invisible to the scoring system.
2. **Pipeline A** only catches marketing form submissions ("Get Started" form). Dashboard signups bypass this entirely.
3. **There's an existing backlog** of hundreds (possibly thousands) of unscored Dashboard signups in `#dashboard-signups` (Slack channel `C01Q21S292A`).
4. An **Auth0 → HubSpot sync** already creates contacts from Dashboard signups, but it only syncs identity data — no scoring, no enrichment, no routing, no Slack alert.

## Discovery: Slack Channel Format

The channel has two message types:

**1. DashBot signup notifications** (`bot_id: B03QZ1E1T8X`):
```
[From Action] New User: MIGUEL BREWER <mailto:miguel.b@liberty1lending.com|miguel.b@liberty1lending.com>. Invite details below ↓.
[From Action] New User: Reyna Hernandez <mailto:reyna.hernandez@associatedbank.com|reyna.hernandez@associatedbank.com>. Website form submitted for company: Associated Bank.
```

**Parsing regex:** `New User: (.+?) <mailto:(.+?)\|` → name + email. Optional company: `company: (.+?)\.`

**2. Auth0 → HubSpot Sync Reports** (`bot_id: B092WJJRSKZ`, username: "Pipedream"):
```
[Auth0 → HubSpot Sync Report] Auth0 Users Found: 2, Upsert Attempted: 1, New Contacts Created: 0, Existing Contacts Updated: 1
```
→ **Ignore these.** Filter by `bot_id == 'B03QZ1E1T8X'` only.

## Proposed Solution

### Architecture

```
// Pipeline C — Real-time
DashBot posts to #dashboard-signups
  → Pipedream Slack trigger (filter: bot_id = B03QZ1E1T8X)
  → Parse name + email + company from message text
  → POST to Scout API: /webhook/dashboard-signup
  → Scout: find-or-create in HubSpot
  → Skip if excluded lifecycle stage or recently scored
  → Score (deterministic + Apollo + Gemini) with DASHBOARD_SIGNUP_WEIGHTS
  → HubSpot write-back (set scout_source = dashboard_signup)
  → Slack #outreach-intelligence (if hot/enterprise)

// Pipeline C — Backlog batch
CLI: python -m truv_scout.cli score-dashboard-backlog --limit 200
  → Paginate Slack conversations.history (bot_id filter)
  → For each: parse → find-or-create → skip guards → score → write-back
  → Post summary digest to #outreach-intelligence
```

### Key Design Decisions

1. **Pipedream Slack source trigger** — consistent with existing Pipeline A/B Pipedream patterns
2. **New Scout endpoint `/webhook/dashboard-signup`** — separate from `/webhook` so we can apply dashboard-specific logic (scoring weights, lifecycle guards, `scout_source`)
3. **`DASHBOARD_SIGNUP_WEIGHTS`** — new scoring weight config that adds a `product_intent` dimension (30% weight, base score 70) since these contacts demonstrated the highest-intent signal: they actually signed up and used the product
4. **`scout_source` HubSpot property** — new property to distinguish Pipeline A/B/C scores (`form_submission`, `closed_lost_reengagement`, `dashboard_signup`)
5. **Lifecycle stage guard** — skip scoring for: `opportunity`, `customer`, `Live Customer`, `Indirect Customer`, `Advocate`, `Disqualified` (same exclusion list as outreach_intel)
6. **Cooldown** — skip if `scout_scored_at` < 7 days ago (prevents triple-scoring across pipelines)
7. **Personal email handling** — score them but apply a personal-email flag so they don't trigger Slack alerts; still useful in HubSpot for bulk nurture

## Technical Approach

### Phase 1: Foundation (Scout API changes)

#### 1a. New HubSpot property: `scout_source`

- Type: Enumeration
- Options: `form_submission`, `closed_lost_reengagement`, `dashboard_signup`
- Create via HubSpot API

#### 1b. Add `create_contact` to HubSpotClient

```python
# outreach_intel/hubspot_client.py
def create_contact(self, properties: dict) -> dict:
    """Create a new HubSpot contact. Returns the contact dict.
    Handles 409 Conflict by falling back to get_contact_by_email."""
```

Handle 409 Conflict (email already exists) by catching and falling back to lookup.

#### 1c. `find_or_create_contact` helper

```python
# truv-scout/truv_scout/dashboard.py
def find_or_create_contact(email: str, first_name: str = "", last_name: str = "", company: str = "") -> dict:
    """Look up email in HubSpot. Create if not found. Return contact dict."""
```

Logic:
1. `client.get_contact_by_email(email)` → if found, return it
2. If not found, `client.create_contact({email, firstname, lastname, company, lifecyclestage: "lead", lead_source: "dashboard_signup"})`
3. Handle 409 race condition (created between lookup and create) → retry lookup

#### 1d. Dashboard-specific scoring weights

```python
# truv-scout/truv_scout/scorer.py (or config)
DASHBOARD_SIGNUP_WEIGHTS = {
    "product_intent": 0.30,   # NEW: they signed up and used the product
    "form_fit": 0.15,         # reduced (no form data)
    "engagement": 0.10,       # reduced (may have no email history)
    "timing": 0.05,           # reduced
    "deal_context": 0.15,     # existing deals matter
    "external_trigger": 0.25, # Apollo enrichment is critical here
}
```

The `product_intent` dimension gives Dashboard signups a base score of **70/100** for this dimension alone — reflecting that product usage is the strongest intent signal. This prevents the "everything scores cold" problem identified in the spec analysis.

#### 1e. Update `hubspot_writer.py`

Add `scout_source` to the properties written:

```python
properties["scout_source"] = source  # "form_submission" | "closed_lost_reengagement" | "dashboard_signup"
```

### Phase 2: New Endpoint + Processing Logic

#### 2a. New Pydantic model

```python
# truv-scout/truv_scout/models.py
class DashboardSignupPayload(BaseModel):
    email: str
    full_name: str = ""
    company: str = ""
    slack_ts: str = ""  # for dedup
    event_type: str = "dashboard_signup"
```

#### 2b. New endpoint: `POST /webhook/dashboard-signup`

```python
# truv-scout/truv_scout/app.py
@app.post("/webhook/dashboard-signup")
async def webhook_dashboard_signup(payload: DashboardSignupPayload, background_tasks: BackgroundTasks, ...):
    # Auth via x-scout-token (same as existing)
    background_tasks.add_task(_process_dashboard_signup, payload)
    return {"status": "accepted", "email": payload.email}
```

#### 2c. Background processing function

```python
# truv-scout/truv_scout/dashboard.py
async def _process_dashboard_signup(payload: DashboardSignupPayload):
    # 1. Find or create contact
    contact = find_or_create_contact(email, first_name, last_name, company)
    contact_id = contact["id"]

    # 2. Lifecycle guard — skip excluded stages
    stage = contact.get("properties", {}).get("lifecyclestage", "")
    if stage in EXCLUDED_STAGES:
        print(f"[dashboard] Skipping {email} — lifecycle stage: {stage}")
        return

    # 3. Cooldown guard — skip if scored within 7 days
    scored_at = contact.get("properties", {}).get("scout_scored_at")
    if scored_at and (now - parse(scored_at)).days < 7:
        print(f"[dashboard] Skipping {email} — scored {scored_at}")
        return

    # 4. Run pipeline with dashboard-specific weights
    result = run_pipeline(contact_id=contact_id, scoring_weights="dashboard_signup")

    # 5. Write back with source tag
    write_scores_to_hubspot(result, source="dashboard_signup")

    # 6. Slack notify (hot/enterprise only, with "Dashboard Signup" badge)
    if result.final_tier == "hot" or result.final_routing == "enterprise":
        notify_slack(result, source="Dashboard Signup")
```

### Phase 3: Pipedream Workflow (Real-time Trigger)

New workflow in **GTM Automation** project:

**Trigger:** Pipedream Slack source → "New Message in Channel" → channel `C01Q21S292A`

**Step 1: Filter + Parse** (Node.js code step)
```javascript
// Filter: only DashBot messages
if (steps.trigger.event.bot_id !== "B03QZ1E1T8X") {
  $.flow.exit("Not a DashBot message — skipping");
}

// Parse: extract name, email, company
const text = steps.trigger.event.text;
const nameEmailMatch = text.match(/New User: (.+?) <mailto:(.+?)\|/);
if (!nameEmailMatch) {
  $.flow.exit("Could not parse signup message");
}

const companyMatch = text.match(/company: (.+?)\./);

return {
  full_name: nameEmailMatch[1].trim(),
  email: nameEmailMatch[2].trim(),
  company: companyMatch ? companyMatch[1].trim() : "",
  slack_ts: steps.trigger.event.ts,
};
```

**Step 2: Relay to Scout** (Node.js code step)
```javascript
const response = await axios($, {
  method: "POST",
  url: "https://8svutjrjpz.us-east-1.awsapprunner.com/webhook/dashboard-signup",
  headers: {
    "Content-Type": "application/json",
    "x-scout-token": process.env.SCOUT_WEBHOOK_SECRET,
  },
  data: steps.parse_message.$return_value,
});
```

### Phase 4: Backlog Batch Processing

#### 4a. New CLI command: `score-dashboard-backlog`

```python
# truv-scout/truv_scout/cli.py
@app.command(name="score-dashboard-backlog")
def score_dashboard_backlog(
    limit: int = typer.Option(200, "--limit", "-n"),
    dry_run: bool = typer.Option(False, "--dry-run"),
    oldest: str = typer.Option("", "--oldest", help="Oldest Slack message ts to start from"),
):
    """Batch score historical Dashboard signups from #dashboard-signups Slack channel."""
```

#### 4b. Slack history paginator

```python
# truv-scout/truv_scout/dashboard.py
def get_dashboard_signups_from_slack(limit: int = 200, oldest: str = "") -> list[dict]:
    """Paginate Slack conversations.history for DashBot messages in C01Q21S292A.
    Filter by bot_id B03QZ1E1T8X, parse each message, return list of {email, full_name, company, slack_ts}."""
```

Uses `SLACK_BOT_TOKEN` env var, cursor-based pagination, rate limit awareness.

#### 4c. Batch processing with checkpoint

```python
def run_dashboard_backlog_batch(limit: int = 200, dry_run: bool = False) -> list[PipelineResult]:
    signups = get_dashboard_signups_from_slack(limit=limit)
    results = []
    for signup in signups:
        # Same guards as real-time: lifecycle, cooldown, personal email
        # Score, write, collect results
    return results
```

#### 4d. New API endpoint: `POST /score-batch/dashboard-signups`

Same pattern as `/score-batch/closed-lost` — background task, Slack digest at the end.

### Phase 5: Scoring Model Update

Modify `run_pipeline()` in `pipeline.py` to accept an optional `scoring_weights` parameter:

```python
def run_pipeline(contact_id=None, email=None, ..., scoring_weights: str = "default"):
    # If scoring_weights == "dashboard_signup":
    #   Use DASHBOARD_SIGNUP_WEIGHTS with product_intent dimension
    #   Set product_intent_score = 70 (base) for all Dashboard signups
```

This avoids the critical problem where every Dashboard signup scores ~29.5 (cold) because the deterministic scorer has no signal for "product usage."

## Acceptance Criteria

- [x] DashBot message in `#dashboard-signups` triggers real-time scoring within 60 seconds
- [x] New contacts are created in HubSpot with `lifecyclestage=lead` and `lead_source=dashboard_signup`
- [x] Existing contacts are scored without overwriting protected lifecycle stages
- [x] `scout_source` property is set to `dashboard_signup` on all Pipeline C scores
- [x] Contacts scored within last 7 days are skipped (cooldown)
- [x] Personal emails (gmail, yahoo, etc.) are scored but do not trigger Slack alerts
- [x] Auth0 sync reports (bot_id `B092WJJRSKZ`) are ignored
- [x] CLI `score-dashboard-backlog --dry-run --limit 10` processes historical signups correctly
- [x] Hot/enterprise contacts post to `#outreach-intelligence` with "Source: Dashboard Signup" badge
- [x] Score breakdown reflects `product_intent` dimension at 30% weight (+25 pt bonus)
- [x] Pipedream workflow created and merged to production
- [x] App Runner redeployed with new endpoints
- [x] `scout_source` HubSpot property created

## Dependencies & Risks

| Dependency | Risk | Mitigation |
|---|---|---|
| Slack API access for channel history | Need `channels:history` scope on bot token | Verify existing token scopes |
| DashBot message format stability | Product team could change the format | Parser includes format validation + alerts on failure |
| Apollo rate limits during backlog batch | 50+ contacts/run could hit limits | Batch at 50, sleep between, graceful degradation |
| Auth0 → HubSpot sync race condition | Contact may not exist yet when Pipeline C fires | `find_or_create` with 409 handling + optional delay |
| HubSpot API rate limits | 100 req/10s for private apps | Backlog batch includes rate limiting |

## New Files

| File | Purpose |
|---|---|
| `truv-scout/truv_scout/dashboard.py` | find_or_create_contact, process_dashboard_signup, backlog batch, Slack history paginator |
| `truv-scout/truv_scout/config/dashboard_weights.py` | DASHBOARD_SIGNUP_WEIGHTS + product_intent scoring |

## Modified Files

| File | Change |
|---|---|
| `truv-scout/truv_scout/app.py` | Add `/webhook/dashboard-signup` and `/score-batch/dashboard-signups` endpoints |
| `truv-scout/truv_scout/models.py` | Add `DashboardSignupPayload` model |
| `truv-scout/truv_scout/cli.py` | Add `score-dashboard-backlog` command |
| `truv-scout/truv_scout/hubspot_writer.py` | Add `scout_source` to written properties |
| `truv-scout/truv_scout/slack.py` | Add `source` parameter to `notify_slack()` for badge display |
| `truv-scout/truv_scout/pipeline.py` | Accept `scoring_weights` parameter |
| `truv-scout/truv_scout/settings.py` | Add `SLACK_BOT_TOKEN` env var |
| `outreach_intel/hubspot_client.py` | Add `create_contact()` method |

## Success Metrics

- **Backlog cleared:** 100% of historical Dashboard signups scored within first week
- **Real-time latency:** New signups scored within 60 seconds of DashBot notification
- **Coverage:** 0 new Dashboard signups go unscored after launch
- **Discovery rate:** % of Dashboard signups that score hot or warm (target: 15-25%)
- **Pipeline source visibility:** All scored contacts have `scout_source` populated

## References

- Pipeline A (Inbound): `truv-scout/truv_scout/app.py:67-76`, Pipedream "Inbound Lead Scoring Pipeline"
- Pipeline B (Closed-Lost): `truv-scout/truv_scout/batch.py`, Pipedream "Closed-Lost Digest — Scout Weekly Cron"
- HubSpot writer: `truv-scout/truv_scout/hubspot_writer.py`
- Scorer weights: `truv-scout/truv_scout/scorer.py` (INBOUND_WEIGHTS, DEFAULT_WEIGHTS)
- Slack channel: `C01Q21S292A` (#dashboard-signups)
- DashBot ID: `B03QZ1E1T8X`
- Auth0 sync bot ID: `B092WJJRSKZ` (ignore)
- Outreach Intel exclusion list: CLAUDE.md — opportunity, customer, Live Customer, Indirect Customer, Advocate, Disqualified
- Two-lane architecture: `docs/plans/2026-02-10-email-stack-design.md`
- Scout Obsidian hub: `/Obsidian Vault/Projects/Truv Scout — Hub.md`
