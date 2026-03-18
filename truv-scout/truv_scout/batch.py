"""Batch scoring for closed-lost re-engagement.

Prioritizes contacts showing recent buying signals — web visits, email
engagement, content clicks — over contacts with no recent activity.
"""

from datetime import datetime, timedelta
from typing import Optional

from outreach_intel.hubspot_client import HubSpotClient
from truv_scout.hubspot_writer import write_scores_to_hubspot
from truv_scout.models import PipelineResult
from truv_scout.pipeline import run_pipeline

CLOSED_LOST_STAGE = "268636563"
STALE_DAYS = 90

# Properties needed to rank contacts by engagement before scoring
ENGAGEMENT_PROPERTIES = [
    "firstname", "lastname", "email", "company", "jobtitle",
    "lifecyclestage", "outreach_status",
    "hs_analytics_last_visit_timestamp",
    "hs_analytics_num_visits",
    "hs_analytics_last_url",
    "hs_email_last_open_date",
    "hs_email_last_click_date",
    "hs_last_sales_activity_timestamp",
]


def _days_since(date_str: Optional[str]) -> int:
    """Calculate days since a date string. Returns 9999 if unparseable."""
    if not date_str:
        return 9999
    try:
        if "T" in date_str:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        else:
            dt = datetime.fromisoformat(date_str)
        return (datetime.now(dt.tzinfo) - dt).days
    except (ValueError, TypeError):
        return 9999


def _engagement_rank(contact: dict) -> float:
    """Score a contact's recent engagement for sorting purposes.

    Higher = more recently engaged = should be scored first.
    This is NOT the final score — just a ranking heuristic to
    prioritize who gets scored in the batch.

    Signals (most recent wins):
    - Web visit in last 30 days: 100 pts
    - Web visit in last 90 days: 50 pts
    - Email click in last 30 days: 80 pts
    - Email open in last 30 days: 40 pts
    - Multiple web sessions: 20 pts
    - Sales activity in last 30 days: 30 pts
    """
    props = contact.get("properties", {})
    rank = 0.0

    # Web visits — strongest re-engagement signal
    visit_days = _days_since(props.get("hs_analytics_last_visit_timestamp"))
    if visit_days < 30:
        rank += 100
    elif visit_days < 90:
        rank += 50
    elif visit_days < 180:
        rank += 15

    # Repeat visitors
    num_visits = int(props.get("hs_analytics_num_visits") or 0)
    if num_visits >= 5:
        rank += 20
    elif num_visits >= 2:
        rank += 10

    # Email clicks
    click_days = _days_since(props.get("hs_email_last_click_date"))
    if click_days < 30:
        rank += 80
    elif click_days < 90:
        rank += 30

    # Email opens
    open_days = _days_since(props.get("hs_email_last_open_date"))
    if open_days < 30:
        rank += 40
    elif open_days < 90:
        rank += 15

    # Sales activity
    sales_days = _days_since(props.get("hs_last_sales_activity_timestamp"))
    if sales_days < 30:
        rank += 30

    return rank


def get_stale_closed_lost_contacts(limit: int = 50) -> list[dict]:
    """Fetch closed-lost contacts, prioritized by recent engagement.

    Filters:
    - lifecyclestage = closed-lost
    - outreach_status != "active"
    - Associated deal closedate > 90 days ago (checked programmatically)

    Returns contacts sorted by engagement rank — most recently active first.
    """
    client = HubSpotClient()

    # Pull a larger pool so we can rank and prioritize
    pool_size = max(limit * 3, 150)

    filters = [
        {"propertyName": "lifecyclestage", "operator": "EQ", "value": CLOSED_LOST_STAGE},
        {"propertyName": "outreach_status", "operator": "NEQ", "value": "active"},
    ]
    contacts = client.search_contacts(
        filters=filters,
        properties=ENGAGEMENT_PROPERTIES,
        limit=pool_size,
        sorts=[{"propertyName": "hs_analytics_last_visit_timestamp", "direction": "DESCENDING"}],
    )

    stale_cutoff = datetime.now() - timedelta(days=STALE_DAYS)
    stale = []

    for contact in contacts:
        deal_refs = client.get_contact_deals(contact["id"])

        # No deals: include (nothing to filter on, treat as stale)
        if not deal_refs:
            stale.append(contact)
        else:
            # Fetch full deal records to check closedate
            close_dates = []
            for ref in deal_refs:
                deal_id = ref.get("id") or ref.get("toObjectId")
                if not deal_id:
                    continue
                try:
                    deal = client.get_deal(str(deal_id))
                    cd = deal.get("properties", {}).get("closedate")
                    if cd:
                        close_dates.append(cd)
                except Exception:
                    continue

            if not close_dates:
                stale.append(contact)
            else:
                latest_close = max(close_dates)
                if datetime.fromisoformat(latest_close[:10]) < stale_cutoff:
                    stale.append(contact)

    # Sort by engagement rank — most active contacts first
    stale.sort(key=lambda c: _engagement_rank(c), reverse=True)

    return stale[:limit]


def run_closed_lost_batch(limit: int = 50, dry_run: bool = False) -> list[PipelineResult]:
    """Score stale closed-lost contacts, prioritized by recent engagement.

    Contacts who visited truv.com, opened emails, or clicked links recently
    are scored first. Their results appear at the top of the Slack digest.

    Args:
        limit: Maximum number of contacts to score.
        dry_run: If True, score but do not write to HubSpot.

    Returns:
        List of PipelineResult objects, ordered by engagement priority.
    """
    contacts = get_stale_closed_lost_contacts(limit=limit)
    results = []

    for i, contact in enumerate(contacts, 1):
        props = contact.get("properties", {})
        email = props.get("email", "unknown")
        rank = _engagement_rank(contact)

        try:
            result = run_pipeline(
                contact_id=contact["id"],
                source="closed_lost_reengagement",
            )
            if not dry_run:
                write_scores_to_hubspot(result, source="closed_lost_reengagement")
            results.append(result)

            tier_emoji = {"hot": "🔥", "warm": "🟡", "cold": "🔵"}.get(result.final_tier, "⚪")
            rank_label = f" ★ ENGAGED (rank {rank:.0f})" if rank > 0 else ""
            print(
                f"  [{i}/{len(contacts)}] {tier_emoji} {result.final_score:.0f} "
                f"{result.final_tier:5s} {result.final_routing:15s} {email}{rank_label}"
            )
        except Exception as e:
            print(f"  [{i}/{len(contacts)}] ❌ Error: {e} ({email})")

    return results
