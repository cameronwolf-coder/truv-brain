"""Tests for Apollo API client."""

import pytest
from unittest.mock import patch, MagicMock
from outreach_intel.enrichment.apollo_client import ApolloClient
from outreach_intel.enrichment.base import EnrichedPerson, EnrichedCompany, HiringSignal


@pytest.fixture
def client():
    """Apollo client with test key."""
    return ApolloClient(api_key="test-key")


def _mock_response(json_data, status_code=200):
    """Build a mock requests.Response."""
    mock = MagicMock()
    mock.status_code = status_code
    mock.content = b"data"
    mock.json.return_value = json_data
    mock.raise_for_status = MagicMock()
    return mock


class TestEnrichPerson:
    def test_maps_to_enriched_person(self, client):
        response_data = {
            "person": {
                "email": "sarah@acme.com",
                "email_confidence": 0.95,
                "linkedin_url": "https://linkedin.com/in/sarah",
                "title": "VP Lending",
                "seniority": "vp",
                "department": "operations",
                "organization": {"name": "Acme Financial", "primary_domain": "acme.com"},
                "employment_history": [
                    {"title": "VP Lending", "organization_name": "Acme Financial", "current": True},
                    {"title": "Director", "organization_name": "Old Corp", "current": False},
                ],
            }
        }

        with patch("outreach_intel.enrichment.apollo_client.requests.request") as mock_req:
            mock_req.return_value = _mock_response(response_data)
            result = client.enrich_person("Sarah", "Chen", company="Acme Financial")

        assert isinstance(result, EnrichedPerson)
        assert result.email == "sarah@acme.com"
        assert result.email_confidence == 0.95
        assert result.title == "VP Lending"
        assert result.company_domain == "acme.com"
        assert len(result.employment_history) == 2

    def test_sends_waterfall_when_no_email(self, client):
        with patch("outreach_intel.enrichment.apollo_client.requests.request") as mock_req:
            mock_req.return_value = _mock_response({"person": {}})
            client.enrich_person("John", "Doe", company="Acme")

        call_kwargs = mock_req.call_args
        body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
        assert body["run_waterfall_email"] is True
        assert body.get("email") is None

    def test_sends_email_when_provided(self, client):
        with patch("outreach_intel.enrichment.apollo_client.requests.request") as mock_req:
            mock_req.return_value = _mock_response({"person": {}})
            client.enrich_person("John", "Doe", email="john@acme.com")

        call_kwargs = mock_req.call_args
        body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
        assert body["email"] == "john@acme.com"
        assert "run_waterfall_email" not in body


class TestEnrichPersonBulk:
    def test_returns_list_of_enriched_persons(self, client):
        response_data = {
            "matches": [
                {"email": "a@acme.com", "title": "VP", "organization": {}, "employment_history": []},
                {"email": "b@acme.com", "title": "Dir", "organization": {}, "employment_history": []},
            ]
        }

        with patch("outreach_intel.enrichment.apollo_client.requests.request") as mock_req:
            mock_req.return_value = _mock_response(response_data)
            results = client.enrich_person_bulk([
                {"first_name": "A", "last_name": "One"},
                {"first_name": "B", "last_name": "Two"},
            ])

        assert len(results) == 2
        assert all(isinstance(r, EnrichedPerson) for r in results)
        assert results[0].email == "a@acme.com"


class TestEnrichOrganization:
    def test_maps_to_enriched_company(self, client):
        response_data = {
            "organization": {
                "name": "Acme Financial",
                "primary_domain": "acme.com",
                "industry": "Financial Services",
                "estimated_num_employees": 500,
                "estimated_annual_revenue": "$50M-$100M",
                "current_technologies": [{"name": "Encompass"}, {"name": "Salesforce"}],
                "total_funding": 25000000,
                "city": "Austin",
                "state": "TX",
                "linkedin_url": "https://linkedin.com/company/acme",
            }
        }

        with patch("outreach_intel.enrichment.apollo_client.requests.request") as mock_req:
            mock_req.return_value = _mock_response(response_data)
            result = client.enrich_organization("acme.com")

        assert isinstance(result, EnrichedCompany)
        assert result.name == "Acme Financial"
        assert result.employee_count == 500
        assert "Encompass" in result.tech_stack
        assert result.hq_location == "Austin, TX"


class TestGetJobPostings:
    def test_returns_hiring_signals(self, client):
        response_data = {
            "job_postings": [
                {
                    "title": "Verification Ops Manager",
                    "department": "Operations",
                    "location": "Remote",
                    "url": "https://acme.com/jobs/123",
                    "organization_name": "Acme Financial",
                },
            ]
        }

        with patch("outreach_intel.enrichment.apollo_client.requests.request") as mock_req:
            mock_req.return_value = _mock_response(response_data)
            results = client.get_job_postings("org-123")

        assert len(results) == 1
        assert isinstance(results[0], HiringSignal)
        assert results[0].job_title == "Verification Ops Manager"


class TestRateLimitRetry:
    def test_retries_on_429(self, client):
        rate_limited = MagicMock()
        rate_limited.status_code = 429
        rate_limited.content = b""
        rate_limited.raise_for_status = MagicMock()

        success = _mock_response({"person": {"email": "ok@test.com"}})

        with patch("outreach_intel.enrichment.apollo_client.requests.request") as mock_req:
            mock_req.side_effect = [rate_limited, success]
            with patch("outreach_intel.enrichment.apollo_client.time.sleep"):
                result = client.enrich_person("Test", "User")

        assert mock_req.call_count == 2
        assert result.email == "ok@test.com"


class TestEnrichFull:
    def test_combines_person_org_hiring(self, client):
        person_resp = {
            "person": {
                "email": "sarah@acme.com",
                "title": "VP",
                "organization": {"name": "Acme", "primary_domain": "acme.com", "id": "org-1"},
                "employment_history": [],
            }
        }
        org_resp = {
            "organization": {
                "name": "Acme",
                "primary_domain": "acme.com",
                "estimated_num_employees": 200,
            }
        }
        jobs_resp = {
            "job_postings": [
                {"title": "Lending Ops", "organization_name": "Acme"},
            ]
        }

        with patch("outreach_intel.enrichment.apollo_client.requests.request") as mock_req:
            mock_req.side_effect = [
                _mock_response(person_resp),
                _mock_response(org_resp),
                _mock_response(jobs_resp),
            ]
            result = client.enrich_full("Sarah", "Chen", company="Acme")

        assert result.provider == "apollo"
        assert result.credits_used == 3
        assert result.person.email == "sarah@acme.com"
        assert result.company.employee_count == 200
        assert len(result.hiring_signals) == 1
