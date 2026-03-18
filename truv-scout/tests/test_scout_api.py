"""Tests for the Truv Scout FastAPI endpoints."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from truv_scout.app import app
from truv_scout.models import PipelineResult, ScoutDecision

client = TestClient(app)


def _make_pipeline_result(contact_id: str = "c-123") -> PipelineResult:
    """Build a realistic PipelineResult for mocking."""
    decision = ScoutDecision(
        adjusted_score=72.5,
        tier="hot",
        routing="enterprise",
        reasoning="VP at large mortgage lender with high volume.",
        recommended_action="Route to enterprise AE immediately.",
        confidence="high",
        tech_matches={"los_pos": ["Encompass"], "voi_voe": []},
        knowledge_sources_used=["hubspot_form", "apollo_enrichment"],
    )
    return PipelineResult(
        contact_id=contact_id,
        base_score=65.0,
        form_fit_score=30.0,
        engagement_score=10.0,
        timing_score=10.0,
        deal_context_score=10.0,
        external_trigger_score=5.0,
        base_routing="enterprise",
        decision=decision,
        final_score=72.5,
        final_tier="hot",
        final_routing="enterprise",
        reasoning="VP at large mortgage lender with high volume.",
        recommended_action="Route to enterprise AE immediately.",
        confidence="high",
    )


# ── Tests ────────────────────────────────────────────────────────────


def test_health():
    """GET /health returns 200 with status ok."""
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_score_no_params():
    """POST /score with empty body returns 400."""
    resp = client.post("/score", json={})
    assert resp.status_code == 400
    body = resp.json()
    assert "contact_id" in body["detail"].lower() or "email" in body["detail"].lower()


@patch("truv_scout.pipeline.run_pipeline")
def test_score_with_contact_id(mock_run):
    """POST /score with contact_id returns a valid ScoreResponse."""
    mock_run.return_value = _make_pipeline_result("c-456")

    resp = client.post("/score", json={"contact_id": "c-456", "skip_enrichment": True})
    assert resp.status_code == 200

    data = resp.json()
    assert data["contact_id"] == "c-456"
    assert data["total_score"] == 72.5
    assert data["tier"] == "hot"
    assert data["routing"] == "enterprise"
    assert data["reasoning"]
    assert data["recommended_action"]
    assert data["confidence"] == "high"
    assert "los_pos" in data["tech_matches"]
    assert isinstance(data["form_fit_score"], float)
    assert isinstance(data["engagement_score"], float)
    assert isinstance(data["agent_adjustment"], float)
    assert isinstance(data["knowledge_sources_used"], list)

    mock_run.assert_called_once()


def test_webhook():
    """POST /webhook accepts payload and returns status=accepted immediately (background task)."""
    payload = {
        "contact_id": "wh-789",
        "event_type": "form_submission",
        "properties": {"firstname": "Jane", "lastname": "Doe"},
    }
    resp = client.post("/webhook", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "accepted"
    assert data["contact_id"] == "wh-789"


def test_webhook_wrong_token():
    """POST /webhook with wrong x-scout-token returns 401 when secret is configured."""
    import truv_scout.app as app_module

    original_secret = app_module.settings.webhook_secret
    app_module.settings.webhook_secret = "correct-secret"

    try:
        payload = {"contact_id": "wh-999", "event_type": "form_submission", "properties": {}}
        resp = client.post("/webhook", json=payload, headers={"x-scout-token": "wrong-secret"})
        assert resp.status_code == 401
    finally:
        app_module.settings.webhook_secret = original_secret
