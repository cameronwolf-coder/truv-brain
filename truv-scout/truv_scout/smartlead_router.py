"""Route scored contacts into SmartLead campaigns.

Replaces the Pipedream scout-to-smartlead-router workflow. Runs inline
after scoring — no external webhook hop needed.
"""

import logging

import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from truv_scout.models import PipelineResult
from truv_scout.settings import get_settings

logger = logging.getLogger(__name__)

SMARTLEAD_API_URL = "https://server.smartlead.ai/api/v1"

# Vertical classification buckets
MORTGAGE_VERTICALS = {"Bank", "IMB", "Credit Union", "Home Equity Lender"}
FINTECH_VERTICALS = {"Fintech", "Channel Partner"}
BGC_VERTICALS = {"Background Screening"}

# Personalization maps
VERTICAL_HOOKS = {
    "Bank": "banks modernizing their verification process",
    "IMB": "independent mortgage companies like yours",
    "Credit Union": "credit unions looking to speed up closings",
    "Fintech": "fintech teams building verification into their product",
    "Background Screening": "screening companies automating employment checks",
    "Home Equity Lender": "home equity lenders streamlining VOE/VOI",
    "Channel Partner": "technology partners adding verification to their platform",
}

CASE_STUDY_LINES = {
    "Bank": "A top-25 bank reduced verification costs 73% after switching to Truv",
    "IMB": "One IMB cut verification turnaround from 3 days to under 6 seconds",
    "Credit Union": "A $4B credit union automated 89% of their income verifications",
    "Fintech": "A lending fintech integrated Truv's API in 2 sprints and eliminated manual document review",
    "Background Screening": "A national screening firm reduced employment verification costs by 60%",
    "Home Equity Lender": "A home equity lender automated 85% of their income verifications with Truv",
    "Channel Partner": "Partners integrating Truv see 40% faster time-to-close for their lender clients",
}

TECH_ANGLES = {
    "greenfield": "connects directly to",
    "displacement": "replaces the manual step in",
    "competitive": "works alongside",
    "no-match": "integrates with",
}

SKIP_STATUSES = {"active", "engaged", "unsubscribed"}


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((requests.exceptions.ConnectionError, requests.exceptions.Timeout)),
    reraise=True,
)
def _upload_to_smartlead(campaign_id: str, api_key: str, lead: dict) -> requests.Response:
    """Upload a lead to SmartLead with retry on transient errors."""
    return requests.post(
        f"{SMARTLEAD_API_URL}/campaigns/{campaign_id}/leads",
        params={"api_key": api_key},
        json={"lead_list": [lead]},
        timeout=15,
    )


def route_to_smartlead(result: PipelineResult, hubspot_props: dict) -> bool:
    """Route a scored contact into the correct SmartLead campaign.

    Args:
        result: Completed pipeline result with tier, routing, enrichment.
        hubspot_props: Contact properties dict from HubSpot (email, sales_vertical, etc.).

    Returns:
        True if the lead was uploaded to SmartLead, False if skipped or failed.
    """
    s = get_settings()
    api_key = s.smartlead_api_key
    if not api_key:
        logger.warning("SMARTLEAD_API_KEY not set — skipping SmartLead routing")
        return False

    email = hubspot_props.get("email", "")
    if not email:
        logger.warning(f"No email for contact {result.contact_id} — skipping")
        return False

    # Guard: skip if already in a lane
    outreach_status = (hubspot_props.get("outreach_status") or "").lower()
    if outreach_status in SKIP_STATUSES:
        logger.info(f"Skipping {result.contact_id}: outreach_status={outreach_status}")
        return False

    # Resolve sales vertical
    sales_vertical = hubspot_props.get("sales_vertical") or ""
    if not sales_vertical and result.enrichment:
        industry = (result.enrichment.industry or "").lower()
        if "banking" in industry:
            sales_vertical = "Bank"
        elif "credit union" in industry:
            sales_vertical = "Credit Union"
        elif "mortgage" in industry or "lending" in industry:
            sales_vertical = "IMB"
        elif "fintech" in industry or "financial technology" in industry:
            sales_vertical = "Fintech"
        elif "background" in industry or "screening" in industry:
            sales_vertical = "Background Screening"

    # Pick campaign
    campaign_key, content_track = _select_campaign(result.final_tier, sales_vertical)
    campaign_id = getattr(s, campaign_key.lower(), "")
    if not campaign_id:
        logger.warning(f"Campaign ID not configured for {campaign_key}")
        return False

    # Compute personalization
    lead = _build_lead_payload(result, hubspot_props, sales_vertical)

    # Upload to SmartLead (retry on transient failures)
    try:
        resp = _upload_to_smartlead(campaign_id, api_key, lead)
        if not resp.ok:
            logger.error(f"SmartLead upload failed ({resp.status_code}): {resp.text}")
            return False
    except Exception as e:
        logger.error(f"SmartLead upload error: {e}")
        return False

    # Update HubSpot: outreach_status=active, content_track
    _update_hubspot_status(result.contact_id, content_track)

    # Slack notification
    _notify_slack_enrollment(result, hubspot_props, sales_vertical, content_track)

    logger.info(f"Routed {result.contact_id} to {content_track} (campaign {campaign_id})")
    return True


def _select_campaign(tier: str, sales_vertical: str) -> tuple[str, str]:
    """Return (env_var_key, content_track) for the given tier + vertical."""
    if tier == "hot":
        return "SMARTLEAD_CAMPAIGN_HOT_HANDOFF", "hot_handoff"
    if tier == "warm":
        if sales_vertical in MORTGAGE_VERTICALS:
            return "SMARTLEAD_CAMPAIGN_MORTGAGE_NURTURE", "mortgage_nurture"
        if sales_vertical in FINTECH_VERTICALS:
            return "SMARTLEAD_CAMPAIGN_FINTECH_NURTURE", "fintech_nurture"
        if sales_vertical in BGC_VERTICALS:
            return "SMARTLEAD_CAMPAIGN_BGC_NURTURE", "bgc_nurture"
        return "SMARTLEAD_CAMPAIGN_GENERAL_NURTURE", "general_nurture"
    return "SMARTLEAD_CAMPAIGN_COLD_REENGAGE", "cold_reengage"


def _build_lead_payload(result: PipelineResult, props: dict, sales_vertical: str) -> dict:
    """Build the SmartLead lead object with custom personalization fields."""
    enrichment = result.enrichment
    los_pos = enrichment.los_pos_matches if enrichment else []
    tech_intent = enrichment.tech_intent if enrichment else "no-match"
    person_title = (enrichment.person_title if enrichment else None) or props.get("jobtitle", "")

    tech_mention = f"your {los_pos[0]} workflow" if los_pos else "your current verification process"
    tech_angle = TECH_ANGLES.get(tech_intent, TECH_ANGLES["no-match"])
    vertical_hook = VERTICAL_HOOKS.get(sales_vertical, "teams looking to automate verification")
    case_study_line = CASE_STUDY_LINES.get(
        sales_vertical, "Companies using Truv see verification times drop from days to seconds"
    )

    market_segment = props.get("market_segment", "")
    if market_segment in ("Enterprise", "Strategic"):
        roi_line = "At enterprise volume, that translates to six-figure annual savings in verification costs"
    elif market_segment == "Mid-Market":
        roi_line = "Mid-market lenders typically see 60-80% cost reduction on verifications within 90 days"
    else:
        roi_line = "At your scale, automated verification pays for itself in weeks"

    return {
        "email": props.get("email", ""),
        "first_name": props.get("firstname", ""),
        "last_name": props.get("lastname", ""),
        "company_name": props.get("company", "") or result.company_name,
        "custom_fields": {
            "first_name": props.get("firstname", ""),
            "company": props.get("company", "") or result.company_name,
            "title": person_title,
            "vertical_hook": vertical_hook,
            "case_study_line": case_study_line,
            "tech_mention": tech_mention,
            "tech_angle": tech_angle,
            "roi_line": roi_line,
        },
    }


def _update_hubspot_status(contact_id: str, content_track: str) -> None:
    """Set outreach_status=active and content_track on HubSpot."""
    token = get_settings().hubspot_api_token
    if not token:
        return
    try:
        requests.patch(
            f"https://api.hubapi.com/crm/v3/objects/contacts/{contact_id}",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"properties": {
                "outreach_status": "active",
                "content_track": content_track,
                "content_track_stage": "1",
            }},
            timeout=10,
        )
    except Exception as e:
        logger.error(f"HubSpot update failed for {contact_id}: {e}")


def _notify_slack_enrollment(
    result: PipelineResult, props: dict, sales_vertical: str, content_track: str
) -> None:
    """Post enrollment notification to Slack."""
    s = get_settings()
    webhook_url = s.slack_webhook_url
    if not webhook_url:
        return

    tier_emoji = {"hot": "\U0001f525", "warm": "\U0001f7e1", "cold": "\U0001f535"}.get(
        result.final_tier, "\u26aa"
    )
    display_name = result.contact_name or props.get("email", "unknown")
    company = result.company_name or props.get("company", "")
    track_label = content_track.replace("_", " ").title()
    hubspot_url = f"https://app.hubspot.com/contacts/{s.hubspot_portal_id}/contact/{result.contact_id}"

    text = "\n".join([
        f"{tier_emoji} *{display_name}* from *{company}* entered *{track_label}* sequence",
        f"Score: {result.final_score:.0f} | Tier: {result.final_tier} | Vertical: {sales_vertical or 'Unknown'}",
        f"<{hubspot_url}|View in HubSpot>",
    ])

    try:
        requests.post(webhook_url, json={"text": text}, timeout=5)
    except Exception as e:
        logger.error(f"Slack notification failed: {e}")
