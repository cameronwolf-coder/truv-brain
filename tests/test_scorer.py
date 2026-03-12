"""Tests for contact scoring."""
from datetime import datetime, timedelta
from outreach_intel.scorer import ContactScorer, ScoredContact, parse_volume_range


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


# --- Task 1: parse_volume_range tests ---

def test_parse_volume_range_bracket():
    assert parse_volume_range("30,000-100,000") == (30000, 100000)


def test_parse_volume_range_plus():
    assert parse_volume_range("100,000+") == (100000, None)


def test_parse_volume_range_single():
    assert parse_volume_range("5000") == (5000, 5000)


def test_parse_volume_range_empty():
    assert parse_volume_range("") == (0, 0)


def test_parse_volume_range_none():
    assert parse_volume_range(None) == (0, 0)


# --- Task 2: _score_form_fit tests ---

def test_score_form_fit_full_match():
    scorer = ContactScorer()
    props = {
        "use_case": "Fintech / Retail banking",
        "how_many_loans_do_you_close_per_year": "30,000-100,000",
        "job_function_contact": "Risk & Compliance",
        "which_of_these_best_describes_your_job_title_": "Director",
        "message": "Looking to bolster our approval capabilities and interested to see if income verification would help us.",
        "hs_analytics_first_referrer": "https://truv.com/solutions/consumer-lending",
    }
    score = scorer._score_form_fit(props)
    assert score >= 85, f"Expected >= 85 for ideal ICP inbound, got {score}"


def test_score_form_fit_no_form_data():
    scorer = ContactScorer()
    props = {"firstname": "John", "lastname": "Smith", "email": "john@example.com"}
    score = scorer._score_form_fit(props)
    assert score == 0


def test_score_form_fit_partial_data():
    scorer = ContactScorer()
    props = {"use_case": "Mortgage", "which_of_these_best_describes_your_job_title_": "Manager"}
    score = scorer._score_form_fit(props)
    assert 30 <= score <= 40, f"Expected 30-40 for partial, got {score}"


def test_score_form_fit_low_volume_wrong_use_case():
    scorer = ContactScorer()
    props = {
        "use_case": "Other",
        "how_many_loans_do_you_close_per_year": "100",
        "which_of_these_best_describes_your_job_title_": "Individual Contributor",
        "job_function_contact": "Marketing",
    }
    score = scorer._score_form_fit(props)
    assert score <= 25, f"Expected <= 25 for poor fit, got {score}"


def test_score_form_fit_applications_volume_field():
    scorer = ContactScorer()
    props = {"how_many_applications_do_you_see_per_year_": "100,000+", "use_case": "Consumer Lending"}
    score = scorer._score_form_fit(props)
    assert score >= 55, f"Expected >= 55, got {score}"


# --- Task 3: pipeline wiring tests ---

def test_inbound_contact_uses_form_weights():
    scorer = ContactScorer()
    contact = {
        "id": "123",
        "properties": {
            "firstname": "Rick", "lastname": "Pommenville",
            "email": "rick@own.lease", "jobtitle": "Director",
            "company": "Own.lease", "lifecyclestage": "lead",
            "use_case": "Fintech / Retail banking",
            "how_many_loans_do_you_close_per_year": "30,000-100,000",
            "job_function_contact": "Risk & Compliance",
            "which_of_these_best_describes_your_job_title_": "Director",
            "message": "Looking to bolster our approval capabilities and interested to see if income verification would help us.",
            "hs_analytics_first_referrer": "https://truv.com/solutions/consumer-lending",
        },
    }
    scored = scorer.score_contact(contact)
    assert scored.form_fit_score > 80
    assert scored.total_score >= 54


def test_dormant_contact_uses_standard_weights():
    scorer = ContactScorer()
    contact = {
        "id": "456",
        "properties": {
            "firstname": "Jane", "lastname": "Doe",
            "email": "jane@acme.com", "jobtitle": "VP Operations",
            "company": "ACME Lending", "lifecyclestage": "268636563",
            "hs_email_last_open_date": "2026-02-15T10:00:00Z",
        },
    }
    scored = scorer.score_contact(contact)
    assert scored.form_fit_score == 0
    assert scored.total_score > 30


def test_scored_contact_has_form_fit_field():
    scorer = ContactScorer()
    contact = {"id": "789", "properties": {"firstname": "Test"}}
    scored = scorer.score_contact(contact)
    assert hasattr(scored, "form_fit_score")
