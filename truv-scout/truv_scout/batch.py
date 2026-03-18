"""Batch scoring for closed-lost re-engagement."""

from datetime import datetime, timedelta

from outreach_intel.hubspot_client import HubSpotClient
from truv_scout.hubspot_writer import write_scores_to_hubspot
from truv_scout.models import PipelineResult
from truv_scout.pipeline import run_pipeline

CLOSED_LOST_STAGE = "268636563"
STALE_DAYS = 90


def get_stale_closed_lost_contacts(limit: int = 50) -> list[dict]:
    """Fetch closed-lost contacts with no active outreach and deal closed >90 days ago.

    Filters:
    - lifecyclestage = closed-lost
    - outreach_status != "active"
    - Associated deal closedate < 90 days ago (checked programmatically)
    """
    client = HubSpotClient()
    filters = [
        {"propertyName": "lifecyclestage", "operator": "EQ", "value": CLOSED_LOST_STAGE},
        {"propertyName": "outreach_status", "operator": "NEQ", "value": "active"},
    ]
    # Overfetch to account for deal-date filtering downstream
    contacts = client.search_contacts(filters=filters, limit=limit * 2)

    stale_cutoff = datetime.now() - timedelta(days=STALE_DAYS)
    stale = []

    for contact in contacts:
        deals = client.get_deals_for_contact(contact["id"])

        # No deals: include (nothing to filter on, treat as stale)
        if not deals:
            stale.append(contact)
        else:
            close_dates = [
                d.get("properties", {}).get("closedate")
                for d in deals
                if d.get("properties", {}).get("closedate")
            ]
            if not close_dates:
                stale.append(contact)
            else:
                latest_close = max(close_dates)
                if datetime.fromisoformat(latest_close[:10]) < stale_cutoff:
                    stale.append(contact)

        if len(stale) >= limit:
            break

    return stale[:limit]


def run_closed_lost_batch(limit: int = 50, dry_run: bool = False) -> list[PipelineResult]:
    """Score all stale closed-lost contacts and write results back to HubSpot.

    Args:
        limit: Maximum number of contacts to score.
        dry_run: If True, score but do not write to HubSpot.

    Returns:
        List of PipelineResult objects for scored contacts.
    """
    contacts = get_stale_closed_lost_contacts(limit=limit)
    results = []

    for contact in contacts:
        try:
            result = run_pipeline(contact_id=contact["id"])
            if not dry_run:
                write_scores_to_hubspot(result)
            results.append(result)
        except Exception as e:
            print(f"[batch] Error scoring contact {contact.get('id')}: {e}")

    return results
