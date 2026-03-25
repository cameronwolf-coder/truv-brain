"""Pipeline orchestrator — runs all scoring layers with graceful degradation."""

import logging
from typing import Optional

from outreach_intel.hubspot_client import HubSpotClient
from outreach_intel.scorer import FORM_PROPERTIES
from truv_scout.models import PipelineResult, ScoutEnrichment
from truv_scout.scorer import classify_route, classify_tier, score_and_route

logger = logging.getLogger(__name__)

# Properties to fetch from HubSpot
SCORE_PROPERTIES = [
    "firstname", "lastname", "email", "jobtitle", "company",
    "lifecyclestage", "hs_lead_status",
    "hs_email_last_open_date", "hs_email_last_click_date",
    "notes_last_updated", "hs_email_sends_since_last_engagement",
    "num_conversion_events", "recent_conversion_date", "first_conversion_date",
    # Web visit + content engagement signals (critical for closed-lost re-engagement)
    "hs_analytics_last_visit_timestamp", "hs_analytics_num_page_views",
    "hs_analytics_num_visits", "hs_analytics_last_url",
    "hs_last_sales_activity_timestamp",
    *FORM_PROPERTIES,
]


def run_pipeline(
    contact_id: Optional[str] = None,
    email: Optional[str] = None,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    company: Optional[str] = None,
    domain: Optional[str] = None,
    skip_enrichment: bool = False,
    skip_agent: bool = False,
    source: str = "form_submission",
) -> PipelineResult:
    """Run the full Scout scoring pipeline.

    Layers:
    1. Deterministic scorer → base scores + routing
    2. Filtered Apollo enrichment → tech stack + firmographics
    3. Scout agent reasoning → adjusted score + reasoning
    4. Learning engine (STUB — needs PgVector)

    Each layer degrades gracefully if it fails.
    """
    # Resolve contact data
    contact = _resolve_contact(contact_id, email, first_name, last_name, company)
    cid = contact.get("id", contact_id or email or "unknown")

    props = contact.get("properties", {})
    result = PipelineResult(
        contact_id=cid,
        contact_name=f"{props.get('firstname', '')} {props.get('lastname', '')}".strip(),
        company_name=props.get("company", ""),
    )

    # --- Layer 1: Deterministic Scorer ---
    scored, routing, tier = score_and_route(contact)
    result.base_score = scored.total_score
    result.form_fit_score = scored.form_fit_score
    result.engagement_score = scored.engagement_score
    result.timing_score = scored.timing_score
    result.deal_context_score = scored.deal_context_score
    result.external_trigger_score = scored.external_trigger_score
    result.base_routing = routing
    # Dashboard signups get a product intent bonus — they actually used the product,
    # which is the strongest intent signal. Without this, dashboard signups with no
    # prior HubSpot engagement score ~29.5 (always cold).
    product_intent_bonus = 0.0
    if source == "dashboard_signup":
        product_intent_bonus = 25.0  # ~30% weight at 70/100 base
        logger.info(f"[pipeline] Dashboard signup bonus: +{product_intent_bonus} pts")

    base_with_bonus = min(scored.total_score + product_intent_bonus, 100.0)
    result.final_score = base_with_bonus
    result.final_tier = classify_tier(base_with_bonus)
    result.final_routing = routing
    result.reasoning = "Deterministic score only."
    result.confidence = "medium"

    # --- Layer 2: Filtered Apollo Enrichment ---
    enrichment = None
    if not skip_enrichment:
        try:
            from truv_scout.tools.apollo import FilteredApolloEnrichment

            apollo = FilteredApolloEnrichment()
            enrichment = apollo.enrich(
                email=scored.email or email or "",
                first_name=first_name or scored.firstname or "",
                last_name=last_name or scored.lastname or "",
                company=company or scored.company or "",
                domain=domain or "",
            )
            result.enrichment = enrichment

            # Re-evaluate routing with enrichment data
            routing = classify_route(scored, enrichment)
            result.final_routing = routing
        except Exception as e:
            logger.warning(f"Apollo enrichment failed: {e}")
            result.enrichment_error = str(e)

    # --- Layer 3: Scout Agent ---
    if not skip_agent:
        try:
            from truv_scout.agent import run_scout_agent

            decision = run_scout_agent(scored, enrichment, routing, tier)
            result.decision = decision
            result.final_score = decision.adjusted_score
            result.final_tier = decision.tier
            result.final_routing = decision.routing
            result.reasoning = decision.reasoning
            result.recommended_action = decision.recommended_action
            result.confidence = decision.confidence
        except Exception as e:
            logger.warning(f"Scout agent failed: {e}")
            result.agent_error = str(e)

    # --- Layer 4: Learning Engine (STUB) ---
    # TODO: PgVector similarity search + save decision
    # Needs RDS PostgreSQL with pgvector extension

    return result


def _resolve_contact(
    contact_id: Optional[str],
    email: Optional[str],
    first_name: Optional[str],
    last_name: Optional[str],
    company: Optional[str],
) -> dict:
    """Fetch or construct a HubSpot-style contact dict."""
    if contact_id:
        try:
            client = HubSpotClient()
            contact = client.get_contact(contact_id, properties=SCORE_PROPERTIES)
            return contact
        except Exception as e:
            logger.warning(f"HubSpot fetch failed for {contact_id}: {e}")

    # Construct minimal contact dict
    return {
        "id": contact_id or email or "manual",
        "properties": {
            "firstname": first_name or "",
            "lastname": last_name or "",
            "email": email or "",
            "company": company or "",
        },
    }
