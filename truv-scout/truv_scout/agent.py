"""Scout Agent — Agno-based lead scoring agent with knowledge navigation."""

import json
import logging
from pathlib import Path
from typing import Any, Optional

from agno.agent import Agent
from agno.models.google import Gemini

from outreach_intel.scorer import ScoredContact
from truv_scout.models import ScoutDecision, ScoutEnrichment

logger = logging.getLogger(__name__)

_ICP_RULES_PATH = Path(__file__).parent / "config" / "icp_rules.md"


def _load_icp_rules() -> str:
    """Load the ICP rules system prompt."""
    return _ICP_RULES_PATH.read_text()


def _get_tools() -> list:
    """Import and return all agent tools."""
    from truv_scout.tools.search import search_knowledge_base
    from truv_scout.tools.awareness import list_sources, get_source_metadata
    from truv_scout.tools.firecrawl import (
        search_company_news,
        check_job_changes,
        scrape_company_website,
        crawl_company_site,
        map_company_urls,
        extract_article_content,
    )

    return [
        search_knowledge_base,
        list_sources,
        get_source_metadata,
        search_company_news,
        check_job_changes,
        scrape_company_website,
        crawl_company_site,
        map_company_urls,
        extract_article_content,
    ]


def _format_lead_context(
    scored: ScoredContact,
    enrichment: Optional[ScoutEnrichment],
    routing: str,
    tier: str,
) -> str:
    """Format lead data into a prompt context block."""
    lines = [
        f"Contact ID: {scored.contact_id}",
        f"Name: {scored.name}",
        f"Email: {scored.email}",
        f"Title: {scored.jobtitle}",
        f"Company: {scored.company}",
        f"Lifecycle Stage: {scored.lifecyclestage}",
        "",
        "--- Deterministic Scores ---",
        f"Total Score: {scored.total_score:.1f}",
        f"Form Fit: {scored.form_fit_score:.0f}",
        f"Engagement: {scored.engagement_score:.0f}",
        f"Timing: {scored.timing_score:.0f}",
        f"Deal Context: {scored.deal_context_score:.0f}",
        f"External Trigger: {scored.external_trigger_score:.0f}",
        f"Deterministic Routing: {routing}",
        f"Deterministic Tier: {tier}",
    ]

    # Form data
    form_fields = {
        "use_case": "Use Case",
        "what_s_your_use_case___forms_": "Use Case (form)",
        "how_many_loans_do_you_close_per_year": "Loan Volume",
        "how_many_applications_do_you_see_per_year_": "Application Volume",
        "which_of_these_best_describes_your_job_title_": "Role Level",
        "job_function_contact": "Job Function",
        "how_can_we_help": "How Can We Help",
        "message": "Comments",
    }
    form_data = []
    for prop, label in form_fields.items():
        val = scored.raw_properties.get(prop)
        if val:
            form_data.append(f"  {label}: {val}")
    if form_data:
        lines.append("")
        lines.append("--- Form Submission ---")
        lines.extend(form_data)

    if enrichment:
        lines.append("")
        lines.append("--- Apollo Enrichment ---")
        if enrichment.company_name:
            lines.append(f"  Company: {enrichment.company_name}")
        if enrichment.employee_count:
            lines.append(f"  Employees: {enrichment.employee_count:,}")
        if enrichment.revenue:
            lines.append(f"  Revenue: {enrichment.revenue}")
        if enrichment.industry:
            lines.append(f"  Industry: {enrichment.industry}")
        if enrichment.person_title:
            lines.append(f"  Apollo Title: {enrichment.person_title}")
        if enrichment.person_seniority:
            lines.append(f"  Seniority: {enrichment.person_seniority}")
        if enrichment.los_pos_matches:
            lines.append(f"  LOS/POS Matches: {', '.join(enrichment.los_pos_matches)}")
        if enrichment.voi_voe_matches:
            lines.append(f"  VOI/VOE Matches: {', '.join(enrichment.voi_voe_matches)}")
        lines.append(f"  Tech Intent: {enrichment.tech_intent}")
        if enrichment.filtered_hiring:
            lines.append(f"  Relevant Hiring: {len(enrichment.filtered_hiring)} roles")
            for h in enrichment.filtered_hiring[:3]:
                lines.append(f"    - {h.get('job_title', 'Unknown')}")

    return "\n".join(lines)


def run_scout_agent(
    scored: ScoredContact,
    enrichment: Optional[ScoutEnrichment],
    routing: str,
    tier: str,
) -> ScoutDecision:
    """Run the Scout agent using a two-pass approach for reliable tool use.

    Pass 1 (Research): Forces the agent to search the knowledge base and
    gather context. The prompt asks ONLY for research — no scoring — so the
    model has no shortcut to skip tools.

    Pass 2 (Score): Takes the research output and asks a second call to
    produce the scoring JSON. No tools needed here.

    Args:
        scored: Deterministic scoring result.
        enrichment: Filtered Apollo enrichment (may be None).
        routing: Deterministic routing label.
        tier: Deterministic tier label.

    Returns:
        ScoutDecision with adjusted score and reasoning.
    """
    icp_rules = _load_icp_rules()
    tools = _get_tools()
    context = _format_lead_context(scored, enrichment, routing, tier)

    # ── Pass 1: Research ─────────────────────────────────────────────
    research_agent = Agent(
        name="Truv Scout — Research",
        model=Gemini(id="gemini-2.0-flash"),
        instructions=[icp_rules],
        tools=tools,
        markdown=False,
    )

    research_prompt = (
        f"You are a research assistant. Your ONLY job is to gather context about this lead. "
        f"Do NOT score the lead. Do NOT return JSON.\n\n"
        f"Complete these steps and report what you found:\n"
        f"1. Call list_sources() to see what knowledge is available.\n"
        f"2. Call search_knowledge_base() with at least one query relevant to this lead's "
        f"industry, company, or use case.\n"
        f"3. If the lead has 50+ employees or is in lending/mortgage/financial services, "
        f"call check_job_changes() with their company name.\n"
        f"4. If there are tech stack matches (LOS/POS/VOI/VOE), call search_knowledge_base() "
        f"for competitive intel or integration docs.\n\n"
        f"After calling the tools, summarize all findings in plain text. "
        f"List every file path or source you referenced.\n\n{context}"
    )

    try:
        research_response = research_agent.run(research_prompt)
        research_findings = research_response.content or ""
    except Exception as e:
        logger.warning("Pass 1 (research) failed: %s — falling back to deterministic", e)
        return _fallback_decision(scored, enrichment, routing, tier)

    # ── Pass 2: Score ────────────────────────────────────────────────
    scoring_agent = Agent(
        name="Truv Scout — Scorer",
        model=Gemini(id="gemini-2.0-flash"),
        instructions=[icp_rules],
        tools=[],  # No tools — pure reasoning
        markdown=False,
    )

    scoring_prompt = (
        f"Using the lead data and research findings below, return a JSON object scoring this lead.\n\n"
        f"Required JSON fields: adjusted_score (number 0-100), tier, routing, reasoning, "
        f"recommended_action, confidence (low/medium/high), "
        f"tech_matches (object with los_pos and voi_voe arrays), "
        f"knowledge_sources_used (array of file paths).\n\n"
        f"Return ONLY the JSON object, no markdown fences, no commentary.\n\n"
        f"--- LEAD DATA ---\n{context}\n\n"
        f"--- RESEARCH FINDINGS ---\n{research_findings}"
    )

    try:
        scoring_response = scoring_agent.run(scoring_prompt)
        return _parse_decision(scoring_response.content, scored, enrichment, routing, tier)
    except Exception as e:
        logger.warning("Pass 2 (scoring) failed: %s — falling back to deterministic", e)
        return _fallback_decision(scored, enrichment, routing, tier)


def _parse_decision(
    raw: str,
    scored: ScoredContact,
    enrichment: Optional[ScoutEnrichment],
    routing: str,
    tier: str,
) -> ScoutDecision:
    """Parse agent response into a ScoutDecision, with fallback."""
    import re

    try:
        # Try direct parse
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Extract JSON from markdown
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
            except json.JSONDecodeError:
                return _fallback_decision(scored, enrichment, routing, tier)
        else:
            return _fallback_decision(scored, enrichment, routing, tier)

    # Clamp adjustment to ±15
    adjusted = float(data.get("adjusted_score", scored.total_score))
    max_adjustment = 15
    if abs(adjusted - scored.total_score) > max_adjustment:
        if adjusted > scored.total_score:
            adjusted = scored.total_score + max_adjustment
        else:
            adjusted = scored.total_score - max_adjustment
    adjusted = max(0, min(100, adjusted))

    tech_matches = data.get("tech_matches", {})
    if not isinstance(tech_matches, dict):
        tech_matches = {}

    # Use enrichment data for tech matches if agent didn't provide them
    if not tech_matches and enrichment:
        tech_matches = {
            "los_pos": enrichment.los_pos_matches,
            "voi_voe": enrichment.voi_voe_matches,
        }

    reasoning = str(data.get("reasoning", ""))
    if not reasoning.strip():
        # Agent returned JSON but no reasoning — treat as fallback
        return _fallback_decision(scored, enrichment, routing, tier)

    # Validate routing against allowlist — reject hallucinated values
    VALID_ROUTINGS = {"enterprise", "self-service", "government", "not-a-lead"}
    VALID_CONFIDENCES = {"low", "medium", "high"}
    agent_routing = str(data.get("routing", routing)).lower().strip()
    if agent_routing not in VALID_ROUTINGS:
        agent_routing = routing
    agent_confidence = str(data.get("confidence", "medium")).lower().strip()
    if agent_confidence not in VALID_CONFIDENCES:
        agent_confidence = "medium"

    from truv_scout.scorer import classify_tier
    return ScoutDecision(
        adjusted_score=adjusted,
        tier=classify_tier(adjusted),
        routing=agent_routing,
        reasoning=reasoning,
        recommended_action=str(data.get("recommended_action", "")),
        confidence=agent_confidence,
        tech_matches=tech_matches,
        knowledge_sources_used=data.get("knowledge_sources_used", []),
    )


def _fallback_decision(
    scored: ScoredContact,
    enrichment: Optional[ScoutEnrichment],
    routing: str,
    tier: str,
) -> ScoutDecision:
    """Return deterministic fallback when agent fails."""
    tech_matches = {}
    if enrichment:
        tech_matches = {
            "los_pos": enrichment.los_pos_matches,
            "voi_voe": enrichment.voi_voe_matches,
        }

    return ScoutDecision(
        adjusted_score=scored.total_score,
        tier=tier,
        routing=routing,
        reasoning="Agent unavailable — using deterministic score only.",
        recommended_action="Review lead manually.",
        confidence="low",
        tech_matches=tech_matches,
        knowledge_sources_used=[],
    )
