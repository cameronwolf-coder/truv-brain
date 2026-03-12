"""Shared dataclasses for enrichment providers."""

from dataclasses import dataclass, field
from typing import Any, Optional, Protocol


@dataclass
class EnrichedPerson:
    """Enriched person data from any provider."""

    email: Optional[str] = None
    email_confidence: Optional[float] = None
    linkedin_url: Optional[str] = None
    title: Optional[str] = None
    seniority: Optional[str] = None
    department: Optional[str] = None
    company_name: Optional[str] = None
    company_domain: Optional[str] = None
    employment_history: list[dict[str, Any]] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class EnrichedCompany:
    """Enriched company data from any provider."""

    name: Optional[str] = None
    domain: Optional[str] = None
    industry: Optional[str] = None
    employee_count: Optional[int] = None
    revenue: Optional[str] = None
    tech_stack: list[str] = field(default_factory=list)
    funding_total: Optional[float] = None
    hq_location: Optional[str] = None
    linkedin_url: Optional[str] = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class HiringSignal:
    """A job posting that signals buying intent."""

    company_name: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    url: Optional[str] = None


@dataclass
class EnrichmentResult:
    """Combined enrichment output from a single lookup."""

    person: Optional[EnrichedPerson] = None
    company: Optional[EnrichedCompany] = None
    hiring_signals: list[HiringSignal] = field(default_factory=list)
    provider: str = "unknown"
    credits_used: int = 0


class EnrichmentProvider(Protocol):
    """Protocol that any enrichment provider must implement."""

    def enrich_person(
        self,
        first_name: str,
        last_name: str,
        company: Optional[str] = None,
        email: Optional[str] = None,
    ) -> EnrichedPerson: ...

    def enrich_company(self, domain: str) -> EnrichedCompany: ...

    def get_hiring_signals(
        self, company_domain: str
    ) -> list[HiringSignal]: ...

    def enrich_full(
        self,
        first_name: str,
        last_name: str,
        company: Optional[str] = None,
        email: Optional[str] = None,
    ) -> EnrichmentResult: ...
