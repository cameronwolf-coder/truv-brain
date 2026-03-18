"""FastAPI application for Truv Scout."""

from typing import Optional

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException

from truv_scout.models import ScoreRequest, ScoreResponse, WebhookPayload
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


@app.post("/score", response_model=ScoreResponse)
async def score_lead(request: ScoreRequest):
    """Score an inbound lead through the full pipeline."""
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
        raise HTTPException(500, f"Pipeline error: {e}")

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


# ── Background tasks ──────────────────────────────────────────────────


def _process_webhook(payload: WebhookPayload) -> None:
    from truv_scout.hubspot_writer import write_scores_to_hubspot
    from truv_scout.pipeline import run_pipeline
    from truv_scout.slack import notify_slack

    try:
        result = run_pipeline(contact_id=payload.contact_id)
    except Exception as e:
        print(f"[webhook] Pipeline error for {payload.contact_id}: {e}")
        return

    write_scores_to_hubspot(result)

    if result.final_tier == "hot" or result.final_routing == "enterprise":
        notify_slack(result)


def _process_closed_lost_batch(limit: int) -> None:
    from truv_scout.batch import run_closed_lost_batch
    from truv_scout.slack import post_closed_lost_digest

    try:
        results = run_closed_lost_batch(limit=limit)
        post_closed_lost_digest(results)
    except Exception as e:
        print(f"[closed-lost-batch] Error during batch run: {e}")
