"""Multi-agent signal team (Flow C: Full Pipeline).

Three specialist agents run in parallel via Agno's coordinate mode:
- CRM Analyst: deep HubSpot activity analysis
- Market Scout: company news and hiring signals
- Scoring Agent (leader): synthesizes findings into final scores

Cost: ~$2.00 per batch. Runtime: 5-8 minutes.
Use this when you need comprehensive analysis on high-value leads.
"""
import json
import re
from dataclasses import asdict
from typing import Any

from agno.agent import Agent
from agno.team.team import Team
from agno.team.mode import TeamMode

from outreach_intel.signal_agent import SignalReview, _format_contacts_for_prompt, get_model


def _build_crm_analyst(model_provider: str | None = None) -> Agent:
    """CRM Analyst: deep-dives into HubSpot activity patterns."""
    from outreach_intel.signal_tools import get_hubspot_activity, get_form_context

    return Agent(
        name="CRM Analyst",
        role="Analyze CRM engagement patterns, form submission data, and deal history for each contact",
        model=get_model(model_provider),
        tools=[get_hubspot_activity, get_form_context],
        instructions=[
            "You analyze HubSpot CRM data for buying signals.",
            "For inbound leads, ALWAYS call get_form_context to see their form submission data.",
            "Look for: self-reported volume vs company size mismatches, "
            "use case alignment with Truv ICP, seniority/authority signals, "
            "re-engagement patterns, lifecycle stage transitions, deal history.",
            "Report your findings as structured text, one section per contact.",
        ],
    )


def _build_market_scout(model_provider: str | None = None) -> Agent:
    """Market Scout: searches for external company and people signals."""
    from outreach_intel.signal_tools import (
        search_company_news,
        check_job_changes,
        enrich_contact_data,
        check_company_hiring,
        detect_job_change,
    )

    return Agent(
        name="Market Scout",
        role="Search for external signals: company news, hiring patterns, job changes, firmographics",
        model=get_model(model_provider),
        tools=[
            search_company_news,
            check_job_changes,
            enrich_contact_data,
            check_company_hiring,
            detect_job_change,
        ],
        instructions=[
            "You search for external buying signals relevant to Truv's business "
            "(income and employment verification for lenders, fintechs, HR platforms).",
            "Start with enrich_contact_data to get firmographics and tech stack.",
            "Use check_company_hiring for companies with 50+ employees.",
            "Use detect_job_change for contacts that may have been promoted or moved.",
            "Use search_company_news and check_job_changes for additional web signals.",
            "Report findings as structured text, one section per contact.",
        ],
    )


def _run_team(contacts_text: str, model_provider: str | None = None) -> str:
    """Run the multi-agent team. Separated for mocking."""
    crm_analyst = _build_crm_analyst(model_provider)
    market_scout = _build_market_scout(model_provider)

    team = Team(
        name="Lead Signal Team",
        mode=TeamMode.coordinate,
        model=get_model(model_provider),
        members=[crm_analyst, market_scout],
        instructions=[
            "You lead a signal detection team at Truv.",
            "For each contact, delegate CRM analysis to the CRM Analyst "
            "and external research to the Market Scout.",
            "Synthesize their findings into a final scored assessment.",
            "Return a JSON array with one object per contact:",
            '{"contact_id", "original_score", "adjusted_score", "reasoning", '
            '"recommended_action", "confidence"}',
            "Return ONLY the JSON array.",
        ],
        show_members_responses=True,
        markdown=False,
    )

    response = team.run(
        f"Analyze these leads and return scored assessments:\n\n{contacts_text}"
    )
    return response.content


def run_signal_team(
    contacts: list[dict[str, Any]],
    limit: int = 5,
    model_provider: str | None = None,
) -> list[SignalReview]:
    """Run the full multi-agent team on a batch of contacts.

    Flow C: parallel specialist agents coordinated by a leader.
    Most comprehensive analysis, highest cost.

    Args:
        contacts: List of scored contact dicts
        limit: Max contacts (keep small, ~$2/batch)
        model_provider: "gemini" or "claude"

    Returns:
        List of SignalReview objects sorted by adjusted_score descending
    """
    if not contacts:
        return []

    batch = contacts[:limit]
    contacts_text = _format_contacts_for_prompt(batch)
    raw = _run_team(contacts_text, model_provider=model_provider)

    try:
        reviews_data = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            reviews_data = json.loads(match.group())
        else:
            return []

    reviews = []
    for r in reviews_data:
        reviews.append(SignalReview(
            contact_id=str(r["contact_id"]),
            original_score=float(r.get("original_score", 0)),
            adjusted_score=float(r.get("adjusted_score", 0)),
            reasoning=str(r.get("reasoning", "")),
            recommended_action=str(r.get("recommended_action", "")),
            confidence=str(r.get("confidence", "medium")),
        ))

    reviews.sort(key=lambda x: x.adjusted_score, reverse=True)
    return reviews
