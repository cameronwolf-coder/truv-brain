"""Apollo.io REST API client for enrichment."""

import os
import time
from typing import Any, Optional

import requests
from dotenv import load_dotenv

from outreach_intel.enrichment.base import (
    EnrichedPerson,
    EnrichedCompany,
    HiringSignal,
    EnrichmentResult,
)

load_dotenv()


class ApolloClient:
    """Client for Apollo.io enrichment API."""

    BASE_URL = "https://api.apollo.io"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("APOLLO_API_KEY")
        if not self.api_key:
            raise ValueError(
                "Apollo API key required. Set APOLLO_API_KEY env var."
            )

    def _request(
        self,
        method: str,
        endpoint: str,
        json_data: Optional[dict] = None,
        params: Optional[dict] = None,
        max_retries: int = 3,
    ) -> dict[str, Any]:
        """Make authenticated request with exponential backoff."""
        url = f"{self.BASE_URL}{endpoint}"
        headers = {
            "X-Api-Key": self.api_key,
            "Content-Type": "application/json",
        }

        for attempt in range(max_retries):
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                json=json_data,
                params=params,
                timeout=30,
            )

            if response.status_code == 429:
                wait = 2 ** attempt
                time.sleep(wait)
                continue

            response.raise_for_status()

            if response.status_code == 204 or not response.content:
                return {}
            return response.json()

        response.raise_for_status()
        return {}

    # ── People ──────────────────────────────────────────────────────

    def enrich_person(
        self,
        first_name: str,
        last_name: str,
        company: Optional[str] = None,
        email: Optional[str] = None,
        domain: Optional[str] = None,
    ) -> EnrichedPerson:
        """Enrich a single person. 1 credit.

        Uses waterfall email finding when no email is provided.
        """
        body: dict[str, Any] = {
            "first_name": first_name,
            "last_name": last_name,
            "reveal_personal_emails": False,
        }
        if email:
            body["email"] = email
        else:
            body["run_waterfall_email"] = True
        if company:
            body["organization_name"] = company
        if domain:
            body["domain"] = domain

        data = self._request("POST", "/api/v1/people/match", json_data=body)
        return self._map_person(data.get("person", {}))

    def enrich_person_bulk(
        self, people: list[dict[str, Any]]
    ) -> list[EnrichedPerson]:
        """Enrich up to 10 people in one call. 1 credit each."""
        details = []
        for p in people[:10]:
            detail: dict[str, Any] = {
                "first_name": p.get("first_name", ""),
                "last_name": p.get("last_name", ""),
                "reveal_personal_emails": False,
            }
            if p.get("email"):
                detail["email"] = p["email"]
            else:
                detail["run_waterfall_email"] = True
            if p.get("company"):
                detail["organization_name"] = p["company"]
            if p.get("domain"):
                detail["domain"] = p["domain"]
            details.append(detail)

        data = self._request(
            "POST", "/api/v1/people/bulk_match", json_data={"details": details}
        )

        results = []
        for match in data.get("matches", []):
            person_data = match if isinstance(match, dict) else {}
            results.append(self._map_person(person_data))
        return results

    # ── Organizations ───────────────────────────────────────────────

    def enrich_organization(self, domain: str) -> EnrichedCompany:
        """Enrich a company by domain. 1 credit."""
        data = self._request(
            "POST",
            "/api/v1/organizations/enrich",
            json_data={"domain": domain},
        )
        return self._map_company(data.get("organization", {}))

    def enrich_organization_bulk(
        self, domains: list[str]
    ) -> list[EnrichedCompany]:
        """Enrich up to 10 companies by domain. 1 credit each."""
        data = self._request(
            "POST",
            "/api/v1/organizations/bulk_enrich",
            json_data={"domains": domains[:10]},
        )

        results = []
        for org in data.get("organizations", []):
            results.append(self._map_company(org if isinstance(org, dict) else {}))
        return results

    # ── Search (0 credits) ──────────────────────────────────────────

    def search_people(
        self,
        q_organization_domains: Optional[list[str]] = None,
        person_titles: Optional[list[str]] = None,
        page: int = 1,
        per_page: int = 25,
    ) -> dict[str, Any]:
        """Search for people. 0 credits."""
        body: dict[str, Any] = {"page": page, "per_page": per_page}
        if q_organization_domains:
            body["q_organization_domains"] = "\n".join(q_organization_domains)
        if person_titles:
            body["person_titles"] = person_titles
        return self._request(
            "POST", "/api/v1/mixed_people/search", json_data=body
        )

    def search_organizations(
        self,
        q_organization_name: Optional[str] = None,
        organization_domains: Optional[list[str]] = None,
        page: int = 1,
        per_page: int = 25,
    ) -> dict[str, Any]:
        """Search for organizations. 0 credits."""
        body: dict[str, Any] = {"page": page, "per_page": per_page}
        if q_organization_name:
            body["q_organization_name"] = q_organization_name
        if organization_domains:
            body["organization_domains"] = organization_domains
        return self._request(
            "POST", "/api/v1/mixed_companies/search", json_data=body
        )

    # ── Job Postings ────────────────────────────────────────────────

    def get_job_postings(
        self, organization_id: str, page: int = 1, per_page: int = 10
    ) -> list[HiringSignal]:
        """Get active job postings for a company. 1 credit."""
        data = self._request(
            "GET",
            f"/api/v1/organizations/{organization_id}/job_postings",
            params={"page": page, "per_page": per_page},
        )

        signals = []
        for posting in data.get("job_postings", []):
            signals.append(
                HiringSignal(
                    company_name=posting.get("organization_name"),
                    job_title=posting.get("title"),
                    department=posting.get("department"),
                    location=posting.get("location"),
                    url=posting.get("url"),
                )
            )
        return signals

    # ── Full enrichment ─────────────────────────────────────────────

    def enrich_full(
        self,
        first_name: str,
        last_name: str,
        company: Optional[str] = None,
        email: Optional[str] = None,
        domain: Optional[str] = None,
    ) -> EnrichmentResult:
        """Full enrichment: person + org + job postings. ~3 credits."""
        credits = 0

        # Person match
        person = self.enrich_person(
            first_name, last_name, company=company, email=email, domain=domain
        )
        credits += 1

        # Org enrichment (need domain)
        org_domain = domain or person.company_domain
        enriched_company = None
        hiring = []

        if org_domain:
            enriched_company = self.enrich_organization(org_domain)
            credits += 1

            # Job postings (need org ID from raw person data)
            org_id = person.raw.get("organization", {}).get("id")
            if org_id:
                hiring = self.get_job_postings(org_id)
                credits += 1

        return EnrichmentResult(
            person=person,
            company=enriched_company,
            hiring_signals=hiring,
            provider="apollo",
            credits_used=credits,
        )

    # ── Mapping helpers ─────────────────────────────────────────────

    def _map_person(self, data: dict[str, Any]) -> EnrichedPerson:
        """Map Apollo person response to EnrichedPerson."""
        if not data:
            return EnrichedPerson(raw={})

        employment_history = []
        for exp in data.get("employment_history", []):
            employment_history.append({
                "title": exp.get("title"),
                "company": exp.get("organization_name"),
                "start_date": exp.get("start_date"),
                "end_date": exp.get("end_date"),
                "current": exp.get("current", False),
            })

        return EnrichedPerson(
            email=data.get("email"),
            email_confidence=data.get("email_confidence"),
            linkedin_url=data.get("linkedin_url"),
            title=data.get("title"),
            seniority=data.get("seniority"),
            department=data.get("department"),
            company_name=data.get("organization", {}).get("name"),
            company_domain=data.get("organization", {}).get("primary_domain"),
            employment_history=employment_history,
            raw=data,
        )

    def _map_company(self, data: dict[str, Any]) -> EnrichedCompany:
        """Map Apollo organization response to EnrichedCompany."""
        if not data:
            return EnrichedCompany(raw={})

        tech_stack = []
        for tech in data.get("current_technologies", []):
            name = tech.get("name") if isinstance(tech, dict) else str(tech)
            if name:
                tech_stack.append(name)

        hq = ""
        if data.get("city") or data.get("state"):
            parts = [p for p in [data.get("city"), data.get("state")] if p]
            hq = ", ".join(parts)

        revenue = None
        if data.get("estimated_annual_revenue"):
            revenue = data["estimated_annual_revenue"]
        elif data.get("annual_revenue_printed"):
            revenue = data["annual_revenue_printed"]

        return EnrichedCompany(
            name=data.get("name"),
            domain=data.get("primary_domain"),
            industry=data.get("industry"),
            employee_count=data.get("estimated_num_employees"),
            revenue=revenue,
            tech_stack=tech_stack,
            funding_total=data.get("total_funding"),
            hq_location=hq or None,
            linkedin_url=data.get("linkedin_url"),
            raw=data,
        )
