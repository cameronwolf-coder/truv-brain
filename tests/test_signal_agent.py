"""Tests for signal agent (Flow A: Smart Scorer + Flow B: Signal Enricher)."""
import json
import io
import contextlib
import pytest
from unittest.mock import patch, MagicMock
from outreach_intel.signal_agent import review_contacts, enrich_contacts, SignalReview


def _make_scored_contact(**overrides):
    """Helper to build a ScoredContact-like dict for testing."""
    defaults = {
        "contact_id": "123",
        "firstname": "Sarah",
        "lastname": "Chen",
        "email": "sarah@example.com",
        "jobtitle": "VP Lending",
        "company": "Pacific Federal Credit Union",
        "lifecyclestage": "268636563",
        "engagement_score": 70.0,
        "timing_score": 50.0,
        "deal_context_score": 80.0,
        "external_trigger_score": 40.0,
        "total_score": 62.5,
    }
    defaults.update(overrides)
    return defaults


def test_review_contacts_returns_signal_reviews():
    """review_contacts returns a list of SignalReview objects."""
    contacts = [_make_scored_contact()]

    mock_response = json.dumps([{
        "contact_id": "123",
        "original_score": 62.5,
        "adjusted_score": 78.0,
        "reasoning": "Recent email engagement after 6 months of silence signals renewed interest.",
        "recommended_action": "Route to sales for immediate follow-up.",
        "confidence": "high",
    }])

    with patch("outreach_intel.signal_agent._run_review_agent") as mock_agent:
        mock_agent.return_value = mock_response
        results = review_contacts(contacts)

    assert len(results) == 1
    assert isinstance(results[0], SignalReview)
    assert results[0].contact_id == "123"
    assert results[0].adjusted_score == 78.0
    assert results[0].confidence in ("high", "medium", "low")


def test_review_contacts_empty_list():
    """review_contacts returns empty list for empty input."""
    results = review_contacts([])
    assert results == []


def test_review_contacts_handles_markdown_wrapped_json():
    """review_contacts can parse JSON wrapped in markdown code blocks."""
    contacts = [_make_scored_contact()]

    mock_response = '```json\n[{"contact_id": "123", "original_score": 62.5, "adjusted_score": 70.0, "reasoning": "test", "recommended_action": "test", "confidence": "medium"}]\n```'

    with patch("outreach_intel.signal_agent._run_review_agent") as mock_agent:
        mock_agent.return_value = mock_response
        results = review_contacts(contacts)

    assert len(results) == 1
    assert results[0].adjusted_score == 70.0


def test_review_contacts_sorts_by_adjusted_score():
    """Results are sorted by adjusted_score descending."""
    contacts = [
        _make_scored_contact(contact_id="1"),
        _make_scored_contact(contact_id="2"),
    ]

    mock_response = json.dumps([
        {"contact_id": "1", "original_score": 60, "adjusted_score": 50, "reasoning": "low", "recommended_action": "nurture", "confidence": "medium"},
        {"contact_id": "2", "original_score": 60, "adjusted_score": 90, "reasoning": "high", "recommended_action": "sales", "confidence": "high"},
    ])

    with patch("outreach_intel.signal_agent._run_review_agent") as mock_agent:
        mock_agent.return_value = mock_response
        results = review_contacts(contacts)

    assert results[0].contact_id == "2"
    assert results[1].contact_id == "1"


def test_cli_signal_review_command_exists():
    """signal-review CLI command is registered."""
    from outreach_intel.cli import main

    f = io.StringIO()
    with contextlib.redirect_stdout(f), contextlib.redirect_stderr(f):
        try:
            main(["signal-review", "--help"])
        except SystemExit:
            pass

    output = f.getvalue()
    assert "signal" in output.lower() or "review" in output.lower()


def test_enrich_contacts_returns_signal_reviews():
    """enrich_contacts (Flow B) returns enriched SignalReview objects."""
    contacts = [_make_scored_contact()]

    mock_response = json.dumps([{
        "contact_id": "123",
        "original_score": 62.5,
        "adjusted_score": 85.0,
        "reasoning": "Company posted 4 lending ops roles. Title changed from Director to VP.",
        "recommended_action": "Route to sales immediately.",
        "confidence": "high",
    }])

    with patch("outreach_intel.signal_agent._run_enrichment_agent") as mock_agent:
        mock_agent.return_value = mock_response
        results = enrich_contacts(contacts)

    assert len(results) == 1
    assert results[0].adjusted_score == 85.0


def test_enrich_contacts_empty_list():
    """enrich_contacts returns empty list for empty input."""
    results = enrich_contacts([])
    assert results == []


def test_cli_enrich_command_exists():
    """enrich CLI command is registered."""
    from outreach_intel.cli import main

    f = io.StringIO()
    with contextlib.redirect_stdout(f), contextlib.redirect_stderr(f):
        try:
            main(["enrich", "--help"])
        except SystemExit:
            pass

    output = f.getvalue()
    assert "csv" in output.lower() or "enrich" in output.lower()


def test_cli_enrich_contact_command_exists():
    """enrich-contact CLI command is registered."""
    from outreach_intel.cli import main

    f = io.StringIO()
    with contextlib.redirect_stdout(f), contextlib.redirect_stderr(f):
        try:
            main(["enrich-contact", "--help"])
        except SystemExit:
            pass

    output = f.getvalue()
    assert "email" in output.lower()


def test_cli_score_inbound_registered():
    """score-inbound CLI command is registered."""
    from outreach_intel.cli import main
    import sys
    try:
        main(["score-inbound", "--help"])
    except SystemExit as e:
        assert e.code == 0


def test_cli_hiring_signals_command_exists():
    """hiring-signals CLI command is registered."""
    from outreach_intel.cli import main

    f = io.StringIO()
    with contextlib.redirect_stdout(f), contextlib.redirect_stderr(f):
        try:
            main(["hiring-signals", "--help"])
        except SystemExit:
            pass

    output = f.getvalue()
    assert "domain" in output.lower()
