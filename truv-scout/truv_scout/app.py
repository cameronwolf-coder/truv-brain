"""FastAPI application for Truv Scout."""

from typing import Optional

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException

from truv_scout.models import DashboardSignupPayload, ScoreRequest, ScoreResponse, WebhookPayload
from truv_scout.settings import get_settings

settings = get_settings()

app = FastAPI(title="Truv Scout", version="0.1.0")


def _check_token(token: Optional[str]) -> None:
    """Raise 401 if a webhook secret is configured and the token doesn't match."""
    if settings.webhook_secret and token != settings.webhook_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/status")
def system_status(x_scout_token: Optional[str] = Header(None)):
    """Return system status with recent scoring activity."""
    _check_token(x_scout_token)
    import os
    return {
        "status": "ok",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "pipelines": {
            "a": {"name": "Inbound", "endpoint": "/webhook"},
            "b": {"name": "Closed-Lost", "endpoint": "/score-batch/closed-lost"},
            "c": {"name": "Dashboard Signups", "endpoint": "/webhook/dashboard-signup"},
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
        import logging
        logging.exception("Pipeline error in /score")
        raise HTTPException(500, "Internal scoring error")

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


@app.post("/score-batch/dashboard-signups")
async def score_dashboard_signups_batch(
    background_tasks: BackgroundTasks,
    limit: int = 200,
    x_scout_token: Optional[str] = Header(None),
):
    """Batch score historical dashboard signups from Slack channel history."""
    _check_token(x_scout_token)
    background_tasks.add_task(_process_dashboard_backlog, limit)
    return {"status": "accepted", "limit": limit}


@app.post("/score-batch/closed-lost")
async def score_closed_lost_batch(
    background_tasks: BackgroundTasks,
    limit: int = 50,
    x_scout_token: Optional[str] = Header(None),
):
    """Batch score stale closed-lost contacts and post Slack digest."""
    _check_token(x_scout_token)
    background_tasks.add_task(_process_closed_lost_batch, limit)
    return {"status": "accepted", "limit": limit}


@app.post("/webhook/smartlead-event")
async def webhook_smartlead_event(
    request: dict,
    background_tasks: BackgroundTasks,
):
    """Receive SmartLead event webhooks (reply, completion, bounce, unsubscribe).

    No auth required — SmartLead webhooks cannot send custom headers.
    Endpoint only processes inbound event data (no destructive ops).
    """
    background_tasks.add_task(_process_smartlead_event, request)
    return {"status": "accepted", "event_type": request.get("event_type", "")}


# ── Background tasks ──────────────────────────────────────────────────


def _process_webhook(payload: WebhookPayload) -> None:
    from truv_scout.completion_callback import fire_completion_webhook
    from truv_scout.hubspot_writer import write_scores_to_hubspot
    from truv_scout.pipeline import run_pipeline
    from truv_scout.slack import notify_slack

    try:
        result = run_pipeline(contact_id=payload.contact_id)
    except Exception as e:
        print(f"[webhook] Pipeline error for {payload.contact_id}: {e}")
        return

    write_scores_to_hubspot(result)
    fire_completion_webhook(result, source=payload.event_type)

    if result.final_tier == "hot" or result.final_routing == "enterprise":
        notify_slack(result)


def _process_dashboard_signup(payload: DashboardSignupPayload) -> None:
    from truv_scout.dashboard import process_dashboard_signup

    try:
        process_dashboard_signup(payload)
    except Exception as e:
        print(f"[dashboard-signup] Error processing {payload.email}: {e}")


def _process_dashboard_backlog(limit: int) -> None:
    from truv_scout.dashboard import run_dashboard_backlog_batch
    from truv_scout.slack import post_closed_lost_digest

    try:
        results = run_dashboard_backlog_batch(limit=limit)
        if results:
            post_closed_lost_digest(results)
    except Exception as e:
        print(f"[dashboard-backlog] Error during batch run: {e}")


def _process_closed_lost_batch(limit: int) -> None:
    from truv_scout.batch import run_closed_lost_batch
    from truv_scout.slack import post_closed_lost_digest

    try:
        results = run_closed_lost_batch(limit=limit)
        post_closed_lost_digest(results)
    except Exception as e:
        print(f"[closed-lost-batch] Error during batch run: {e}")


def _process_smartlead_event(event: dict) -> None:
    from truv_scout.smartlead_events import handle_smartlead_event

    try:
        result = handle_smartlead_event(event)
        if result.get("skipped"):
            print(f"[smartlead-event] Skipped: {result.get('reason')}")
        else:
            print(f"[smartlead-event] Processed {result.get('event_type')} for {result.get('contact_id')}")
    except Exception as e:
        print(f"[smartlead-event] Error: {e}")
