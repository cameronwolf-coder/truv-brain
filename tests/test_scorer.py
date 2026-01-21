"""Tests for contact scoring."""
from datetime import datetime, timedelta
from outreach_intel.scorer import ContactScorer, ScoredContact


def test_scorer_initialization():
    """Scorer initializes with default weights."""
    scorer = ContactScorer()
    assert scorer.weights is not None
    assert "engagement" in scorer.weights
    assert "timing" in scorer.weights
    assert "deal_context" in scorer.weights


def test_score_contact_returns_scored_contact():
    """score_contact returns ScoredContact with scores."""
    scorer = ContactScorer()
    contact = {
        "id": "123",
        "properties": {
            "firstname": "John",
            "lastname": "Doe",
            "email": "john@example.com",
            "jobtitle": "VP of Operations",
            "lifecyclestage": "268636563",  # Closed Lost
        }
    }

    scored = scorer.score_contact(contact)

    assert isinstance(scored, ScoredContact)
    assert scored.contact_id == "123"
    assert 0 <= scored.total_score <= 100
    assert scored.firstname == "John"


def test_closed_lost_gets_higher_score():
    """Closed Lost contacts score higher than new leads."""
    scorer = ContactScorer()

    closed_lost = {
        "id": "1",
        "properties": {
            "firstname": "Jane",
            "lifecyclestage": "268636563",  # Closed Lost
        }
    }
    new_lead = {
        "id": "2",
        "properties": {
            "firstname": "Bob",
            "lifecyclestage": "subscriber",  # New
        }
    }

    scored_cl = scorer.score_contact(closed_lost)
    scored_new = scorer.score_contact(new_lead)

    # Closed Lost should score higher (they were further in pipeline)
    assert scored_cl.deal_context_score > scored_new.deal_context_score


def test_recent_engagement_boosts_score():
    """Recent email engagement increases score."""
    scorer = ContactScorer()

    recent_open = datetime.now() - timedelta(days=7)
    old_open = datetime.now() - timedelta(days=180)

    engaged = {
        "id": "1",
        "properties": {
            "firstname": "Jane",
            "hs_email_last_open_date": recent_open.isoformat(),
        }
    }
    stale = {
        "id": "2",
        "properties": {
            "firstname": "Bob",
            "hs_email_last_open_date": old_open.isoformat(),
        }
    }

    scored_engaged = scorer.score_contact(engaged)
    scored_stale = scorer.score_contact(stale)

    assert scored_engaged.engagement_score > scored_stale.engagement_score
