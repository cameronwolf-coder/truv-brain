"""FastAPI application for Truv Scout."""

import dataclasses
import hmac
import logging
import os
import threading
from collections import OrderedDict
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Query

from truv_scout.models import (
    DashboardSignupPayload,
    PipelineResult,
    ROICalculatorPayload,
    ScoreRequest,
    ScoreResponse,
    SmartLeadEventPayload,
    WebhookPayload,
)
from truv_scout.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

app = FastAPI(title="Truv Scout", version="0.1.0")

# In-memory trace store (LRU, max 200 entries)
_trace_store: OrderedDict[str, dict] = OrderedDict()
_TRACE_STORE_MAX = 200
_trace_lock = threading.Lock()


def _save_trace(contact_id: str, trace_dict: dict) -> None:
    """Store a pipeline trace keyed by contact_id (most recent wins)."""
    with _trace_lock:
        _trace_store[contact_id] = trace_dict
        _trace_store.move_to_end(contact_id)
        while len(_trace_store) > _TRACE_STORE_MAX:
            _trace_store.popitem(last=False)


def _check_token(token: Optional[str]) -> None:
    """Raise 401 if webhook secret is not set or token doesn't match."""
    if not settings.webhook_secret:
        if settings.environment != "development":
            raise HTTPException(status_code=500, detail="SCOUT_WEBHOOK_SECRET not configured")
        return  # Allow unauthenticated in development
    if not token or not hmac.compare_digest(token, settings.webhook_secret):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/status")
def system_status(x_scout_token: Optional[str] = Header(None)):
    """Return system status with recent scoring activity."""
    _check_token(x_scout_token)
    return {
        "status": "ok",
        "environment": settings.environment,
        "pipelines": {
            "a": {"name": "Inbound", "endpoint": "/webhook"},
            "b": {"name": "Closed-Lost", "endpoint": "/score-batch/closed-lost"},
            "c": {"name": "Dashboard Signups", "endpoint": "/webhook/dashboard-signup"},
            "d": {"name": "ROI Calculator", "endpoint": "/webhook/roi-calculator"},
        },
    }


@app.post("/score", response_model=ScoreResponse)
async def score_lead(
    request: ScoreRequest,
    x_scout_token: Optional[str] = Header(None),
):
    """Score an inbound lead through the full pipeline."""
    _check_token(x_scout_token)
    from truv_scout.pipeline import run_pipeline

    if not request.contact_id and not request.email:
        raise HTTPException(400, "Either contact_id or email is required")

    try:
        result = run_pipeline(
            contact_id=request.contact_id,
            email=request.email,
            first_name=request.first_name,
            last_name=request.last_name,
            company=request.company,
            domain=request.domain,
            skip_enrichment=request.skip_enrichment,
            skip_agent=request.skip_agent,
        )
    except Exception as e:
        logger.exception("Pipeline error in /score")
        raise HTTPException(500, "Internal scoring error")

    if result.trace:
        _save_trace(result.contact_id, dataclasses.asdict(result.trace))

    return ScoreResponse(
        contact_id=result.contact_id,
        total_score=result.final_score,
        tier=result.final_tier,
        routing=result.final_routing,
        reasoning=result.reasoning,
        recommended_action=result.recommended_action,
        confidence=result.confidence,
        tech_matches=result.decision.tech_matches if result.decision else {},
        form_fit_score=result.form_fit_score,
        engagement_score=result.engagement_score,
        timing_score=result.timing_score,
        deal_context_score=result.deal_context_score,
        external_trigger_score=result.external_trigger_score,
        agent_adjustment=result.agent_adjustment,
        knowledge_sources_used=result.decision.knowledge_sources_used if result.decision else [],
    )


@app.post("/webhook")
async def pipedream_webhook(
    payload: WebhookPayload,
    background_tasks: BackgroundTasks,
    x_scout_token: Optional[str] = Header(None),
):
    """Receive webhook relay from Pipedream, score in background, write back to HubSpot."""
    _check_token(x_scout_token)
    background_tasks.add_task(_process_webhook, payload)
    return {"status": "accepted", "contact_id": payload.contact_id}


@app.post("/webhook/dashboard-signup")
async def webhook_dashboard_signup(
    payload: DashboardSignupPayload,
    background_tasks: BackgroundTasks,
    x_scout_token: Optional[str] = Header(None),
):
    """Receive dashboard signup from Pipedream Slack trigger, score in background."""
    _check_token(x_scout_token)
    background_tasks.add_task(_process_dashboard_signup, payload)
    return {"status": "accepted", "email": payload.email}


@app.post("/webhook/roi-calculator")
async def webhook_roi_calculator(
    payload: ROICalculatorPayload,
    background_tasks: BackgroundTasks,
):
    """Receive ROI calculator form submission, score in background, write back to HubSpot.
    No auth required — called from client-side JS on truv.com (like HubSpot Forms API)."""
    background_tasks.add_task(_process_roi_calculator, payload)
    return {"status": "accepted", "contact_id": payload.contact_id}


@app.post("/score-batch/dashboard-signups")
async def score_dashboard_signups_batch(
    background_tasks: BackgroundTasks,
    limit: int = Query(200, ge=1, le=500),
    x_scout_token: Optional[str] = Header(None),
):
    """Batch score historical dashboard signups from Slack channel history."""
    _check_token(x_scout_token)
    background_tasks.add_task(_process_dashboard_backlog, limit)
    return {"status": "accepted", "limit": limit}


@app.post("/score-batch/closed-lost")
async def score_closed_lost_batch(
    background_tasks: BackgroundTasks,
    limit: int = Query(50, ge=1, le=500),
    x_scout_token: Optional[str] = Header(None),
):
    """Batch score stale closed-lost contacts and post Slack digest."""
    _check_token(x_scout_token)
    background_tasks.add_task(_process_closed_lost_batch, limit)
    return {"status": "accepted", "limit": limit}


@app.get("/trace/{contact_id}")
async def get_trace(
    contact_id: str,
    x_scout_token: Optional[str] = Header(None),
):
    """Return the most recent pipeline trace for a contact."""
    _check_token(x_scout_token)
    with _trace_lock:
        trace = _trace_store.get(contact_id)
    if not trace:
        raise HTTPException(404, f"No trace found for contact {contact_id}")
    return trace


@app.post("/webhook/smartlead-event")
async def webhook_smartlead_event(
    payload: SmartLeadEventPayload,
    background_tasks: BackgroundTasks,
    token: Optional[str] = Query(None, alias="token"),
):
    """Receive SmartLead event webhooks (reply, completion, bounce, unsubscribe).

    SmartLead cannot send custom headers, so auth is via a URL query param token.
    Set SMARTLEAD_WEBHOOK_TOKEN and configure SmartLead to POST to
    /webhook/smartlead-event?token=<value>.
    """
    expected = settings.smartlead_webhook_token
    if expected:
        if not token or not hmac.compare_digest(token, expected):
            raise HTTPException(status_code=401, detail="Unauthorized")
    event_dict = payload.model_dump()
    background_tasks.add_task(_process_smartlead_event, event_dict)
    return {"status": "accepted", "event_type": payload.event_type}


# ── Background tasks ──────────────────────────────────────────────────


def _process_webhook(payload: WebhookPayload) -> None:
    from truv_scout.completion_callback import fire_completion_webhook
    from truv_scout.hubspot_writer import write_scores_to_hubspot
    from truv_scout.pipeline import run_pipeline
    from truv_scout.slack import notify_slack

    try:
        result = run_pipeline(contact_id=payload.contact_id)
    except Exception:
        logger.exception(f"[webhook] Pipeline error for {payload.contact_id}")
        return

    try:
        if result.trace:
            _save_trace(result.contact_id, dataclasses.asdict(result.trace))

        write_scores_to_hubspot(result)
        fire_completion_webhook(result, source=payload.event_type)

        if result.final_tier == "hot" or result.final_routing == "enterprise":
            notify_slack(result)
    except Exception:
        logger.exception(f"[webhook] Post-pipeline error for {payload.contact_id}")


def _process_dashboard_signup(payload: DashboardSignupPayload) -> None:
    from truv_scout.dashboard import process_dashboard_signup

    try:
        process_dashboard_signup(payload)
    except Exception as e:
        logger.exception(f"[dashboard-signup] Error processing {payload.email}")


def _process_dashboard_backlog(limit: int) -> None:
    from truv_scout.dashboard import run_dashboard_backlog_batch
    from truv_scout.slack import post_closed_lost_digest

    try:
        results = run_dashboard_backlog_batch(limit=limit)
        if results:
            post_closed_lost_digest(results)
    except Exception as e:
        logger.exception("[dashboard-backlog] Error during batch run")


def _process_closed_lost_batch(limit: int) -> None:
    from truv_scout.batch import run_closed_lost_batch
    from truv_scout.slack import post_closed_lost_digest

    try:
        results = run_closed_lost_batch(limit=limit)
        post_closed_lost_digest(results)
    except Exception as e:
        logger.exception("[closed-lost-batch] Error during batch run")


def _process_roi_calculator(payload: ROICalculatorPayload) -> None:
    import time

    import requests

    from truv_scout.completion_callback import fire_completion_webhook
    from truv_scout.hubspot_writer import write_scores_to_hubspot
    from truv_scout.pipeline import run_pipeline
    from truv_scout.slack import notify_slack

    # Brief delay to let HubSpot process the form submission and create the contact
    time.sleep(5)

    # Resolve contact_id from email if not provided
    contact_id = payload.contact_id
    if not contact_id and payload.email:
        try:
            r = requests.post(
                "https://api.hubapi.com/crm/v3/objects/contacts/search",
                headers={
                    "Authorization": f"Bearer {settings.hubspot_api_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "filterGroups": [{"filters": [{"propertyName": "email", "operator": "EQ", "value": payload.email}]}],
                    "limit": 1,
                },
                timeout=10,
            )
            results = r.json().get("results", [])
            if results:
                contact_id = results[0]["id"]
                logger.info(f"[roi-calculator] Resolved {payload.email} -> contact {contact_id}")
            else:
                logger.warning(f"[roi-calculator] No HubSpot contact found for {payload.email}")
                return
        except Exception as e:
            logger.exception(f"[roi-calculator] Failed to resolve contact for {payload.email}")
            return

    try:
        result = run_pipeline(
            contact_id=contact_id,
            email=payload.email,
            first_name=payload.first_name,
            last_name=payload.last_name,
            company=payload.company,
            source="roi_calculator",
        )
    except Exception as e:
        logger.exception(f"[roi-calculator] Pipeline error for {contact_id}")
        return

    if result.trace:
        _save_trace(result.contact_id, dataclasses.asdict(result.trace))

    write_scores_to_hubspot(result, source="roi_calculator")
    fire_completion_webhook(result, source="roi_calculator")

    # Always notify #roi-calculator channel for ROI leads (all tiers)
    notify_slack(result, source="roi_calculator")

    # Queue Smartlead follow-up from Chris (15-minute delay)
    timer = threading.Timer(
        900,  # 15 minutes
        _push_roi_lead_to_smartlead,
        args=(payload, result),
    )
    timer.daemon = True  # Don't block shutdown
    timer.start()
    logger.info(f"[roi-calculator] Smartlead follow-up queued for {payload.email} in 15 minutes")


def _push_roi_lead_to_smartlead(payload: ROICalculatorPayload, result: PipelineResult) -> None:
    """Push an ROI calculator lead to Smartlead campaign (Chris Calcasola)."""
    try:
        api_key = settings.smartlead_api_key
        if not api_key:
            logger.warning("[roi-smartlead] SMARTLEAD_API_KEY not set")
            return

        campaign_id = settings.smartlead_campaign_roi or "3093829"

        # Format savings as dollar amount for email copy
        savings = payload.annual_savings
        if savings >= 1_000_000:
            savings_fmt = f"${savings / 1_000_000:.1f}M"
        elif savings >= 1_000:
            savings_fmt = f"${savings / 1_000:.0f}K"
        else:
            savings_fmt = f"${savings:,.0f}"

        loans_fmt = f"{payload.funded_loans:,}"
        los_name = {
            "encompass": "Encompass",
            "bytepro": "Byte Pro",
            "meridianlink": "MeridianLink",
            "blackknight": "Black Knight",
            "blend": "Blend",
            "floify": "Floify",
            "ncino": "nCino",
            "encompassconsumerconnect": "Encompass Consumer Connect",
        }.get(payload.los_system, payload.los_system or "your LOS")

        lead = {
            "email": payload.email,
            "first_name": payload.first_name,
            "last_name": payload.last_name,
            "company_name": payload.company,
            "custom_fields": {
                "custom1": savings_fmt,
                "custom2": loans_fmt,
                "custom3": los_name,
            },
        }

        import requests
        resp = requests.post(
            f"https://server.smartlead.ai/api/v1/campaigns/{campaign_id}/leads",
            params={"api_key": api_key},
            json={"lead_list": [lead]},
            timeout=15,
        )

        if resp.status_code == 200:
            logger.info(f"[roi-smartlead] Pushed {payload.email} to campaign {campaign_id}")
        else:
            logger.warning(f"[roi-smartlead] Failed to push {payload.email}: {resp.status_code} {resp.text[:200]}")
    except Exception as e:
        logger.exception(f"[roi-smartlead] Error pushing {payload.email}")


def _process_smartlead_event(event: dict) -> None:
    from truv_scout.smartlead_events import handle_smartlead_event

    try:
        result = handle_smartlead_event(event)
        if result.get("skipped"):
            logger.info(f"[smartlead-event] Skipped: {result.get('reason')}")
        else:
            logger.info(f"[smartlead-event] Processed {result.get('event_type')} for {result.get('contact_id')}")
    except Exception as e:
        logger.exception("[smartlead-event] Error processing event")
