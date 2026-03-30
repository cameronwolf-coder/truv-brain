"""Pipeline C — Dashboard signup scoring and processing."""

import logging
import re
from datetime import datetime, timezone
from typing import Optional

import requests

from outreach_intel.hubspot_client import HubSpotClient
from truv_scout.models import DashboardSignupPayload, PipelineResult
from truv_scout.pipeline import SCORE_PROPERTIES
from truv_scout.settings import get_settings

logger = logging.getLogger(__name__)

# DashBot bot_id in #dashboard-signups
DASHBOT_ID = "B03QZ1E1T8X"
CHANNEL_ID = "C01Q21S292A"

# Lifecycle stages that should NOT be scored (active customers, opps, etc.)
EXCLUDED_STAGES = {
    "opportunity", "customer", "live customer",
    "indirect customer", "advocate", "disqualified",
}

# Personal email domains — score but don't alert Slack
PERSONAL_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "aol.com", "icloud.com", "mail.com", "protonmail.com",
    "ymail.com", "live.com", "msn.com", "comcast.net",
}

# Cooldown: skip if scored within this many days
SCORE_COOLDOWN_DAYS = 7


def parse_dashbot_message(text: str) -> Optional[dict]:
    """Parse a DashBot signup notification into structured data.

    Expected formats:
      [From Action] New User: FULL NAME <mailto:email|email>. Invite details below ↓.
      [From Action] New User: FULL NAME <mailto:email|email>. Website form submitted for company: COMPANY.

    Returns:
        Dict with email, full_name, company or None if parsing fails.
    """
    match = re.search(r"New User:\s*(.+?)\s*<mailto:(.+?)\|", text)
    if not match:
        return None

    full_name = match.group(1).strip()
    email = match.group(2).strip().lower()

    company = ""
    company_match = re.search(r"company:\s*(.+?)\.", text)
    if company_match:
        company = company_match.group(1).strip()

    return {"full_name": full_name, "email": email, "company": company}


def is_personal_email(email: str) -> bool:
    """Check if an email is from a personal domain."""
    domain = email.split("@")[-1].lower() if "@" in email else ""
    return domain in PERSONAL_DOMAINS


def find_or_create_contact(
    email: str,
    first_name: str = "",
    last_name: str = "",
    company: str = "",
) -> dict:
    """Look up email in HubSpot. Create contact if not found.

    Args:
        email: Contact email (required).
        first_name: First name.
        last_name: Last name.
        company: Company name.

    Returns:
        HubSpot contact record dict.
    """
    client = HubSpotClient()

    # Try lookup first
    existing = client.get_contact_by_email(email, properties=SCORE_PROPERTIES)
    if existing:
        return existing

    # Create new contact
    properties = {
        "email": email,
        "firstname": first_name,
        "lastname": last_name,
        "company": company,
        "lifecyclestage": "lead",
        "hs_lead_status": "NEW",
    }
    # Remove empty values
    properties = {k: v for k, v in properties.items() if v}

    created = client.create_contact(properties)
    logger.info(f"[dashboard] Created HubSpot contact for {email}: {created.get('id')}")
    return created


def should_score_contact(contact: dict) -> tuple[bool, str]:
    """Check guards: lifecycle exclusion and cooldown.

    Returns:
        (should_score, reason) — reason is empty if should_score is True.
    """
    props = contact.get("properties", {})

    # Guard 1: Lifecycle stage exclusion
    stage = (props.get("lifecyclestage") or "").lower()
    if stage in EXCLUDED_STAGES:
        return False, f"excluded lifecycle stage: {stage}"

    # Guard 2: Cooldown — skip if scored within SCORE_COOLDOWN_DAYS
    scored_at_str = props.get("scout_scored_at")
    if scored_at_str:
        try:
            scored_at = datetime.fromisoformat(scored_at_str.replace("Z", "+00:00"))
            days_since = (datetime.now(timezone.utc) - scored_at).days
            if days_since < SCORE_COOLDOWN_DAYS:
                return False, f"scored {days_since} days ago (cooldown: {SCORE_COOLDOWN_DAYS}d)"
        except (ValueError, TypeError):
            pass  # Can't parse — proceed with scoring

    return True, ""


def process_dashboard_signup(payload: DashboardSignupPayload) -> Optional[PipelineResult]:
    """Process a single dashboard signup end-to-end.

    1. Split full_name into first/last
    2. Find or create HubSpot contact
    3. Check guards (lifecycle, cooldown)
    4. Run Scout scoring pipeline
    5. Write back to HubSpot with scout_source=dashboard_signup
    6. Notify Slack if hot/enterprise (skip for personal emails)

    Returns:
        PipelineResult if scored, None if skipped.
    """
    from truv_scout.completion_callback import fire_completion_webhook
    from truv_scout.hubspot_writer import write_scores_to_hubspot
    from truv_scout.pipeline import run_pipeline
    from truv_scout.slack import notify_slack

    # Split name
    name_parts = payload.full_name.strip().split(None, 1)
    first_name = name_parts[0] if name_parts else ""
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    # Find or create contact
    contact = find_or_create_contact(
        email=payload.email,
        first_name=first_name,
        last_name=last_name,
        company=payload.company,
    )
    contact_id = contact.get("id")
    if not contact_id:
        logger.error(f"[dashboard] No contact ID for {payload.email}")
        return None

    # Check guards
    should_score, reason = should_score_contact(contact)
    if not should_score:
        logger.info(f"[dashboard] Skipping {payload.email}: {reason}")
        return None

    # Run pipeline
    try:
        result = run_pipeline(contact_id=contact_id, source="dashboard_signup")
    except Exception as e:
        logger.error(f"[dashboard] Pipeline error for {payload.email}: {e}")
        return None

    # Write back with source tag
    write_scores_to_hubspot(result, source="dashboard_signup")
    fire_completion_webhook(result, source="dashboard_signup")

    # Slack notify — hot/enterprise only, skip personal emails
    if result.final_tier == "hot" or result.final_routing == "enterprise":
        if not is_personal_email(payload.email):
            notify_slack(result)

    return result


# ── Backlog Batch ──────────────────────────────────────────────────


def get_dashboard_signups_from_slack(
    limit: int = 200,
    oldest: str = "",
) -> list[dict]:
    """Paginate Slack conversations.history for DashBot messages.

    Filters by bot_id B03QZ1E1T8X, parses each message.

    Args:
        limit: Max number of signup messages to return.
        oldest: Slack timestamp to start from (for resume/checkpoint).

    Returns:
        List of dicts with email, full_name, company, slack_ts.
    """
    token = get_settings().slack_bot_token
    if not token:
        logger.error("[dashboard] No SLACK_BOT_TOKEN env var set")
        return []

    signups = []
    cursor = None
    api_url = "https://slack.com/api/conversations.history"

    while len(signups) < limit:
        params: dict = {"channel": CHANNEL_ID, "limit": 200}
        if oldest:
            params["oldest"] = oldest
        if cursor:
            params["cursor"] = cursor

        resp = requests.get(
            api_url,
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            timeout=15,
        )
        data = resp.json()
        if not data.get("ok"):
            logger.error(f"[dashboard] Slack API error: {data.get('error')}")
            break

        for msg in data.get("messages", []):
            if msg.get("bot_id") != DASHBOT_ID:
                continue
            parsed = parse_dashbot_message(msg.get("text", ""))
            if parsed:
                parsed["slack_ts"] = msg.get("ts", "")
                signups.append(parsed)
                if len(signups) >= limit:
                    break

        # Pagination
        next_cursor = data.get("response_metadata", {}).get("next_cursor")
        if not next_cursor:
            break
        cursor = next_cursor

    return signups


def run_dashboard_backlog_batch(
    limit: int = 200,
    dry_run: bool = False,
    oldest: str = "",
) -> list[PipelineResult]:
    """Batch score historical Dashboard signups from Slack channel history.

    Args:
        limit: Max signups to process.
        dry_run: If True, score but don't write to HubSpot.
        oldest: Slack ts to resume from.

    Returns:
        List of PipelineResult for scored contacts.
    """
    from truv_scout.completion_callback import fire_completion_webhook
    from truv_scout.hubspot_writer import write_scores_to_hubspot
    from truv_scout.pipeline import run_pipeline

    signups = get_dashboard_signups_from_slack(limit=limit, oldest=oldest)
    results: list[PipelineResult] = []

    for i, signup in enumerate(signups, 1):
        email = signup["email"]
        name_parts = signup["full_name"].strip().split(None, 1)
        first_name = name_parts[0] if name_parts else ""
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        try:
            contact = find_or_create_contact(
                email=email,
                first_name=first_name,
                last_name=last_name,
                company=signup.get("company", ""),
            )
            contact_id = contact.get("id")
            if not contact_id:
                continue

            should_score, reason = should_score_contact(contact)
            if not should_score:
                logger.info(f"[{i}/{len(signups)}] Skipped: {reason} ({email})")
                continue

            result = run_pipeline(contact_id=contact_id, source="dashboard_signup")
            if not dry_run:
                write_scores_to_hubspot(result, source="dashboard_signup")
                fire_completion_webhook(result, source="dashboard_signup")
            results.append(result)

            tier_emoji = {"hot": "🔥", "warm": "🟡", "cold": "🔵"}.get(result.final_tier, "⚪")
            logger.info(f"[{i}/{len(signups)}] {tier_emoji} {result.final_score:.0f} {result.final_tier:5s} {result.final_routing:15s} {email}")

        except Exception as e:
            logger.error(f"[{i}/{len(signups)}] Error scoring {email}: {e}")

    return results
