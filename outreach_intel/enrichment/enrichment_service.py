"""Enrichment service — CSV pipeline and HubSpot sync."""

import csv
from pathlib import Path
from typing import Any, Optional

from outreach_intel.enrichment.apollo_client import ApolloClient
from outreach_intel.enrichment.base import (
    EnrichedPerson,
    EnrichedCompany,
    EnrichmentResult,
    HiringSignal,
)


def _fuzzy_match_columns(
    csv_headers: list[str],
    target_columns: list[str],
) -> dict[str, str]:
    """Build a {target_column: csv_column} mapping using fuzzy matching."""

    def normalize(s: str) -> str:
        return s.lower().replace("_", " ").replace("-", " ").strip()

    mapping = {}
    normalized_targets = {normalize(t): t for t in target_columns}

    for header in csv_headers:
        norm = normalize(header)
        if norm in normalized_targets:
            mapping[normalized_targets[norm]] = header
        else:
            for norm_target, original in normalized_targets.items():
                if norm_target in norm or norm in norm_target:
                    if original not in mapping:
                        mapping[original] = header

    return mapping


class EnrichmentService:
    """Orchestrator for CSV enrichment and HubSpot sync."""

    def __init__(self, apollo_client: Optional[ApolloClient] = None):
        self.apollo = apollo_client or ApolloClient()

    # ── CSV Mode (Use Case 1) ──────────────────────────────────────

    def enrich_from_csv(
        self,
        csv_path: str,
        output_path: Optional[str] = None,
    ) -> list[EnrichmentResult]:
        """Enrich contacts from a CSV file (email finding).

        Reads CSV, matches columns, batches via Apollo bulk match,
        writes enriched CSV with email + linkedin_url columns.
        """
        path = Path(csv_path)
        with open(path, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        if not rows:
            return []

        csv_headers = list(rows[0].keys())
        target_cols = ["first name", "last name", "company", "title", "domain"]
        col_map = _fuzzy_match_columns(csv_headers, target_cols)

        # Build person dicts for Apollo
        people = []
        for row in rows:
            person: dict[str, Any] = {
                "first_name": row.get(col_map.get("first name", ""), ""),
                "last_name": row.get(col_map.get("last name", ""), ""),
            }
            if "company" in col_map:
                person["company"] = row.get(col_map["company"], "")
            if "domain" in col_map:
                person["domain"] = row.get(col_map["domain"], "")
            people.append(person)

        # Batch in groups of 10
        results: list[EnrichmentResult] = []
        enriched_people: list[EnrichedPerson] = []

        for i in range(0, len(people), 10):
            batch = people[i : i + 10]
            batch_results = self.apollo.enrich_person_bulk(batch)
            enriched_people.extend(batch_results)

            for ep in batch_results:
                results.append(
                    EnrichmentResult(
                        person=ep, provider="apollo", credits_used=1
                    )
                )

        # Write enriched CSV
        if output_path and rows:
            fieldnames = list(rows[0].keys()) + [
                "email",
                "linkedin_url",
                "email_confidence",
            ]
            with open(output_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for i, row in enumerate(rows):
                    enriched = (
                        enriched_people[i]
                        if i < len(enriched_people)
                        else EnrichedPerson()
                    )
                    row["email"] = enriched.email or ""
                    row["linkedin_url"] = enriched.linkedin_url or ""
                    row["email_confidence"] = (
                        str(enriched.email_confidence)
                        if enriched.email_confidence
                        else ""
                    )
                    writer.writerow(row)

        return results

    # ── Contact Mode (Use Case 2) ──────────────────────────────────

    def enrich_contact(
        self,
        email: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        company: Optional[str] = None,
        domain: Optional[str] = None,
    ) -> EnrichmentResult:
        """Full enrichment for a single contact.

        Calls person match + org enrichment + job postings.
        """
        return self.apollo.enrich_full(
            first_name=first_name or "",
            last_name=last_name or "",
            company=company,
            email=email,
            domain=domain,
        )

    def sync_to_hubspot(
        self,
        result: EnrichmentResult,
        contact_id: str,
        hubspot_client: Any,
    ) -> None:
        """Write enrichment data back to HubSpot contact."""
        props: dict[str, str] = {}

        if result.person:
            if result.person.linkedin_url:
                props["linkedin_url"] = result.person.linkedin_url

        if result.company:
            if result.company.domain:
                props["company_domain"] = result.company.domain
            if result.company.employee_count is not None:
                props["numberofemployees"] = str(result.company.employee_count)
            if result.company.revenue:
                props["annualrevenue"] = str(result.company.revenue)
            if result.company.tech_stack:
                props["tech_stack"] = "; ".join(result.company.tech_stack[:20])
            if result.company.industry:
                props["industry"] = result.company.industry

        if props:
            hubspot_client.update_contact(contact_id, props)

    # ── Job Change Detection ────────────────────────────────────────

    def detect_job_changes(
        self, contacts: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Compare Apollo employment history against stored HubSpot data.

        Returns contacts where a title or company change is detected.
        """
        changed = []

        for contact in contacts:
            first = contact.get("firstname", "")
            last = contact.get("lastname", "")
            known_title = contact.get("jobtitle", "")
            known_company = contact.get("company", "")

            if not first or not last:
                continue

            person = self.apollo.enrich_person(
                first_name=first,
                last_name=last,
                company=known_company,
                email=contact.get("email"),
            )

            if not person.employment_history:
                continue

            current = next(
                (e for e in person.employment_history if e.get("current")),
                person.employment_history[0] if person.employment_history else None,
            )

            if not current:
                continue

            new_title = current.get("title", "")
            new_company = current.get("company", "")

            title_changed = (
                known_title
                and new_title
                and known_title.lower() != new_title.lower()
            )
            company_changed = (
                known_company
                and new_company
                and known_company.lower() != new_company.lower()
            )

            if title_changed or company_changed:
                changed.append({
                    **contact,
                    "change_type": (
                        "company_change" if company_changed else "title_change"
                    ),
                    "old_title": known_title,
                    "new_title": new_title,
                    "old_company": known_company,
                    "new_company": new_company,
                })

        return changed
