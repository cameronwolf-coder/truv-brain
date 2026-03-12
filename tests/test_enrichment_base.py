"""Tests for enrichment base types."""

from outreach_intel.enrichment.base import (
    EnrichedPerson,
    EnrichedCompany,
    HiringSignal,
    EnrichmentResult,
)


def test_enriched_person_defaults():
    """EnrichedPerson has sensible defaults."""
    p = EnrichedPerson()
    assert p.email is None
    assert p.employment_history == []
    assert p.raw == {}


def test_enriched_person_with_data():
    """EnrichedPerson holds all fields."""
    p = EnrichedPerson(
        email="sarah@acme.com",
        email_confidence=0.95,
        linkedin_url="https://linkedin.com/in/sarah",
        title="VP Lending",
        seniority="vp",
        department="operations",
        company_name="Acme Financial",
        company_domain="acme.com",
        employment_history=[{"title": "Director", "company": "Acme", "current": False}],
    )
    assert p.email == "sarah@acme.com"
    assert p.email_confidence == 0.95
    assert len(p.employment_history) == 1


def test_enriched_company_defaults():
    """EnrichedCompany has sensible defaults."""
    c = EnrichedCompany()
    assert c.name is None
    assert c.tech_stack == []
    assert c.raw == {}


def test_enriched_company_with_data():
    """EnrichedCompany holds firmographic data."""
    c = EnrichedCompany(
        name="Acme Financial",
        domain="acme.com",
        industry="Financial Services",
        employee_count=500,
        revenue="$50M-$100M",
        tech_stack=["Salesforce", "Encompass"],
        funding_total=25000000.0,
        hq_location="Austin, TX",
    )
    assert c.employee_count == 500
    assert "Encompass" in c.tech_stack


def test_hiring_signal():
    """HiringSignal holds job posting data."""
    s = HiringSignal(
        company_name="Acme",
        job_title="Verification Operations Manager",
        department="Operations",
        location="Remote",
        url="https://example.com/job/123",
    )
    assert s.job_title == "Verification Operations Manager"


def test_enrichment_result_combines_all():
    """EnrichmentResult bundles person + company + hiring."""
    result = EnrichmentResult(
        person=EnrichedPerson(email="test@acme.com"),
        company=EnrichedCompany(name="Acme", employee_count=200),
        hiring_signals=[
            HiringSignal(job_title="Lending Ops"),
            HiringSignal(job_title="Compliance Analyst"),
        ],
        provider="apollo",
        credits_used=3,
    )
    assert result.provider == "apollo"
    assert result.credits_used == 3
    assert len(result.hiring_signals) == 2
    assert result.person.email == "test@acme.com"
    assert result.company.employee_count == 200


def test_enrichment_result_defaults():
    """EnrichmentResult works with no data."""
    result = EnrichmentResult()
    assert result.person is None
    assert result.company is None
    assert result.hiring_signals == []
    assert result.provider == "unknown"
