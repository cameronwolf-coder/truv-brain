"""HubSpot tools wrapper for Truv Scout.

Re-exports existing HubSpot tools from outreach_intel.signal_tools
and adds an engagement history analyzer for detecting compounding signals.
"""
from datetime import datetime, timezone
from typing import Optional

from outreach_intel.signal_tools import (
    get_hubspot_activity as _get_hubspot_activity,
    get_form_context as _get_form_context,
)
from outreach_intel.hubspot_client import HubSpotClient


def get_hubspot_activity(contact_id: str) -> str:
    """Pull recent CRM activity for a contact from HubSpot.

    Use this tool to check email engagement, last contact dates,
    lifecycle stage, and deal history. Helps determine if a contact
    is re-engaging or still dormant.

    Args:
        contact_id: HubSpot contact ID.

    Returns:
        Formatted summary of CRM activity for the contact.
    """
    return _get_hubspot_activity(contact_id)


def get_form_context(contact_id: str) -> str:
    """Pull form submission data for an inbound lead from HubSpot.

    Use this tool when analyzing an inbound lead to understand their
    self-reported use case, volume, role, and what they're looking for.
    This data comes from their form submission and is critical for
    understanding their actual needs and scale.

    Key signals to look for:
    - Volume vs company size mismatch (high volume + small team = platform play)
    - Use case alignment with Truv's ICP (lending, fintech, HR verification)
    - Seniority level (Director+ = budget authority)
    - Comments mentioning specific pain points (approval, manual process, compliance)

    Args:
        contact_id: HubSpot contact ID.

    Returns:
        Formatted summary of form submission data and qualifying signals.
    """
    return _get_form_context(contact_id)


ENGAGEMENT_PROPERTIES = [
    "hs_email_last_open_date",
    "hs_email_last_click_date",
    "hs_email_sends_since_last_engagement",
    "notes_last_updated",
    "num_conversion_events",
    "recent_conversion_date",
    "first_conversion_date",
    "firstname",
    "lastname",
]


def get_engagement_history(contact_id: str) -> str:
    """Check for multi-interaction patterns that compound lead signals.

    Use this to detect repeat form fills, email click sequences,
    or returning visitors that indicate active evaluation. Looks
    for patterns like:
    - Multiple conversion events (repeat form fills = high intent)
    - Recent clicks following opens (actively reading content)
    - Returning after a period of dormancy (re-evaluation signal)
    - Time span between first and most recent conversion

    Args:
        contact_id: HubSpot contact ID.

    Returns:
        Summary of interaction patterns and compounding signals.
    """
    client = HubSpotClient()

    try:
        contact = client.get_contact(contact_id, properties=ENGAGEMENT_PROPERTIES)
    except Exception as e:
        return f"Failed to fetch engagement history for contact {contact_id}: {e}"

    props = contact.get("properties", {})
    name = f"{props.get('firstname', '')} {props.get('lastname', '')}".strip() or contact_id

    lines = [f"Engagement history for {name} (ID: {contact_id}):\n"]
    patterns: list[str] = []

    # --- Conversion events ---
    num_conversions = _safe_int(props.get("num_conversion_events"))
    first_conversion = props.get("first_conversion_date")
    recent_conversion = props.get("recent_conversion_date")

    if num_conversions is not None:
        lines.append(f"  Conversion events: {num_conversions}")
        if num_conversions >= 2:
            patterns.append(
                f"REPEAT VISITOR: {num_conversions} conversion events — "
                "indicates sustained interest"
            )

    if first_conversion:
        lines.append(f"  First conversion: {first_conversion}")
    if recent_conversion:
        lines.append(f"  Most recent conversion: {recent_conversion}")

    if first_conversion and recent_conversion and first_conversion != recent_conversion:
        span = _days_between(first_conversion, recent_conversion)
        if span is not None:
            lines.append(f"  Evaluation window: {span} days")
            if span > 30:
                patterns.append(
                    f"LONG EVALUATION: {span}-day span between first and last conversion — "
                    "likely comparing vendors or building internal buy-in"
                )

    # --- Email engagement ---
    last_open = props.get("hs_email_last_open_date")
    last_click = props.get("hs_email_last_click_date")
    sends_since = _safe_int(props.get("hs_email_sends_since_last_engagement"))

    if last_open:
        lines.append(f"  Last email open: {last_open}")
    if last_click:
        lines.append(f"  Last email click: {last_click}")
    if sends_since is not None:
        lines.append(f"  Sends since last engagement: {sends_since}")

    if last_open and last_click:
        click_days = _days_ago(last_click)
        if click_days is not None and click_days <= 14:
            patterns.append(
                "ACTIVE READER: clicked an email within the last 14 days — "
                "actively engaging with content"
            )

    if sends_since is not None and sends_since == 0 and last_open:
        open_days = _days_ago(last_open)
        if open_days is not None and open_days <= 30:
            patterns.append(
                "ENGAGED: zero sends since last engagement and opened within 30 days"
            )

    # --- Dormancy re-engagement ---
    if last_click and recent_conversion:
        click_days = _days_ago(last_click)
        conversion_days = _days_ago(recent_conversion)
        if (
            click_days is not None
            and conversion_days is not None
            and click_days <= 30
            and conversion_days <= 30
        ):
            patterns.append(
                "RE-ENGAGEMENT: recent click AND recent conversion — "
                "contact is actively evaluating again"
            )

    # --- Notes activity ---
    notes_updated = props.get("notes_last_updated")
    if notes_updated:
        lines.append(f"  Last notes update: {notes_updated}")
        notes_days = _days_ago(notes_updated)
        if notes_days is not None and notes_days <= 14:
            patterns.append(
                "SALES ACTIVE: notes updated within 14 days — AE is working this contact"
            )

    # --- Summary ---
    if patterns:
        lines.append("\nCompounding signals detected:")
        for p in patterns:
            lines.append(f"  * {p}")
    else:
        lines.append("\nNo compounding engagement patterns detected.")

    return "\n".join(lines)


def _safe_int(value: Optional[str]) -> Optional[int]:
    """Parse a string to int, returning None on failure."""
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def _parse_date(date_str: str) -> Optional[datetime]:
    """Parse an ISO date string from HubSpot."""
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _days_ago(date_str: str) -> Optional[int]:
    """Calculate days between a date string and now."""
    dt = _parse_date(date_str)
    if dt is None:
        return None
    delta = datetime.now(timezone.utc) - dt
    return max(0, delta.days)


def _days_between(date_str_a: str, date_str_b: str) -> Optional[int]:
    """Calculate days between two date strings."""
    a = _parse_date(date_str_a)
    b = _parse_date(date_str_b)
    if a is None or b is None:
        return None
    return abs((b - a).days)
