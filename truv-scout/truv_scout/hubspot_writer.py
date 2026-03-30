"""Write Scout scoring results back to HubSpot contact properties."""

import logging
from datetime import datetime, timezone

from outreach_intel.hubspot_client import HubSpotClient
from truv_scout.models import PipelineResult
from truv_scout.settings import get_settings

logger = logging.getLogger(__name__)


def write_scores_to_hubspot(result: PipelineResult, source: str = "form_submission") -> bool:
    """Write scoring results to HubSpot contact properties.

    Properties written:
    - inbound_lead_tier: hot/warm/cold
    - form_fit_score: 0-100
    - lead_routing: enterprise/self-service/government/not-a-lead
    - scout_reasoning: Agent reasoning text
    - scout_confidence: high/medium/low
    - scout_scored_at: ISO timestamp
    - scout_tech_stack_matches: JSON string of tech matches
    - scout_source: form_submission/closed_lost_reengagement/dashboard_signup

    Args:
        result: Pipeline result with all scoring data.
        source: Which pipeline triggered the score.

    Returns:
        True if update succeeded, False otherwise.
    """
    if not result.contact_id:
        return False

    tech_matches_str = ""
    if result.decision and result.decision.tech_matches:
        parts = []
        for category, matches in result.decision.tech_matches.items():
            if matches:
                parts.append(f"{category}: {', '.join(matches)}")
        tech_matches_str = "; ".join(parts)

    properties = {
        "inbound_lead_tier": result.final_tier,
        "form_fit_score": str(round(result.form_fit_score)),
        "lead_routing": result.final_routing,
        "scout_reasoning": (result.reasoning or "")[:1000],
        "scout_confidence": result.confidence,
        "scout_scored_at": datetime.now(timezone.utc).isoformat(),
        "scout_source": source,
    }

    if tech_matches_str:
        properties["scout_tech_stack_matches"] = tech_matches_str[:500]

    # Auto-assign enterprise contacts to SDR queue owner
    if result.final_routing == "enterprise":
        sdr_owner_id = get_settings().enterprise_sdr_owner_id
        if sdr_owner_id:
            properties["hubspot_owner_id"] = sdr_owner_id

    try:
        client = HubSpotClient()
        client.update_contact(result.contact_id, properties)
        return True
    except Exception as e:
        logger.exception(f"[hubspot_writer] Failed to write scores for {result.contact_id}")
        return False
