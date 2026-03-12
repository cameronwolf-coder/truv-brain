"""Tests for enrichment service."""

import csv
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from outreach_intel.enrichment.base import (
    EnrichedCompany,
    EnrichedPerson,
    EnrichmentResult,
    HiringSignal,
)
from outreach_intel.enrichment.enrichment_service import EnrichmentService


def _make_mock_apollo():
    """Build a mock ApolloClient."""
    mock = MagicMock()

    mock.enrich_person_bulk.return_value = [
        EnrichedPerson(email="sarah@acme.com", linkedin_url="https://li.com/sarah", email_confidence=0.95),
        EnrichedPerson(email="john@bank.com", linkedin_url="https://li.com/john", email_confidence=0.88),
    ]

    mock.enrich_full.return_value = EnrichmentResult(
        person=EnrichedPerson(email="sarah@acme.com", linkedin_url="https://li.com/sarah"),
        company=EnrichedCompany(name="Acme", domain="acme.com", employee_count=200),
        hiring_signals=[HiringSignal(job_title="Lending Ops")],
        provider="apollo",
        credits_used=3,
    )

    mock.enrich_person.return_value = EnrichedPerson(
        email="sarah@acme.com",
        employment_history=[
            {"title": "VP Lending", "company": "Acme Financial", "current": True},
            {"title": "Director", "company": "Old Corp", "current": False},
        ],
    )

    return mock


class TestEnrichFromCSV:
    def test_reads_csv_and_writes_enriched(self):
        mock_apollo = _make_mock_apollo()
        service = EnrichmentService(apollo_client=mock_apollo)

        # Create temp input CSV
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["First Name", "Last Name", "Company", "Title"])
            writer.writerow(["Sarah", "Chen", "Acme Financial", "VP Lending"])
            writer.writerow(["John", "Doe", "First National Bank", "Director"])
            input_path = f.name

        output_path = input_path.replace(".csv", "_enriched.csv")

        results = service.enrich_from_csv(input_path, output_path)

        assert len(results) == 2
        assert results[0].provider == "apollo"

        # Check enriched CSV was written
        with open(output_path, newline="") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        assert len(rows) == 2
        assert rows[0]["email"] == "sarah@acme.com"
        assert rows[0]["linkedin_url"] == "https://li.com/sarah"

        # Cleanup
        Path(input_path).unlink(missing_ok=True)
        Path(output_path).unlink(missing_ok=True)

    def test_empty_csv_returns_empty(self):
        mock_apollo = _make_mock_apollo()
        service = EnrichmentService(apollo_client=mock_apollo)

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["First Name", "Last Name", "Company"])
            input_path = f.name

        results = service.enrich_from_csv(input_path)
        assert results == []
        Path(input_path).unlink(missing_ok=True)


class TestEnrichContact:
    def test_returns_full_result(self):
        mock_apollo = _make_mock_apollo()
        service = EnrichmentService(apollo_client=mock_apollo)

        result = service.enrich_contact(
            email="sarah@acme.com",
            first_name="Sarah",
            last_name="Chen",
            company="Acme",
        )

        assert result.provider == "apollo"
        assert result.person.email == "sarah@acme.com"
        assert result.company.employee_count == 200
        assert len(result.hiring_signals) == 1


class TestSyncToHubspot:
    def test_writes_props_to_hubspot(self):
        mock_apollo = _make_mock_apollo()
        service = EnrichmentService(apollo_client=mock_apollo)
        mock_hs = MagicMock()

        result = EnrichmentResult(
            person=EnrichedPerson(linkedin_url="https://li.com/sarah"),
            company=EnrichedCompany(
                domain="acme.com",
                employee_count=200,
                revenue="$50M",
                tech_stack=["Encompass", "Salesforce"],
                industry="Financial Services",
            ),
        )

        service.sync_to_hubspot(result, "contact-123", mock_hs)

        mock_hs.update_contact.assert_called_once()
        call_args = mock_hs.update_contact.call_args
        props = call_args[0][1] if len(call_args[0]) > 1 else call_args[1]["properties"]
        assert props["company_domain"] == "acme.com"
        assert props["numberofemployees"] == "200"
        assert "Encompass" in props["tech_stack"]


class TestDetectJobChanges:
    def test_detects_title_change(self):
        mock_apollo = MagicMock()
        mock_apollo.enrich_person.return_value = EnrichedPerson(
            employment_history=[
                {"title": "VP Lending", "company": "Acme Financial", "current": True},
            ],
        )
        service = EnrichmentService(apollo_client=mock_apollo)

        contacts = [{
            "firstname": "Sarah",
            "lastname": "Chen",
            "jobtitle": "Director",
            "company": "Acme Financial",
            "email": "sarah@acme.com",
        }]

        changed = service.detect_job_changes(contacts)
        assert len(changed) == 1
        assert changed[0]["change_type"] == "title_change"
        assert changed[0]["old_title"] == "Director"
        assert changed[0]["new_title"] == "VP Lending"

    def test_no_change_returns_empty(self):
        mock_apollo = MagicMock()
        mock_apollo.enrich_person.return_value = EnrichedPerson(
            employment_history=[
                {"title": "Director", "company": "Acme Financial", "current": True},
            ],
        )
        service = EnrichmentService(apollo_client=mock_apollo)

        contacts = [{
            "firstname": "Sarah",
            "lastname": "Chen",
            "jobtitle": "Director",
            "company": "Acme Financial",
        }]

        changed = service.detect_job_changes(contacts)
        assert len(changed) == 0
