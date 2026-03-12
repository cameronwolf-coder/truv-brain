"""TAM (Total Addressable Market) extraction and wave sizing.

Pulls Truv's full addressable market from HubSpot, breaks it down by
vertical and persona, and calculates wave sizes for 45-day cycling.

Queries by vertical segment to bypass HubSpot's 10K search result limit.

Usage:
    python -m outreach_intel.cli tam
    python -m outreach_intel.cli tam --verticals Bank,IMB,"Credit Union"
    python -m outreach_intel.cli tam-waves --wave-size 2500 --cycle-days 45
"""

import math
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Optional

from .config import (
    DEFAULT_CONTACT_PROPERTIES,
    EXCLUDED_LIFECYCLE_STAGES,
)
from .hubspot_client import HubSpotClient


# Persona patterns — mirrors service.py but centralized here for TAM use
PERSONA_PATTERNS: dict[str, list[str]] = {
    "coo_ops": ["COO", "Chief Operating", "VP Operations", "VP of Operations"],
    "cfo": ["CFO", "Chief Financial", "VP Finance", "Controller"],
    "cto": ["CTO", "Chief Technology", "VP Engineering", "CIO"],
    "ceo": ["CEO", "Chief Executive", "Founder", "President", "Owner"],
    "vp_ops": ["VP", "Director", "SVP", "EVP"],
}

# All known sales_vertical values in HubSpot (Title Case as stored)
ALL_VERTICALS = [
    "Bank",
    "Credit Union",
    "IMB",
    "Background Screening",
    "Fintech",
    "Lending",
    "Government",
    "Channel Partner",
    "Tenant Screening",
    "Auto Lending",
    "Home Equity Lender",
    "Other",
]

# Properties needed for TAM analysis (superset of default)
TAM_PROPERTIES = DEFAULT_CONTACT_PROPERTIES + [
    "outreach_status",
    "last_outreach_wave_date",
    "outreach_wave_count",
    "outreach_wave_angle",
]

# Base filters used across all TAM/wave queries
BASE_FILTERS = [
    {
        "propertyName": "lifecyclestage",
        "operator": "NOT_IN",
        "values": EXCLUDED_LIFECYCLE_STAGES,
    },
    {
        "propertyName": "email",
        "operator": "HAS_PROPERTY",
    },
]


@dataclass
class TAMReport:
    """Summary of the total addressable market."""

    total: int
    by_vertical: dict[str, int] = field(default_factory=dict)
    by_persona: dict[str, int] = field(default_factory=dict)
    by_outreach_status: dict[str, int] = field(default_factory=dict)
    wave_eligible: int = 0
    contacts: list[dict[str, Any]] = field(default_factory=list)


def classify_persona(jobtitle: str) -> str:
    """Classify a job title into a persona bucket."""
    if not jobtitle:
        return "unknown"
    title_upper = jobtitle.upper()
    for persona_id, patterns in PERSONA_PATTERNS.items():
        for pattern in patterns:
            if pattern.upper() in title_upper:
                return persona_id
    return "other"


def _paginated_search(
    hs: HubSpotClient,
    filters: list[dict],
    properties: list[str],
    max_results: int = 10000,
) -> list[dict[str, Any]]:
    """Run a paginated HubSpot search up to max_results.

    Uses the paging cursor from the response (not contact IDs).
    """
    collected: list[dict[str, Any]] = []
    after = None

    while len(collected) < max_results:
        body: dict[str, Any] = {
            "limit": 100,
            "properties": properties,
            "filterGroups": [{"filters": filters}],
        }
        if after:
            body["after"] = after

        response = hs.post("/crm/v3/objects/contacts/search", json_data=body)
        results = response.get("results", [])

        if not results:
            break

        collected.extend(results)

        paging = response.get("paging", {})
        after = paging.get("next", {}).get("after")

        if not after or len(results) < 100:
            break

    return collected


def _count_segment(hs: HubSpotClient, extra_filters: list[dict]) -> int:
    """Get the total count for a search without fetching all results."""
    body: dict[str, Any] = {
        "limit": 1,
        "properties": ["email"],
        "filterGroups": [{"filters": BASE_FILTERS + extra_filters}],
    }
    response = hs.post("/crm/v3/objects/contacts/search", json_data=body)
    return response.get("total", 0)


def extract_tam(
    client: Optional[HubSpotClient] = None,
    verticals: Optional[list[str]] = None,
    personas: Optional[list[str]] = None,
    count_only: bool = False,
) -> TAMReport:
    """Pull the full TAM from HubSpot with breakdowns.

    Queries each vertical separately to bypass the 10K search limit.
    Use count_only=True for fast counts without fetching contact records.

    Args:
        client: HubSpot client (creates one if not provided)
        verticals: Filter to specific verticals (e.g. ["Bank", "IMB"])
        personas: Filter to specific personas (e.g. ["coo_ops", "cfo"])
        count_only: If True, only return counts (much faster for large TAMs)

    Returns:
        TAMReport with counts, breakdowns, and optionally raw contacts
    """
    hs = client or HubSpotClient()

    # Determine which verticals to query
    target_verticals = verticals or ALL_VERTICALS
    include_no_vertical = not verticals  # Only include untagged contacts when querying all

    vertical_counts: Counter[str] = Counter()
    persona_counts: Counter[str] = Counter()
    status_counts: Counter[str] = Counter()
    wave_eligible_count = 0
    all_contacts: list[dict[str, Any]] = []

    print("Extracting TAM from HubSpot (by vertical segment)...", flush=True)

    for vertical in target_verticals:
        vertical_filter = [
            {"propertyName": "sales_vertical", "operator": "EQ", "value": vertical},
        ]

        if count_only:
            count = _count_segment(hs, vertical_filter)
            vertical_counts[vertical] = count
            wave_eligible_count += count  # Approximate — all non-excluded are eligible
            print(f"  {vertical:<25} {count:>7,}", flush=True)
        else:
            segment = _paginated_search(
                hs,
                filters=BASE_FILTERS + vertical_filter,
                properties=TAM_PROPERTIES,
            )
            print(f"  {vertical:<25} {len(segment):>7,}", flush=True)

            for contact in segment:
                props = contact.get("properties", {})
                persona = classify_persona(props.get("jobtitle", ""))
                outreach_status = props.get("outreach_status") or "none"

                if personas and persona not in personas:
                    continue

                vertical_counts[vertical] += 1
                persona_counts[persona] += 1
                status_counts[outreach_status] += 1

                if outreach_status not in ("active", "unsubscribed", "customer"):
                    wave_eligible_count += 1

                all_contacts.append(contact)

    # Query contacts with no vertical set
    if include_no_vertical:
        no_vertical_filter = [
            {"propertyName": "sales_vertical", "operator": "NOT_HAS_PROPERTY"},
        ]

        if count_only:
            count = _count_segment(hs, no_vertical_filter)
            vertical_counts["(no vertical)"] = count
            wave_eligible_count += count
            print(f"  {'(no vertical)':<25} {count:>7,}", flush=True)
        else:
            segment = _paginated_search(
                hs,
                filters=BASE_FILTERS + no_vertical_filter,
                properties=TAM_PROPERTIES,
            )
            print(f"  {'(no vertical)':<25} {len(segment):>7,}", flush=True)

            for contact in segment:
                props = contact.get("properties", {})
                persona = classify_persona(props.get("jobtitle", ""))
                outreach_status = props.get("outreach_status") or "none"

                if personas and persona not in personas:
                    continue

                vertical_counts["(no vertical)"] += 1
                persona_counts[persona] += 1
                status_counts[outreach_status] += 1

                if outreach_status not in ("active", "unsubscribed", "customer"):
                    wave_eligible_count += 1

                all_contacts.append(contact)

    total = sum(vertical_counts.values())
    print(f"  {'TOTAL':<25} {total:>7,}", flush=True)

    return TAMReport(
        total=total,
        by_vertical=dict(vertical_counts.most_common()),
        by_persona=dict(persona_counts.most_common()),
        by_outreach_status=dict(status_counts.most_common()),
        wave_eligible=wave_eligible_count,
        contacts=all_contacts,
    )


def calculate_waves(
    tam_size: int,
    wave_size: int,
    cycle_days: int = 45,
) -> dict[str, Any]:
    """Calculate wave schedule for full TAM coverage.

    Args:
        tam_size: Total contacts in TAM
        wave_size: Contacts per wave
        cycle_days: Days to complete full TAM cycle

    Returns:
        Dict with wave count, frequency, and schedule
    """
    if tam_size == 0 or wave_size == 0:
        return {"error": "TAM size and wave size must be > 0"}

    total_waves = math.ceil(tam_size / wave_size)
    days_between_waves = cycle_days / total_waves if total_waves > 0 else 0

    # Infrastructure requirements (2 emails per contact in each wave)
    emails_per_wave = wave_size * 2
    # At 5 emails/inbox/day, how many inbox-days needed per wave?
    # Each wave runs over ~4 days (email 1 day 0, email 2 day 3-4)
    inboxes_needed = math.ceil(wave_size / (5 * 4))  # 5 emails/inbox/day, 4 sending days

    return {
        "tam_size": tam_size,
        "wave_size": wave_size,
        "cycle_days": cycle_days,
        "total_waves": total_waves,
        "days_between_waves": round(days_between_waves, 1),
        "emails_per_wave": emails_per_wave,
        "emails_per_cycle": tam_size * 2,
        "inboxes_needed": inboxes_needed,
        "domains_needed": math.ceil(inboxes_needed / 50),  # 50 inboxes per domain
    }
