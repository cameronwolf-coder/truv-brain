"""Lead scoring and routing for Truv Scout.

Wraps outreach_intel.scorer.ContactScorer and adds routing logic
to classify leads as enterprise, self-service, government, or not-a-lead.
"""

from __future__ import annotations

import re
from typing import Optional

from outreach_intel.scorer import ContactScorer, ScoredContact, parse_volume_range
from truv_scout.models import ScoutEnrichment

# Roles that qualify for enterprise routing
ENTERPRISE_ROLES = {"executive", "vp", "svp", "evp", "c-suite", "director", "senior director"}

# "how_can_we_help" values that disqualify a lead
NOT_A_LEAD_INTENTS = {"log in to truv", "verification help"}

# Use-case keywords that route to government
GOVERNMENT_KEYWORDS = {"public services", "government"}

# Thresholds
ENTERPRISE_APPS_THRESHOLD = 10_000
ENTERPRISE_LOANS_THRESHOLD = 3_000
APOLLO_EMPLOYEE_THRESHOLD = 100
APOLLO_REVENUE_THRESHOLD = 50_000_000  # $50M

_scorer = ContactScorer()


def _parse_revenue(revenue_str: str | None) -> float:
    """Parse Apollo revenue strings into a float in dollars.

    Handles formats like "$50M-$100M", "$1B+", "$10M", "Unknown".
    Returns 0.0 for unparseable values.
    """
    if not revenue_str:
        return 0.0

    cleaned = revenue_str.strip().upper()

    multipliers = {"B": 1_000_000_000, "M": 1_000_000, "K": 1_000}

    # Match patterns like "$50M", "$1.5B", "$100M-$200M", "$1B+"
    # Require suffix for multi-digit numbers to avoid matching bare numbers
    numbers = re.findall(r"\$?([\d.]+)\s*([BMK])", cleaned)
    if not numbers:
        # Fallback: try matching plain numbers (no suffix)
        plain = re.findall(r"\$?([\d.]+)", cleaned)
        if plain:
            try:
                return float(plain[0])
            except ValueError:
                return 0.0
        return 0.0

    values = []
    for num_str, suffix in numbers:
        try:
            value = float(num_str) * multipliers.get(suffix, 1)
            values.append(value)
        except ValueError:
            continue

    # For ranges, return the lower bound; for single values, return as-is
    return min(values) if values else 0.0


def classify_route(
    scored_contact: ScoredContact,
    enrichment: ScoutEnrichment | None = None,
) -> str:
    """Classify a scored contact into a routing bucket.

    Returns one of: "enterprise", "self-service", "government", "not-a-lead".
    """
    props = scored_contact.raw_properties

    # --- Not-a-lead check ---
    how_can_we_help = (
        props.get("how_can_we_help") or props.get("how_can_we_help___forms_") or ""
    ).lower().strip()
    if how_can_we_help in NOT_A_LEAD_INTENTS:
        return "not-a-lead"

    # --- Use case ---
    use_case = (
        props.get("use_case") or props.get("what_s_your_use_case___forms_") or ""
    ).lower().strip()

    # --- Government check ---
    if any(kw in use_case for kw in GOVERNMENT_KEYWORDS):
        return "government"

    # --- Enterprise checks (any one qualifies) ---
    # 1. Senior role
    role = (props.get("which_of_these_best_describes_your_job_title_") or "").lower().strip()
    if role in ENTERPRISE_ROLES:
        return "enterprise"

    # 2. High application volume
    apps_str = props.get("how_many_applications_do_you_see_per_year_")
    apps_low, _ = parse_volume_range(apps_str)
    if apps_low > ENTERPRISE_APPS_THRESHOLD:
        return "enterprise"

    # 3. High loan volume
    loans_str = (
        props.get("how_many_loans_do_you_close_per_year")
        or props.get("how_many_loans_do_you_close_per_year___forms_")
    )
    loans_low, _ = parse_volume_range(loans_str)
    if loans_low > ENTERPRISE_LOANS_THRESHOLD:
        return "enterprise"

    # --- Apollo override: bump self-service to enterprise ---
    if enrichment is not None:
        if (enrichment.employee_count or 0) > APOLLO_EMPLOYEE_THRESHOLD:
            return "enterprise"
        if _parse_revenue(enrichment.revenue) > APOLLO_REVENUE_THRESHOLD:
            return "enterprise"

    # --- Default: self-service ---
    return "self-service"


def classify_tier(score: float) -> str:
    """Classify a score into a tier.

    Returns "hot" (70+), "warm" (40-69), or "cold" (<40).
    """
    if score >= 70:
        return "hot"
    elif score >= 40:
        return "warm"
    return "cold"


def score_and_route(
    contact: dict,
    enrichment: ScoutEnrichment | None = None,
) -> tuple[ScoredContact, str, str]:
    """Score a contact, classify its route, and determine tier.

    Args:
        contact: HubSpot contact record with id and properties.
        enrichment: Optional Apollo enrichment data.

    Returns:
        Tuple of (scored_contact, routing, tier).
    """
    scored = _scorer.score_contact(contact)
    routing = classify_route(scored, enrichment)
    tier = classify_tier(scored.total_score)
    return scored, routing, tier
