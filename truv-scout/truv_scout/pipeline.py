"""Pipeline orchestrator — runs all scoring layers with graceful degradation."""

import logging
import time
from datetime import datetime, timezone
from typing import Optional

from outreach_intel.hubspot_client import HubSpotClient
from outreach_intel.scorer import FORM_PROPERTIES
from truv_scout.models import LayerTrace, PipelineResult, PipelineTrace, ScoutEnrichment
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
    # Trace setup
    pipeline_start = time.monotonic()
    now_str = datetime.now(timezone.utc).isoformat()
    trace = PipelineTrace(
        contact_id=contact_id or email or "unknown",
        started_at=now_str,
        source=source,
    )

    # Resolve contact data
    contact = _resolve_contact(contact_id, email, first_name, last_name, company)
    cid = contact.get("id", contact_id or email or "unknown")
    trace.contact_id = cid

    props = contact.get("properties", {})
    result = PipelineResult(
        contact_id=cid,
        contact_name=f"{props.get('firstname', '')} {props.get('lastname', '')}".strip(),
        company_name=props.get("company", ""),
    )

    # --- Layer 1: Deterministic Scorer ---
    l1 = LayerTrace(name="deterministic_scorer")
    l1.started_at = datetime.now(timezone.utc).isoformat()
    l1_start = time.monotonic()
    l1.input_summary = {"contact_id": cid, "email": props.get("email", ""), "company": props.get("company", "")}

    scored, routing, tier = score_and_route(contact)
    result.base_score = scored.total_score
    result.form_fit_score = scored.form_fit_score
    result.engagement_score = scored.engagement_score
    result.timing_score = scored.timing_score
    result.deal_context_score = scored.deal_context_score
    result.external_trigger_score = scored.external_trigger_score
    result.base_routing = routing
    product_intent_bonus = 0.0
    if source == "dashboard_signup":
        product_intent_bonus = 25.0
        logger.info(f"[pipeline] Dashboard signup bonus: +{product_intent_bonus} pts")
    elif source == "roi_calculator":
        product_intent_bonus = 20.0
        logger.info(f"[pipeline] ROI calculator bonus: +{product_intent_bonus} pts")

    base_with_bonus = min(scored.total_score + product_intent_bonus, 100.0)
    result.final_score = base_with_bonus
    result.final_tier = classify_tier(base_with_bonus)
    result.final_routing = routing
    result.reasoning = "Deterministic score only."
    result.confidence = "medium"

    l1.status = "complete"
    l1.finished_at = datetime.now(timezone.utc).isoformat()
    l1.duration_ms = int((time.monotonic() - l1_start) * 1000)
    l1.output_summary = {
        "base_score": scored.total_score,
        "product_intent_bonus": product_intent_bonus,
        "final_base_score": base_with_bonus,
        "routing": routing,
        "tier": tier,
        "form_fit": scored.form_fit_score,
        "engagement": scored.engagement_score,
        "timing": scored.timing_score,
        "deal_context": scored.deal_context_score,
        "external_trigger": scored.external_trigger_score,
    }
    trace.layers["deterministic_scorer"] = l1

    # --- Layer 2: Filtered Apollo Enrichment ---
    l2 = LayerTrace(name="apollo_enrichment")
    enrichment = None
    if not skip_enrichment:
        l2.started_at = datetime.now(timezone.utc).isoformat()
        l2_start = time.monotonic()
        l2.input_summary = {
            "email": scored.email or email or "",
            "first_name": first_name or scored.firstname or "",
            "last_name": last_name or scored.lastname or "",
            "company": company or scored.company or "",
            "domain": domain or "",
        }
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

            routing = classify_route(scored, enrichment)
            result.final_routing = routing

            l2.status = "complete"
            l2.output_summary = {
                "tech_intent": enrichment.tech_intent,
                "los_pos_matches": enrichment.los_pos_matches,
                "voi_voe_matches": enrichment.voi_voe_matches,
                "employee_count": enrichment.employee_count,
                "revenue": enrichment.revenue,
                "industry": enrichment.industry,
                "person_title": enrichment.person_title,
                "person_seniority": enrichment.person_seniority,
                "company_name": enrichment.company_name,
                "updated_routing": routing,
            }
        except Exception as e:
            logger.warning(f"Apollo enrichment failed: {e}")
            result.enrichment_error = str(e)
            l2.status = "failed"
            l2.error = str(e)
        l2.finished_at = datetime.now(timezone.utc).isoformat()
        l2.duration_ms = int((time.monotonic() - l2_start) * 1000)
    trace.layers["apollo_enrichment"] = l2

    # --- Layer 3: Scout Agent ---
    l3 = LayerTrace(name="scout_agent")
    if not skip_agent:
        l3.started_at = datetime.now(timezone.utc).isoformat()
        l3_start = time.monotonic()
        l3.input_summary = {
            "base_score": scored.total_score,
            "routing": routing,
            "tier": tier,
            "has_enrichment": enrichment is not None,
        }
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

            l3.status = "complete"
            l3.output_summary = {
                "adjusted_score": decision.adjusted_score,
                "tier": decision.tier,
                "routing": decision.routing,
                "confidence": decision.confidence,
                "reasoning": decision.reasoning,
                "recommended_action": decision.recommended_action,
                "knowledge_sources_used": decision.knowledge_sources_used,
                "tech_matches": decision.tech_matches,
            }
        except Exception as e:
            logger.warning(f"Scout agent failed: {e}")
            result.agent_error = str(e)
            l3.status = "failed"
            l3.error = str(e)
        l3.finished_at = datetime.now(timezone.utc).isoformat()
        l3.duration_ms = int((time.monotonic() - l3_start) * 1000)
    trace.layers["scout_agent"] = l3

    # --- Layer 4: Learning Engine (STUB) ---
    l4 = LayerTrace(name="learning_engine", status="skipped")
    l4.output_summary = {"note": "Planned — needs PgVector"}
    trace.layers["learning_engine"] = l4

    # Finalize trace
    trace.finished_at = datetime.now(timezone.utc).isoformat()
    trace.total_duration_ms = int((time.monotonic() - pipeline_start) * 1000)
    result.trace = trace

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
