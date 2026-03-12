"""Tests for multi-agent signal team (Flow C)."""
import json
from unittest.mock import patch
from outreach_intel.signal_team import run_signal_team, SignalReview


def _make_contact():
    return {
        "contact_id": "123",
        "firstname": "Sarah",
        "lastname": "Chen",
        "email": "sarah@example.com",
        "jobtitle": "VP Lending",
        "company": "Pacific Federal Credit Union",
        "lifecyclestage": "268636563",
        "total_score": 62.5,
        "engagement_score": 70.0,
        "timing_score": 50.0,
        "deal_context_score": 80.0,
        "external_trigger_score": 40.0,
    }


def test_run_signal_team_returns_reviews():
    """run_signal_team returns SignalReview objects."""
    mock_response = json.dumps([{
        "contact_id": "123",
        "original_score": 62.5,
        "adjusted_score": 91.0,
        "reasoning": "Multiple strong signals across CRM, hiring, and regulatory dimensions.",
        "recommended_action": "Priority outreach from account executive.",
        "confidence": "high",
    }])

    with patch("outreach_intel.signal_team._run_team") as mock:
        mock.return_value = mock_response
        results = run_signal_team([_make_contact()])

    assert len(results) == 1
    assert results[0].adjusted_score == 91.0
    assert isinstance(results[0], SignalReview)


def test_run_signal_team_empty():
    """run_signal_team returns empty for empty input."""
    assert run_signal_team([]) == []
