---
title: "feat: Truv Scout Activation — Deploy, Wire Inbound Pipeline, and Closed-Lost Digest"
type: feat
status: active
date: 2026-03-18
brainstorm: docs/brainstorms/2026-03-18-truv-scout-activation-brainstorm.md
---

# feat: Truv Scout Activation

## Overview

Truv Scout is ~95% built — 4-layer scoring pipeline, 42 passing tests, CLI, FastAPI app. This plan activates it end-to-end across two automated pipelines:

- **Pipeline A:** Every dashboard signup is auto-scored in real time. Enterprise-routing contacts and hot leads get a Slack alert to `#outreach-intelligence`.
- **Pipeline B:** Every Monday, stale closed-lost contacts (deal closed >90 days, no active sequence) are batch-scored and surfaced as a Slack digest for cherry-picking.

**Architecture decision:** Pipedream → Scout FastAPI relay. Pipedream handles the HubSpot trigger; Scout handles all scoring logic in Python.

---

## Prerequisites (Do Before Starting)

- [ ] **Identify dashboard signup form ID(s)** in HubSpot — needed to scope the workflow trigger to avoid scoring NPS/webinar submissions (Cameron to look up)
- [ ] **Verify 7 HubSpot contact properties exist** — list is in Phase 2; create any missing ones before first deploy
- [ ] Confirm AWS account access, ECR permissions, and App Runner permissions are set up
- [x] Create requirements.txt, Dockerfile, apprunner.yaml
- [x] Update app.py (auth, background task, write-back, Slack gate, /score-batch/closed-lost)
- [x] Update settings.py (webhook_secret)
- [x] Update hubspot_writer.py (error logging)
- [x] Create batch.py (closed-lost batch scoring)
- [x] Update slack.py (post_closed_lost_digest)
- [x] Update cli.py (score-closed-lost command)
- [x] All 43 tests passing

---

## Phase 1: Package & Deploy Scout API on Railway

The FastAPI service needs a `requirements.txt`, `Dockerfile`, and ECR/App Runner config before it can receive webhooks.

### 1.1 — Create `requirements.txt`

**File:** `truv-scout/requirements.txt`

```txt
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
pydantic>=2.7.0
pydantic-settings>=2.3.0
agno>=1.0.0
google-generativeai>=0.7.0
typer>=0.12.0
requests>=2.31.0
httpx>=0.27.0
python-dotenv>=1.0.0
```

### 1.2 — Create `Dockerfile`

**File:** `truv-scout/Dockerfile`

Critical constraint: `truv_scout` imports from `outreach_intel` (sibling package). The build context must be the repo root so both packages are available. Railway will be configured to use this Dockerfile with the root as build context.

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copy both packages — outreach_intel is a shared dependency
COPY outreach_intel/ ./outreach_intel/
COPY truv-scout/requirements.txt ./truv-scout/requirements.txt

RUN pip install --no-cache-dir -r truv-scout/requirements.txt

COPY truv-scout/truv_scout/ ./truv-scout/truv_scout/

# Make outreach_intel importable as a sibling package
ENV PYTHONPATH=/app

WORKDIR /app/truv-scout

CMD ["sh", "-c", "uvicorn truv_scout.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

### 1.3 — Create `apprunner.yaml`

App Runner can deploy from an ECR image (image-based) or directly from source (source-based). Because our Dockerfile requires the repo root as build context (to copy the sibling `outreach_intel` package), **use the image-based approach**: build and push to ECR, then configure App Runner to pull from ECR.

**Deploy flow:**

```
Build Docker image (repo root context)
  → Tag and push to ECR
  → App Runner pulls from ECR on deploy
```

**`apprunner.yaml`** — place at repo root for reference, but App Runner service is configured in AWS console for image-based deploys:

```yaml
# apprunner.yaml (informational — actual config lives in AWS App Runner service settings)
version: 1.0
runtime: DOCKER
port: 8000
build:
  commands:
    build:
      - echo "Image-based deploy — see ECR push steps in 1.6"
run:
  env:
    - name: ENVIRONMENT
      value: production
  command: uvicorn truv_scout.app:app --host 0.0.0.0 --port 8000
```

**App Runner service settings (configure in AWS console):**
- **Image URI:** `<account-id>.dkr.ecr.<region>.amazonaws.com/truv-scout:latest`
- **Port:** `8000`
- **Health check path:** `/health`
- **CPU:** 0.25 vCPU | **Memory:** 0.5 GB (sufficient for scoring workload)
- **Auto-scaling:** Min 1, Max 3 instances

### 1.4 — Add Webhook Auth + Background Task to `/webhook`

**File:** `truv-scout/truv_scout/app.py`

Two fixes needed:
1. The current `/webhook` handler does not call `write_scores_to_hubspot()` or `notify_slack()` — wire those in
2. The pipeline is synchronous and will block the event loop under concurrent requests — offload to a background task

```python
# app.py additions

from fastapi import BackgroundTasks, Header
from typing import Optional
from truv_scout.hubspot_writer import write_scores_to_hubspot
from truv_scout.slack import notify_slack

@app.post("/webhook")
async def webhook(
    payload: WebhookPayload,
    background_tasks: BackgroundTasks,
    x_scout_token: Optional[str] = Header(None),
):
    # Optional shared secret auth (set SCOUT_WEBHOOK_SECRET in App Runner env)
    secret = settings.webhook_secret  # add to settings.py
    if secret and x_scout_token != secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    background_tasks.add_task(_process_webhook, payload)
    return {"status": "accepted", "contact_id": payload.contact_id}


async def _process_webhook(payload: WebhookPayload):
    result = run_pipeline(
        contact_id=payload.contact_id,
        event_type=payload.event_type,
        properties=payload.properties,
    )
    write_scores_to_hubspot(result)

    # Slack alert only for hot tier or enterprise routing
    if result.tier == "hot" or result.routing == "enterprise":
        notify_slack(result)
```

Also add `webhook_secret: Optional[str] = None` to `truv_scout/settings.py`.

### 1.5 — Add Error Logging to `hubspot_writer.py`

The current `except Exception` block silently returns `False` with no logging. Add a log line so failed writes are visible in App Runner logs (CloudWatch).

**File:** `truv-scout/truv_scout/hubspot_writer.py`

```python
except Exception as e:
    print(f"[hubspot_writer] Failed to write scores for {result.contact_id}: {e}")
    return False
```

### 1.6 — Build, Push to ECR, and Deploy via App Runner

```bash
# 1. Authenticate Docker with ECR
aws ecr get-login-password --region <region> | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

# 2. Create ECR repo (one-time)
aws ecr create-repository --repository-name truv-scout --region <region>

# 3. Build from repo root (required — Dockerfile copies sibling outreach_intel package)
docker build -f truv-scout/Dockerfile -t truv-scout .

# 4. Tag and push
docker tag truv-scout:latest <account-id>.dkr.ecr.<region>.amazonaws.com/truv-scout:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/truv-scout:latest
```

**In AWS console → App Runner → Create service:**
1. Source: Container registry → Amazon ECR → `truv-scout:latest`
2. Deployment trigger: Manual (or automatic on new ECR push)
3. Port: `8000`
4. Health check: `GET /health`
5. Environment variables — add all of these:
   - `HUBSPOT_API_TOKEN`
   - `APOLLO_API_KEY`
   - `GOOGLE_API_KEY`
   - `SLACK_WEBHOOK_URL`
   - `FIRECRAWL_API_KEY`
   - `SCOUT_WEBHOOK_SECRET` (generate a random string — save it, set same value in Pipedream)
   - `ENVIRONMENT=production`
6. CPU: 0.25 vCPU / Memory: 0.5 GB
7. Deploy and note the App Runner service URL (e.g., `https://abc123.us-east-1.awsapprunner.com`)

**Acceptance criteria:**
- [ ] `GET https://<apprunner-url>/health` returns 200
- [ ] CloudWatch logs show startup without import errors
- [ ] `POST /webhook` with a test payload returns `{"status": "accepted"}`

---

## Phase 2: Wire Pipeline A — Inbound Lead Scoring

### 2.1 — Verify/Create HubSpot Contact Properties

These 7 properties must exist in HubSpot before the first live score is written. Check the HubSpot property settings and create any missing ones.

| Property Name | Type | Description |
|---|---|---|
| `inbound_lead_tier` | Enumeration | hot / warm / cold |
| `form_fit_score` | Number | 0–100 form fit score |
| `lead_routing` | Enumeration | enterprise / self-service / government / not-a-lead |
| `scout_reasoning` | Multi-line text | AI reasoning (max 1000 chars) |
| `scout_confidence` | Enumeration | high / medium / low |
| `scout_scored_at` | Date | ISO timestamp of last score |
| `scout_tech_stack_matches` | Single-line text | Matched LOS/POS/VOI providers (max 500 chars) |

**CLI verification command** (run after Railway is up):
```bash
python -m truv_scout.cli score <test_contact_id> --dry-run
```

### 2.2 — Create Pipedream Inbound Workflow

**Project:** GTM Automation
**Workflow name:** `inbound-lead-scout-scoring`

**Step 1 — Trigger:** HTTP webhook (Pipedream-managed URL)
- No code needed — Pipedream generates the URL

**Step 2 — relay_to_scout:** POST contact_id to Scout API

```javascript
import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const payload = steps.trigger.event.body || steps.trigger.event;
    const contactId = payload.objectId || payload.contactId;

    if (!contactId) {
      $.flow.exit("No contactId in webhook payload — skipping");
    }

    const response = await axios($, {
      method: "POST",
      url: `${process.env.SCOUT_API_URL}/webhook`,
      headers: {
        "Content-Type": "application/json",
        "x-scout-token": process.env.SCOUT_WEBHOOK_SECRET,
      },
      data: {
        contact_id: String(contactId),
        event_type: "form_submission",
        properties: payload.properties || {},
      },
    });

    return { status: response.status, contact_id: contactId };
  },
});
```

**Pipedream environment variables to set:**
- `SCOUT_API_URL` = App Runner service URL (e.g., `https://abc123.us-east-1.awsapprunner.com`)
- `SCOUT_WEBHOOK_SECRET` = same value set in App Runner env

### 2.3 — Create HubSpot Workflow Trigger

In HubSpot Workflows, create a new workflow:

- **Trigger:** Contact enrolled when `[Dashboard signup form ID]` is submitted
- **Re-enrollment:** Enable — so repeat form submissions get re-scored
- **Action:** Send webhook → Pipedream inbound workflow URL
  - Method: POST
  - Payload: `{"objectId": "{{contact.id}}", "portalId": 19933594}`

> ⚠️ **Prerequisite:** Cameron to confirm the specific form ID(s) before creating this workflow. Only include the dashboard signup form — do NOT include NPS, webinar, or contact forms.

### 2.4 — Test Pipeline A End-to-End

1. Submit a test form submission for a known contact
2. Watch App Runner / CloudWatch logs for the pipeline run
3. Verify in HubSpot: all 7 properties updated on the contact
4. Verify in `#outreach-intelligence`: Slack alert fires if tier=hot or routing=enterprise

**Acceptance criteria:**
- [ ] Test contact's `inbound_lead_tier` is populated in HubSpot
- [ ] `scout_scored_at` timestamp is current
- [ ] Slack alert fires for a known hot/enterprise test case
- [ ] No Slack alert fires for a self-service/cold test case
- [ ] CloudWatch logs show no errors

---

## Phase 3: Wire Pipeline B — Closed-Lost Re-engagement

### 3.1 — Add Batch Closed-Lost Scoring to Scout CLI

Add a new CLI command `score-closed-lost` and a new API endpoint `POST /score-batch/closed-lost`.

**Query definition:**
- `lifecyclestage = "268636563"` (closed-lost stage ID, from `outreach_intel/service.py:74`)
- `outreach_status` ≠ `"active"` (not currently in a cold outreach sequence)
- Deal close age: filter programmatically — fetch contacts, then check associated deals for `closedate < 90 days ago`

> **Note on deal age filter:** HubSpot contact records don't store deal closedate directly. After fetching closed-lost contacts, use `HubSpotClient.get_deals_for_contact(contact_id)` to pull associated deals and filter for `closedate < now - 90 days`. This adds ~1 API call per contact; batch at most 50 contacts per run to stay within HubSpot rate limits.

**New file:** `truv-scout/truv_scout/batch.py`

```python
# batch.py — Closed-lost batch scoring

from datetime import datetime, timedelta
from truv_scout.pipeline import run_pipeline
from truv_scout.hubspot_writer import write_scores_to_hubspot
from truv_scout.slack import post_closed_lost_digest
from outreach_intel.hubspot_client import HubSpotClient

CLOSED_LOST_STAGE = "268636563"
STALE_DAYS = 90


def get_stale_closed_lost_contacts(limit: int = 50) -> list[dict]:
    """Fetch closed-lost contacts with no active outreach and stale deal close date."""
    client = HubSpotClient()
    filters = [
        {"propertyName": "lifecyclestage", "operator": "EQ", "value": CLOSED_LOST_STAGE},
        {"propertyName": "outreach_status", "operator": "NEQ", "value": "active"},
    ]
    contacts = client.search_contacts(filters=filters, limit=limit * 2)  # overfetch for deal filter

    stale_cutoff = datetime.now() - timedelta(days=STALE_DAYS)
    stale = []
    for contact in contacts:
        deals = client.get_deals_for_contact(contact["id"])
        if not deals:
            stale.append(contact)
            continue
        latest_close = max(
            (d.get("properties", {}).get("closedate") for d in deals if d.get("properties", {}).get("closedate")),
            default=None,
        )
        if latest_close and datetime.fromisoformat(latest_close[:10]) < stale_cutoff:
            stale.append(contact)
        if len(stale) >= limit:
            break

    return stale[:limit]


def run_closed_lost_batch(limit: int = 50, dry_run: bool = False) -> list[dict]:
    """Score all stale closed-lost contacts and write results back to HubSpot."""
    contacts = get_stale_closed_lost_contacts(limit=limit)
    results = []

    for contact in contacts:
        result = run_pipeline(contact_id=contact["id"])
        if not dry_run:
            write_scores_to_hubspot(result)
        results.append(result)

    return results
```

**New CLI command** in `truv-scout/truv_scout/cli.py`:

```python
@app.command()
def score_closed_lost(
    limit: int = typer.Option(50, help="Max contacts to score"),
    dry_run: bool = typer.Option(False, help="Score but don't write to HubSpot"),
):
    """Batch score stale closed-lost contacts and post Slack digest."""
    results = run_closed_lost_batch(limit=limit, dry_run=dry_run)
    post_closed_lost_digest(results)  # defined in slack.py
    typer.echo(f"Scored {len(results)} contacts.")
```

**New API endpoint** in `truv-scout/truv_scout/app.py`:

```python
@app.post("/score-batch/closed-lost")
async def score_closed_lost_batch(
    background_tasks: BackgroundTasks,
    limit: int = 50,
    x_scout_token: Optional[str] = Header(None),
):
    secret = settings.webhook_secret
    if secret and x_scout_token != secret:
        raise HTTPException(status_code=401)

    background_tasks.add_task(_run_closed_lost_batch, limit)
    return {"status": "accepted", "limit": limit}


async def _run_closed_lost_batch(limit: int):
    from truv_scout.batch import run_closed_lost_batch
    from truv_scout.slack import post_closed_lost_digest
    results = run_closed_lost_batch(limit=limit)
    post_closed_lost_digest(results)
```

### 3.2 — Build Closed-Lost Slack Digest

Add `post_closed_lost_digest()` to `truv-scout/truv_scout/slack.py`.

**Digest format** (one message, top 20 by total score):

```
🔍 Closed-Lost Re-engagement Digest — Mon Mar 18
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Scored 47 contacts. Top 15 worth a look:

1. 🔥 Jane Smith — Own.lease — Score: 82 — Enterprise — Encompass/Argyle
   📎 hubspot.com/contacts/12345
2. ♨️ Rick P — TitleMax — Score: 71 — Enterprise — Blend/Truework
   📎 hubspot.com/contacts/67890
...

To enroll a contact: python -m outreach_intel.smartlead_uploader upload --contact-id <ID>
```

Fields per contact:
- Tier emoji (🔥 hot, ♨️ warm)
- Name, company
- Total score
- Routing
- Tech stack matches
- Direct HubSpot contact URL: `https://app.hubspot.com/contacts/19933594/contact/{contact_id}`

Filter: Only include `tier=hot` or `tier=warm`. Do not include cold contacts in the digest.

### 3.3 — Create Pipedream Cron Workflow

**Project:** GTM Automation
**Workflow name:** `scout-closed-lost-weekly-digest`

**Step 1 — Trigger:** Schedule
- Cron: `0 13 * * 1` (Monday 8:00 AM CDT = 13:00 UTC — current DST schedule)
- Note: adjust to `0 14 * * 1` when standard time resumes in November

**Step 2 — trigger_closed_lost_batch:**

```javascript
import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const response = await axios($, {
      method: "POST",
      url: `${process.env.SCOUT_API_URL}/score-batch/closed-lost?limit=50`,
      headers: {
        "Content-Type": "application/json",
        "x-scout-token": process.env.SCOUT_WEBHOOK_SECRET,
      },
      data: {},
    });

    return { status: response.status, accepted: response.data };
  },
});
```

**Acceptance criteria:**
- [ ] Monday cron fires and Scout logs show batch run starting
- [ ] HubSpot properties updated for scored contacts
- [ ] Slack digest posted to `#outreach-intelligence` with top contacts
- [ ] Only hot/warm contacts appear in digest (cold filtered out)
- [ ] Contacts with `outreach_status = "active"` are excluded from batch

---

## HubSpot Properties to Verify/Create

Before Phase 2 goes live, verify these exist at `app.hubspot.com/property-settings/19933594/contact`:

| Property | Internal Name | Type | Options |
|---|---|---|---|
| Inbound Lead Tier | `inbound_lead_tier` | Dropdown | hot, warm, cold |
| Form Fit Score | `form_fit_score` | Number | — |
| Lead Routing | `lead_routing` | Dropdown | enterprise, self-service, government, not-a-lead |
| Scout Reasoning | `scout_reasoning` | Multi-line text | — |
| Scout Confidence | `scout_confidence` | Dropdown | high, medium, low |
| Scout Scored At | `scout_scored_at` | Date | — |
| Scout Tech Stack Matches | `scout_tech_stack_matches` | Single-line text | — |

---

## Key Files Modified / Created

| File | Action | Description |
|---|---|---|
| `truv-scout/requirements.txt` | **Create** | Python deps for App Runner container |
| `truv-scout/Dockerfile` | **Create** | Copies `outreach_intel` + `truv_scout`, starts uvicorn |
| `apprunner.yaml` | **Create** | App Runner reference config (repo root) |
| `truv-scout/truv_scout/app.py` | **Edit** | Add auth, background task, write-back, Slack gate to `/webhook`; add `/score-batch/closed-lost` |
| `truv-scout/truv_scout/settings.py` | **Edit** | Add optional `webhook_secret` field |
| `truv-scout/truv_scout/hubspot_writer.py` | **Edit** | Add error logging on write failure |
| `truv-scout/truv_scout/batch.py` | **Create** | Closed-lost batch query + scoring loop |
| `truv-scout/truv_scout/slack.py` | **Edit** | Add `post_closed_lost_digest()` |
| `truv-scout/truv_scout/cli.py` | **Edit** | Add `score-closed-lost` command |

---

## Acceptance Criteria

### Phase 1 — Deploy
- [ ] `GET /health` returns 200 on Railway
- [ ] `POST /webhook` with valid token returns `{"status": "accepted"}`
- [ ] `POST /webhook` with missing/wrong token returns 401
- [ ] CloudWatch logs show clean startup (no import errors for `outreach_intel`)

### Phase 2 — Inbound Pipeline
- [ ] Dashboard signup form submission triggers HubSpot Workflow
- [ ] Workflow fires Pipedream webhook within 30 seconds of submission
- [ ] Scout scores the contact and writes all 7 HubSpot properties
- [ ] Slack alert fires in `#outreach-intelligence` for hot/enterprise contacts
- [ ] No Slack alert for cold/self-service contacts
- [ ] NPS/webinar form submissions do NOT trigger scoring

### Phase 3 — Closed-Lost Digest
- [ ] Monday 8am cron fires the batch
- [ ] Contacts with `outreach_status=active` are excluded
- [ ] Only contacts with deal closed >90 days ago are included
- [ ] HubSpot properties updated for all scored contacts
- [ ] Slack digest posted with hot/warm contacts only, each with HubSpot URL
- [ ] Manual CLI enrollment command works: `python -m truv_scout.cli score-closed-lost --dry-run`

---

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| `outreach_intel` import fails in App Runner container | Dockerfile copies both packages from repo root context; `PYTHONPATH=/app` ensures resolution |
| Apollo credits drain on Monday batch (50 contacts = ~150 credits) | Default `--limit 50`; Pipeline B uses full enrichment — ~$1.50/run at current Apollo pricing |
| HubSpot properties don't exist yet | Phase 2 prerequisite: verify/create all 7 before first deploy |
| Dashboard signup form ID unknown | Cameron to identify before creating HubSpot Workflow |
| Scout API takes >30s for complex leads | Background task in `/webhook` returns 202 immediately; Pipedream doesn't time out; App Runner default request timeout is 120s |

---

## Open Questions (Post-Activation)

1. **Knock enrollment:** Which Knock workflows should hot/enterprise contacts be enrolled in after scoring? (defer until Pipeline A is validated)
2. **Re-score frequency:** Should contacts that scored in the last 30 days be skipped in the Monday batch to avoid churn?
3. **Smartlead campaign ID for closed-lost outreach:** Which campaign ID does the CLI enrollment point to?
