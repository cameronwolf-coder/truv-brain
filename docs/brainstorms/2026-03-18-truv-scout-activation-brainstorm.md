# Truv Scout Activation Brainstorm

**Date:** 2026-03-18
**Status:** Brainstorm complete, ready to plan
**Author:** Cameron Wolf

---

## What We're Building

Truv Scout is ~95% built as code — 4-layer scoring pipeline (deterministic → Apollo enrichment → Gemini agent → learning stub), CLI with 7 commands, FastAPI app, 42 passing tests. But it's not deployed anywhere, and nothing triggers it automatically.

**This project activates Scout end-to-end:**

1. **Deploy the FastAPI service** (Railway + Docker)
2. **Inbound pipeline** — Auto-score every dashboard signup as it arrives
3. **Closed-lost re-engagement** — Weekly batch scoring of stale closed-lost contacts, with Slack digest for cherry-picking + optional content-triggered outreach

---

## Why This Approach

The existing `outreach_intel` scoring system is broad (dormant, churned, TAM waves, wave cycling) but **reactive and manual**. It scores on demand. Truv Scout was designed to be the **always-on, intelligent layer** that answers two specific questions:

1. *Should enterprise sales reach out to this person?*
2. *Is this closed-lost contact worth re-engaging right now?*

Rather than rebuild from scratch, we activate what's already built. The code just needs a deployment target, triggers, and output actions wired up.

---

## Two Pipelines

### Pipeline A: Inbound Lead Scoring (Dashboard Signups)

**Trigger:** HubSpot form submission (dashboard signup)
**Flow:**
```
HubSpot form → Pipedream webhook → Scout API /webhook → 4-layer scoring → HubSpot write-back + Slack alert
```

**Scoring outputs (already built in `hubspot_writer.py`):**
- `inbound_lead_tier`: hot / warm / cold
- `lead_routing`: enterprise / self-service / government / not-a-lead
- `form_fit_score`: 0-100
- `scout_reasoning`: max 1000 chars
- `scout_confidence`: high / medium / low
- `scout_scored_at`: ISO timestamp
- `scout_tech_stack_matches`: matched LOS/POS/VOI/VOE providers

**Slack alert:** Only for `tier=hot` OR `routing=enterprise` — already built in `slack.py`

**Key value:** Catches "this person signed up for self-serve but looks like an enterprise prospect" — routes them to enterprise sales before they fall through the cracks.

---

### Pipeline B: Closed-Lost Re-engagement

**What it is NOT:** Immediate scoring when a deal closes. Stale closed-lost contacts with re-engagement signals.

**Two sub-approaches:**

#### B1: Weekly Engagement-Driven Batch
- **Schedule:** Pipedream cron, weekly (e.g., Monday morning)
- **Query:** Closed-lost contacts, deal closed >90 days ago, not currently in outreach sequence
- **Scoring filter:** Surface contacts who have recent website activity, email engagement, or positive external signals (hiring, news)
- **Output:** Slack digest to `#outreach-intelligence` — top 20 scored contacts for cherry-picking by sales/Cameron
- **Action:** Team selects from list → can enroll in Smartlead cold sequence or mark for follow-up

#### B2: Content-Triggered Outreach (Open Question)
- **Concept:** When a new case study or major content piece is published (e.g., mortgage fintech case study), Scout queries for closed-lost contacts in that vertical + high re-engagement score
- **Trigger options considered:** Manual trigger via CLI, Pipedream watching a HubSpot property change, or Notion/Linear update
- **Status:** Design not finalized — defer to a follow-up planning session

---

## Output Actions (per pipeline)

| Action | Pipeline A | Pipeline B |
|--------|-----------|-----------|
| Write score to HubSpot | ✅ Always | ✅ Always |
| Slack alert | Hot/enterprise only | Digest format (top N) |
| Knock enrollment | 🔲 Defer — TBD | ❌ Not applicable |
| Smartlead upload | ❌ Not applicable | Manual selection → CLI |

---

## Deployment Plan

**Target:** Railway (as designed in Phase 2 Obsidian notes)

- Docker container running FastAPI on port 8000
- Environment variables: `HUBSPOT_API_TOKEN`, `APOLLO_API_KEY`, `GOOGLE_API_KEY`, `SLACK_WEBHOOK_URL`, `FIRECRAWL_API_KEY`
- Estimated cost: ~$5-10/month on Railway Starter
- Health endpoint: `GET /health`
- Webhook endpoint: `POST /webhook` (Pipedream → Scout)
- Score endpoint: `POST /score` (CLI / batch use)

---

## What's Already Built (Don't Rebuild)

| Component | Location | Status |
|-----------|----------|--------|
| Deterministic scorer | `truv-scout/truv_scout/scorer.py` | ✅ 25 tests |
| Apollo enrichment | `truv-scout/truv_scout/tools/apollo.py` | ✅ 13 tests |
| Gemini Scout Agent | `truv-scout/truv_scout/agent.py` | ✅ Built |
| HubSpot write-back | `truv-scout/truv_scout/hubspot_writer.py` | ✅ Built |
| Slack Block Kit alerts | `truv-scout/truv_scout/slack.py` | ✅ Built |
| FastAPI app | `truv-scout/truv_scout/app.py` | ✅ Built |
| CLI | `truv-scout/truv_scout/cli.py` | ✅ 7 commands |

---

## What Needs to Be Built

1. **Dockerfile** + Railway config (`railway.json` or `railway.toml`)
2. **Pipedream: Inbound trigger** — HubSpot form webhook → POST to Scout `/webhook`
3. **Pipedream: Closed-lost digest** — Weekly cron → batch score closed-lost → Slack digest
4. **Closed-lost query** — CLI or service method filtering by: deal closed, stage=closed-lost, deal age >90 days, no active outreach sequence
5. **Knock enrollment logic** — Deferred; routing table to be defined once deployed and validated

---

## Open Questions

1. **Knock enrollment:** What Knock workflows exist or need to be created for enterprise vs self-service routing? (Defer until after deployment is validated)

## Resolved Questions

- **Closed-lost deal age threshold:** 90 days confirmed as "stale"
- **Pipedream vs direct webhook:** Stay on Phase 1 — Pipedream acts as relay to Scout API. Direct webhook (Phase 2) is more complex and not needed now.
- **Content trigger for B2:** Manual CLI for now. No automated content-publish detection needed in this phase.

---

## Key Decisions Made

- **Activation over rebuild** — The code is 95% done. Deploy and wire up triggers, don't rebuild.
- **Two distinct pipelines** — Inbound (real-time) and closed-lost (batch, weekly) are separate flows with different triggers and outputs.
- **Closed-lost is not immediate** — Don't score the moment a deal closes. Target stale deals with re-engagement signals.
- **Slack digest for closed-lost** — Human review (cherry-pick) before any outreach action. Not fully automated.
- **Knock enrollment deferred** — Solve deployment and triggers first. Enrollment logic follows.
