"""Post-scoring callback: route contacts into SmartLead campaigns.

Replaces the external Pipedream webhook with a direct function call.
Called after write_scores_to_hubspot() in all pipeline paths.
"""

import logging
import os

from truv_scout.models import PipelineResult

logger = logging.getLogger(__name__)


def fire_completion_webhook(result: PipelineResult, source: str = "form_submission") -> bool:
    """Route a scored contact into the correct SmartLead campaign.

    Returns True if the contact was routed, False if skipped or failed.
    """
    # Only route contacts that came through self-service flows
    if source not in ("form_submission", "dashboard_signup"):
        return False

    # Fetch fresh HubSpot props for routing decisions
    hubspot_props = _fetch_hubspot_props(result.contact_id)
    if not hubspot_props:
        return False

    from truv_scout.smartlead_router import route_to_smartlead

    return route_to_smartlead(result, hubspot_props)


def _fetch_hubspot_props(contact_id: str) -> dict:
    """Fetch contact properties needed for routing."""
    token = os.getenv("HUBSPOT_API_TOKEN")
    if not token:
        return {}

    import requests

    props = [
        "email", "firstname", "lastname", "company", "jobtitle",
        "sales_vertical", "job_function", "market_segment",
        "outreach_status", "los_pos_matches", "lifecyclestage",
    ]

    try:
        resp = requests.get(
            f"https://api.hubapi.com/crm/v3/objects/contacts/{contact_id}",
            params={"properties": ",".join(props)},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if resp.ok:
            return resp.json().get("properties", {})
        logger.warning(f"HubSpot fetch returned {resp.status_code} for {contact_id}")
    except Exception as e:
        logger.warning(f"HubSpot fetch failed for {contact_id}: {e}")
    return {}
