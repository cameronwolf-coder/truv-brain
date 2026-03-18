"""Filtered Apollo enrichment for mortgage-relevant tech stacks."""

import json
import logging
from pathlib import Path
from typing import Optional

from outreach_intel.enrichment.apollo_client import ApolloClient
from outreach_intel.enrichment.base import HiringSignal

from truv_scout.models import ScoutEnrichment

logger = logging.getLogger(__name__)

_CONFIG_PATH = Path(__file__).parent.parent / "config" / "tech_stacks.json"


class FilteredApolloEnrichment:
    """Wraps ApolloClient and filters results to mortgage-relevant signals."""

    def __init__(self, api_key: Optional[str] = None):
        self.client = ApolloClient(api_key=api_key)
        with open(_CONFIG_PATH) as f:
            self._config = json.load(f)

        self._los_pos_providers: list[str] = self._config["los_pos"]["providers"]
        self._voi_voe_providers: list[str] = self._config["voi_voe"]["providers"]
        self._voi_voe_legacy: list[str] = self._config["voi_voe"]["legacy"]
        self._voi_voe_competitors: list[str] = self._config["voi_voe"]["modern_competitors"]
        self._hiring_keywords: list[str] = self._config["hiring_keywords"]["keywords"]

    def enrich(
        self,
        email: str,
        first_name: str = "",
        last_name: str = "",
        company: str = "",
        domain: str = "",
    ) -> ScoutEnrichment:
        """Enrich a contact and filter to mortgage-relevant signals.

        Calls Apollo's full enrichment (person + org + job postings),
        then filters tech stack and hiring signals against the
        mortgage-specific config lists.
        """
        result = self.client.enrich_full(
            first_name=first_name,
            last_name=last_name,
            company=company or None,
            email=email or None,
            domain=domain or None,
        )

        tech_stack = result.company.tech_stack if result.company else []
        los_matches = self._filter_tech_stack(tech_stack, self._los_pos_providers)
        voe_matches = self._filter_tech_stack(tech_stack, self._voi_voe_providers)
        filtered_hiring = self._filter_hiring(result.hiring_signals)
        tech_intent = self.classify_tech_intent(los_matches, voe_matches)

        return ScoutEnrichment(
            employee_count=result.company.employee_count if result.company else None,
            revenue=result.company.revenue if result.company else None,
            industry=result.company.industry if result.company else None,
            los_pos_matches=los_matches,
            voi_voe_matches=voe_matches,
            tech_intent=tech_intent,
            filtered_hiring=filtered_hiring,
            person_title=result.person.title if result.person else None,
            person_seniority=result.person.seniority if result.person else None,
            person_linkedin=result.person.linkedin_url if result.person else None,
            company_name=result.company.name if result.company else None,
            company_domain=result.company.domain if result.company else None,
            raw_person=result.person.raw if result.person else {},
            raw_company=result.company.raw if result.company else {},
        )

    def classify_tech_intent(
        self, los_matches: list[str], voe_matches: list[str]
    ) -> str:
        """Determine tech intent category from matched stacks.

        Returns:
            "greenfield"   - has LOS/POS but no VOI/VOE provider
            "displacement" - has LOS/POS and a legacy VOI/VOE provider
            "competitive"  - has LOS/POS and a modern competitor VOI/VOE
            "no-match"     - no LOS/POS detected
        """
        if not los_matches:
            return "no-match"

        if not voe_matches:
            return "greenfield"

        voe_lower = [v.lower() for v in voe_matches]

        # Check legacy first (displacement opportunity is higher priority)
        for legacy in self._voi_voe_legacy:
            if legacy.lower() in voe_lower:
                return "displacement"

        for competitor in self._voi_voe_competitors:
            if competitor.lower() in voe_lower:
                return "competitive"

        # Has VOE matches but they didn't land in legacy or competitor lists
        return "greenfield"

    def _filter_tech_stack(
        self, tech_stack: list[str], target_list: list[str]
    ) -> list[str]:
        """Return tech stack entries that substring-match any target (case-insensitive)."""
        matches = []
        target_lower = [t.lower() for t in target_list]
        for tech in tech_stack:
            tech_lower = tech.lower()
            for target in target_lower:
                if target in tech_lower or tech_lower in target:
                    matches.append(tech)
                    break
        return matches

    def _filter_hiring(self, signals: list[HiringSignal]) -> list[dict]:
        """Keep only hiring signals with mortgage/lending-relevant job titles."""
        filtered = []
        for signal in signals:
            if not signal.job_title:
                continue
            title_lower = signal.job_title.lower()
            if any(kw in title_lower for kw in self._hiring_keywords):
                filtered.append({
                    "job_title": signal.job_title,
                    "department": signal.department,
                    "company_name": signal.company_name,
                    "location": signal.location,
                    "url": signal.url,
                })
        return filtered
