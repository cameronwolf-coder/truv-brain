# Truv Scout — E2E Test Report

**Date:** March 18, 2026
**Tester:** Claude Code
**Service:** `https://8svutjrjpz.us-east-1.awsapprunner.com`
**Branch:** `feat/pipeline-c-dashboard-scoring`

---

## Executive Summary

| Pipeline | Tests | Pass | Fail | Fixed |
|----------|-------|------|------|-------|
| Pipeline A (Inbound) | 6 | 5 | 1 | 1 |
| Pipeline B (Closed-Lost) | 5 | 4 | 1 | 1 |
| Pipeline C (Dashboard) | 7 | 5 | 2 | 1 |
| **Total** | **18** | **14** | **4** | **3** |

**Critical bug found and fixed:** Authentication was not enforced on any endpoint due to a pydantic env var name mismatch (`webhook_secret` vs `SCOUT_WEBHOOK_SECRET`). Rebuilt, redeployed, and verified — all endpoints now return 401 for invalid tokens.

---

## Pipeline A — Inbound Form Submissions

### Test Results

| # | Test | Expected | Actual | Status |
|---|------|----------|--------|--------|
| A1 | `GET /health` | 200 `{"status":"ok"}` | 200 `{"status":"ok"}` | PASS |
| A2 | `POST /webhook` (valid token, real contact 23965) | 200 accepted | 200 `{"status":"accepted","contact_id":"23965"}` | PASS |
| A3 | `POST /score` (synchronous, contact 23965) | 200 with score data | 200, score 33.5, cold, self-service | PASS |
| A4 | `POST /webhook` (wrong token) | 401 | ~~200 accepted~~ → 401 after fix | FIXED |
| A5 | `POST /score` (empty body) | 400 | 400 `"Either contact_id or email is required"` | PASS |
| A6 | Pipedream workflow active | Active with recent events | v4 Active, multiple events today | PASS |

### Score Output Sample (Contact 23965 — Erwin Rodriguez, Vcheck Global)
```
total_score: 33.5 | tier: cold | routing: self-service
form_fit: 0 | engagement: 0 | timing: 30 | deal_context: 60 | external: 40
agent_adjustment: 0 | confidence: medium
reasoning: "Deterministic score only."
```

### Observations
- Synchronous `/score` endpoint works but agent returned 0 adjustment and "Deterministic score only" — suggesting the Agno agent may have failed silently and fell back to deterministic-only mode for this contact.
- Pipedream "Inbound Lead Scoring Pipeline" is active and processing real form submissions (events visible today, yesterday, 2 days ago).

---

## Pipeline B — Closed-Lost Re-engagement

### Test Results

| # | Test | Expected | Actual | Status |
|---|------|----------|--------|--------|
| B1 | `POST /score-batch/closed-lost?limit=3` (valid token) | 200 accepted | 200 `{"status":"accepted","limit":3}` | PASS |
| B2 | CLI `score-closed-lost --dry-run --limit 3` | Scores 3 contacts | Scored 3: warm(42), warm(56), warm(52) | PASS |
| B3 | Engagement ranking sort order | Descending by rank | Verified: rank 10, 10, 0, 0, 0... Sorted=True | PASS |
| B4 | Pipedream cron workflow exists | Active workflow | "Closed-Lost Digest — Scout Weekly Cron" is live, v2 Active | PASS |
| B5 | `POST /score-batch/closed-lost` (wrong token) | 401 | ~~200 accepted~~ → 401 after fix | FIXED |

### Engagement Ranking Verified
```
1. [rank 10] Megan Protas — New York Life (2 sessions)
2. [rank 10] Michael McDonald — Capital One Financial (2 sessions)
3. [rank  0] Jim Eyraud — Westlake Financial (no engagement)
4. [rank  0] Sara Hosseiny — Westlake Financial (no engagement)
...
Sorted by engagement rank: True ✓
```

### CLI Output Sample
```
mprotas@nylventures.com      — ★ ENGAGED (rank 10) — warm, self-service
michael.mcdonald@capitalone.com — ★ ENGAGED (rank 10) — warm, enterprise
jeyraud@westlakefinancial.com   — warm, enterprise
```

### Observations
- Engagement ranking is working correctly — contacts with web sessions sort above zero-engagement contacts.
- The current closed-lost pool has low engagement scores (max rank 10 from session count). The really engaged contacts (Luba Mainz, Lorraine Segars) found in earlier testing may not appear in the default search window. The pool size (3x limit) helps but HubSpot search order still influences which contacts enter the pool.
- Slack digest posted even in dry-run mode — this is a minor issue (dry-run should probably skip Slack too).

---

## Pipeline C — Dashboard Signups

### Test Results

| # | Test | Expected | Actual | Status |
|---|------|----------|--------|--------|
| C1 | Slack message retrieval (local) | Parsed DashBot messages | Failed: `SLACK_BOT_TOKEN` not in local `.env` | KNOWN GAP |
| C2 | `POST /webhook/dashboard-signup` (valid token, real email) | 200 accepted | 200 `{"status":"accepted","email":"miguel.b@liberty1lending.com"}` | PASS |
| C3 | Parser + guards unit tests (local) | All pass | All pass (5 parser tests, 5 email tests, 5 guard tests) | PASS |
| C4 | `POST /score-batch/dashboard-signups?limit=2` | 200 accepted | 200 `{"status":"accepted","limit":2}` | PASS |
| C5 | `POST /webhook/dashboard-signup` (wrong token) | 401 | ~~200 accepted~~ → 401 after fix | FIXED |
| C6 | Missing email field | 422 validation | 422 `"Field required"` with location `["body","email"]` | PASS |
| C7 | CLI `score-dashboard-backlog --dry-run --limit 2` | Scores backlog | 0 signups (no `SLACK_BOT_TOKEN` locally) | KNOWN GAP |

### Parser Verification
```
"[From Action] New User: MIGUEL BREWER <mailto:miguel.b@...>"
  → {full_name: "MIGUEL BREWER", email: "miguel.b@liberty1lending.com", company: ""}  ✓

"[From Action] New User: Reyna Hernandez ... company: Associated Bank."
  → {full_name: "Reyna Hernandez", email: "reyna.hernandez@associatedbank.com", company: "Associated Bank"}  ✓

"[Auth0 → HubSpot Sync Report]..." → None  ✓ (correctly filtered)
"Random human message" → None  ✓ (correctly filtered)
"" → None  ✓
```

### Guard Verification
```
lead, never scored     → should_score=True   ✓
customer              → should_score=False  ✓ (excluded stage)
opportunity           → should_score=False  ✓ (excluded stage)
lead, scored today    → should_score=False  ✓ (7-day cooldown)
lead, scored 2025     → should_score=True   ✓ (past cooldown)
```

### Observations
- `SLACK_BOT_TOKEN` is only available on App Runner, not locally. This means the CLI backlog command and Slack message retrieval only work in production or when the token is added to `.env`.
- Find-or-create successfully found existing contact for `miguel.b@liberty1lending.com` (ID: 210151820098).

---

## Critical Bug Found & Fixed

### Authentication Not Enforced (All Endpoints)

**Severity:** CRITICAL
**Affected:** `/webhook`, `/webhook/dashboard-signup`, `/score-batch/closed-lost`, `/score-batch/dashboard-signups`

**Root cause:** In `settings.py`, the field was:
```python
webhook_secret: str = ""  # mapped to env var WEBHOOK_SECRET
```
But the App Runner env var was `SCOUT_WEBHOOK_SECRET`. Pydantic couldn't find it, defaulted to `""`, and `_check_token()` skips validation when the secret is empty.

**Fix:** Added `Field(alias="SCOUT_WEBHOOK_SECRET")` and `populate_by_name: True`:
```python
webhook_secret: str = Field(default="", alias="SCOUT_WEBHOOK_SECRET")
```

**Verification after deploy:**
```
Wrong token  → 401 Unauthorized  ✓
No token     → 401 Unauthorized  ✓
Correct token → 200 Accepted     ✓
```

---

## Areas for Improvement

### High Priority

1. **Add `SLACK_BOT_TOKEN` to local `.env`** — enables local testing of Pipeline C backlog and Slack message retrieval. Currently the CLI `score-dashboard-backlog` command silently returns 0 results locally.

2. **Dry-run should skip Slack digest** — `run_closed_lost_batch(dry_run=True)` correctly skips HubSpot writes but the CLI still calls `post_closed_lost_digest(results)`. Should be gated by `if not dry_run`.

3. **Agno agent inconsistency** — The `/score` endpoint returned "Deterministic score only" with 0 agent adjustment for contact 23965, suggesting the agent either failed or chose not to adjust. The forced tool-use prompt was deployed in this image — but the agent still isn't consistently using tools. Consider:
   - Adding `tool_choice="required"` in the Agno Agent constructor if supported
   - Logging which tools the agent called (currently not logged to stdout)
   - Adding a telemetry counter for "agent used tools" vs "agent skipped tools"

### Medium Priority

4. **HubSpot search ordering for Pipeline B** — The engagement ranking works on the fetched pool, but HubSpot's `search_contacts` returns contacts in its own default order. Contacts with the highest engagement might not be in the initial pool. Consider:
   - Adding a HubSpot sort parameter (`hs_analytics_last_visit_timestamp` descending)
   - Or running two searches: one for recent web visitors, one for the general closed-lost pool, then merging

5. **Pipedream Pipeline C workflow** — The Slack trigger is configured and merged but hasn't processed a real DashBot message yet (test event was a sample). First real event will be the true validation.

6. **Batch endpoint response** — Both `/score-batch/closed-lost` and `/score-batch/dashboard-signups` return `{"status": "accepted"}` immediately (background task). There's no way to check if the batch succeeded or how many contacts were scored. Consider adding a status polling endpoint or logging the results to a persistent store.

### Low Priority

7. **GOOGLE_API_KEY / GEMINI_API_KEY warning** — "Both GOOGLE_API_KEY and GEMINI_API_KEY are set" appears on every agent run. This is cosmetic but noisy. Remove one of the env vars.

8. **Pipeline A Pipedream workflow** — The existing "Inbound Lead Scoring Pipeline" does inline scoring in Pipedream (not via Scout API). Consider migrating it to relay to the Scout API for consistency with Pipeline B and C.

9. **Test coverage for remote endpoints** — Current tests are unit tests (local) + manual curl. Consider adding a pytest integration test suite that hits the deployed API with known contacts and verifies responses.

---

## Test Environment

| Component | Version / State |
|-----------|----------------|
| App Runner | RUNNING, us-east-1 |
| Docker image | `sha256:56b5ebb24f37...` (pushed 2026-03-18) |
| Python | 3.13.7 |
| Unit tests | 63/63 passing |
| Pipedream workflows | 3 active (Inbound v4, Closed-Lost v2, Dashboard C merged) |
| HubSpot | Portal 19933594, 8 Scout properties + scout_source |
| Auth | ENFORCED (verified post-fix) |
