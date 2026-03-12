"""Tests for signal enrichment tools (Flow B)."""
from unittest.mock import patch, MagicMock
from outreach_intel.signal_tools import (
    search_company_news,
    check_job_changes,
    get_hubspot_activity,
)


def test_search_company_news_returns_string():
    """search_company_news returns a string summary."""
    with patch("outreach_intel.signal_tools._firecrawl_search") as mock:
        mock.return_value = [{"title": "Pacific Federal expands", "url": "https://example.com", "description": "Expansion into new markets"}]
        result = search_company_news("Pacific Federal Credit Union")

    assert isinstance(result, str)
    assert "Pacific Federal" in result


def test_search_company_news_no_results():
    """search_company_news handles empty results."""
    with patch("outreach_intel.signal_tools._firecrawl_search") as mock:
        mock.return_value = []
        result = search_company_news("Unknown Corp")

    assert "No recent news found" in result


def test_check_job_changes_returns_string():
    """check_job_changes returns a string summary."""
    with patch("outreach_intel.signal_tools._firecrawl_search") as mock:
        mock.return_value = [{"title": "Sarah Chen promoted to VP", "url": "https://example.com", "description": "Leadership change"}]
        result = check_job_changes("Sarah Chen", "Pacific Federal Credit Union")

    assert isinstance(result, str)
    assert len(result) > 0


def test_check_job_changes_no_results():
    """check_job_changes handles no results."""
    with patch("outreach_intel.signal_tools._firecrawl_search") as mock:
        mock.return_value = []
        result = check_job_changes("John Doe", "Unknown Corp")

    assert "No job changes detected" in result


def test_enrich_contact_data_returns_string():
    """enrich_contact_data returns formatted enrichment summary."""
    from outreach_intel.enrichment.base import EnrichedPerson, EnrichedCompany, EnrichmentResult, HiringSignal
    from outreach_intel.signal_tools import enrich_contact_data

    mock_result = EnrichmentResult(
        person=EnrichedPerson(
            email="sarah@acme.com", email_confidence=0.95,
            title="VP Lending", linkedin_url="https://li.com/sarah",
        ),
        company=EnrichedCompany(
            name="Acme Financial", industry="Financial Services",
            employee_count=500, revenue="$50M", tech_stack=["Encompass"],
        ),
        hiring_signals=[HiringSignal(job_title="Lending Ops")],
        provider="apollo", credits_used=3,
    )

    with patch("outreach_intel.enrichment.EnrichmentService") as MockService:
        MockService.return_value.enrich_contact.return_value = mock_result
        result = enrich_contact_data(first_name="Sarah", last_name="Chen", company="Acme")

    assert isinstance(result, str)
    assert "sarah@acme.com" in result
    assert "Encompass" in result


def test_check_company_hiring_returns_string():
    """check_company_hiring returns job posting summary."""
    from outreach_intel.enrichment.base import EnrichedCompany, HiringSignal
    from outreach_intel.signal_tools import check_company_hiring

    mock_org = EnrichedCompany(name="Acme Financial", raw={"id": "org-1"})
    mock_signals = [HiringSignal(job_title="Verification Ops Manager", department="Operations")]

    with patch("outreach_intel.enrichment.ApolloClient") as MockClient:
        instance = MockClient.return_value
        instance.enrich_organization.return_value = mock_org
        instance.get_job_postings.return_value = mock_signals
        result = check_company_hiring("acme.com")

    assert isinstance(result, str)
    assert "Verification Ops Manager" in result


def test_detect_job_change_returns_string():
    """detect_job_change returns change description."""
    from outreach_intel.enrichment.base import EnrichedPerson
    from outreach_intel.signal_tools import detect_job_change

    mock_person = EnrichedPerson(
        employment_history=[
            {"title": "VP Lending", "company": "Acme Financial", "current": True},
        ],
    )

    with patch("outreach_intel.enrichment.ApolloClient") as MockClient:
        MockClient.return_value.enrich_person.return_value = mock_person
        result = detect_job_change("Sarah", "Chen", known_title="Director", known_company="Acme Financial")

    assert isinstance(result, str)
    assert "Title changed" in result


def test_get_form_context_returns_form_fields():
    """get_form_context pulls form submission fields from HubSpot."""
    mock_client = MagicMock()
    mock_client.get_contact.return_value = {
        "properties": {
            "firstname": "Rick",
            "lastname": "Pommenville",
            "use_case": "Fintech / Retail banking",
            "how_many_loans_do_you_close_per_year": "30,000-100,000",
            "job_function_contact": "Risk & Compliance",
            "which_of_these_best_describes_your_job_title_": "Director",
            "message": "Looking to bolster our approval capabilities",
            "hs_analytics_first_referrer": "https://truv.com/solutions/consumer-lending",
            "how_can_we_help": "Contact sales",
            "ecarr": "",
            "target_account": "false",
        },
    }

    with patch("outreach_intel.signal_tools.HubSpotClient", return_value=mock_client):
        from outreach_intel.signal_tools import get_form_context
        result = get_form_context("12345")

    assert "Fintech / Retail banking" in result
    assert "30,000-100,000" in result
    assert "Risk & Compliance" in result
    assert "Director" in result
    assert "consumer-lending" in result
    assert "approval capabilities" in result


def test_get_hubspot_activity_returns_string():
    """get_hubspot_activity returns formatted activity summary."""
    mock_contact = {
        "id": "123",
        "properties": {
            "firstname": "Sarah",
            "lastname": "Chen",
            "email": "sarah@example.com",
            "jobtitle": "VP Lending",
            "company": "Pacific Federal CU",
            "hs_email_last_open_date": "2026-03-01T00:00:00Z",
            "hs_email_last_click_date": "2026-02-28T00:00:00Z",
            "notes_last_updated": "2026-01-15T00:00:00Z",
            "lifecyclestage": "268636563",
            "hs_lead_status": None,
        }
    }

    with patch("outreach_intel.signal_tools.HubSpotClient") as MockClient:
        instance = MockClient.return_value
        instance.get_contact.return_value = mock_contact
        instance.get_contact_deals.return_value = []
        result = get_hubspot_activity("123")

    assert isinstance(result, str)
    assert "Sarah" in result
    assert "VP Lending" in result
