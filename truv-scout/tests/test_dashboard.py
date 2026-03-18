"""Tests for Pipeline C — Dashboard signup scoring."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from truv_scout.app import app
from truv_scout.dashboard import (
    EXCLUDED_STAGES,
    is_personal_email,
    parse_dashbot_message,
    should_score_contact,
)

client = TestClient(app)


# ── Parser Tests ────────────────────────────────────────────────────


class TestParseDashbotMessage:
    def test_standard_invite_message(self):
        text = "[From Action] New User: MIGUEL BREWER <mailto:miguel.b@liberty1lending.com|miguel.b@liberty1lending.com>. Invite details below :arrow_down:."
        result = parse_dashbot_message(text)
        assert result is not None
        assert result["full_name"] == "MIGUEL BREWER"
        assert result["email"] == "miguel.b@liberty1lending.com"
        assert result["company"] == ""

    def test_message_with_company(self):
        text = "[From Action] New User: Reyna Hernandez <mailto:reyna@bank.com|reyna@bank.com>. Website form submitted for company: Associated Bank."
        result = parse_dashbot_message(text)
        assert result is not None
        assert result["full_name"] == "Reyna Hernandez"
        assert result["email"] == "reyna@bank.com"
        assert result["company"] == "Associated Bank"

    def test_non_dashbot_message(self):
        text = "[Auth0 → HubSpot Sync Report] Auth0 Users Found: 2"
        result = parse_dashbot_message(text)
        assert result is None

    def test_empty_message(self):
        result = parse_dashbot_message("")
        assert result is None

    def test_email_lowercased(self):
        text = "[From Action] New User: Test User <mailto:TEST@EXAMPLE.COM|TEST@EXAMPLE.COM>. Invite details below."
        result = parse_dashbot_message(text)
        assert result["email"] == "test@example.com"


# ── Personal Email Detection ────────────────────────────────────────


class TestIsPersonalEmail:
    def test_work_email(self):
        assert not is_personal_email("john@acme.com")

    def test_gmail(self):
        assert is_personal_email("john@gmail.com")

    def test_yahoo(self):
        assert is_personal_email("john@yahoo.com")

    def test_outlook(self):
        assert is_personal_email("john@outlook.com")

    def test_empty(self):
        assert not is_personal_email("")


# ── Scoring Guards ──────────────────────────────────────────────────


class TestShouldScoreContact:
    def test_new_lead_should_score(self):
        contact = {"properties": {"lifecyclestage": "lead"}}
        should, reason = should_score_contact(contact)
        assert should is True
        assert reason == ""

    def test_customer_excluded(self):
        contact = {"properties": {"lifecyclestage": "customer"}}
        should, reason = should_score_contact(contact)
        assert should is False
        assert "excluded" in reason

    def test_opportunity_excluded(self):
        contact = {"properties": {"lifecyclestage": "opportunity"}}
        should, reason = should_score_contact(contact)
        assert should is False

    def test_recently_scored_cooldown(self):
        from datetime import datetime, timezone

        recent = datetime.now(timezone.utc).isoformat()
        contact = {"properties": {"lifecyclestage": "lead", "scout_scored_at": recent}}
        should, reason = should_score_contact(contact)
        assert should is False
        assert "cooldown" in reason

    def test_old_score_allows_rescore(self):
        contact = {"properties": {"lifecyclestage": "lead", "scout_scored_at": "2025-01-01T00:00:00+00:00"}}
        should, reason = should_score_contact(contact)
        assert should is True

    def test_no_properties(self):
        contact = {"properties": {}}
        should, _ = should_score_contact(contact)
        assert should is True


# ── API Endpoint Tests ──────────────────────────────────────────────


class TestDashboardSignupEndpoint:
    def test_accepts_valid_payload(self):
        payload = {
            "email": "test@example.com",
            "full_name": "Test User",
            "company": "Acme Corp",
            "slack_ts": "1773864623.605399",
        }
        resp = client.post("/webhook/dashboard-signup", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "accepted"
        assert data["email"] == "test@example.com"

    def test_requires_email(self):
        resp = client.post("/webhook/dashboard-signup", json={"full_name": "Test"})
        assert resp.status_code == 422  # Pydantic validation

    def test_wrong_token_rejected(self):
        import truv_scout.app as app_module

        original = app_module.settings.webhook_secret
        app_module.settings.webhook_secret = "correct-secret"

        try:
            payload = {"email": "test@example.com"}
            resp = client.post(
                "/webhook/dashboard-signup",
                json=payload,
                headers={"x-scout-token": "wrong-secret"},
            )
            assert resp.status_code == 401
        finally:
            app_module.settings.webhook_secret = original

    def test_batch_endpoint_exists(self):
        resp = client.post("/score-batch/dashboard-signups")
        assert resp.status_code == 200
        assert resp.json()["status"] == "accepted"
