"""Signal agent for AI-powered lead scoring (Flow A: Smart Scorer).

Wraps the existing ContactScorer output with LLM reasoning.
The LLM reviews the top N scored contacts, explains why each is
worth pursuing, and adjusts scores based on pattern recognition.

Supports Claude (Anthropic) and Gemini (Google) via --model flag.
"""
import json
import re
import os
from dataclasses import dataclass, asdict
from typing import Any

from agno.agent import Agent

from outreach_intel.scorer import ScoredContact


# ── Model provider helper ──────────────────────────────────────────

DEFAULT_MODEL = os.getenv("SIGNAL_AGENT_MODEL", "gemini")


def get_model(provider: str | None = None):
    """Return an Agno model instance for the given provider.

    Args:
        provider: "gemini" or "claude". Defaults to SIGNAL_AGENT_MODEL env
                  var, then "gemini".
    """
    provider = (provider or DEFAULT_MODEL).lower()

    if provider == "claude":
        from agno.models.anthropic import Claude
        return Claude(id="claude-sonnet-4-20250514")
    elif provider == "gemini":
        from agno.models.google import Gemini
        return Gemini(id="gemini-2.0-flash")
    else:
        raise ValueError(f"Unknown model provider: {provider}. Use 'gemini' or 'claude'.")


@dataclass
class SignalReview:
    """Claude's review of a scored contact."""

    contact_id: str
    original_score: float
    adjusted_score: float
    reasoning: str
    recommended_action: str
    confidence: str  # "high", "medium", "low"


# System prompt for the review agent
REVIEW_PROMPT = """You are a B2B sales intelligence analyst at Truv, a consumer permissioned data platform for income and employment verification.

Your job: review pre-scored leads and provide reasoning about why each contact is (or isn't) worth pursuing right now.

Truv's ICP (ideal customer profile):
- Lenders (mortgage, auto, personal loan)
- Fintechs building lending or verification products
- HR platforms needing employment/income verification
- Credit unions and community banks scaling verification

Scoring context:
- Engagement score: based on email opens/clicks (0-100)
- Timing score: recency of CRM activity (0-100)
- Deal context score: lifecycle stage weight, Closed Lost = 80, Churned = 75 (0-100)
- External trigger score: currently hardcoded at 40 (this is the gap you're filling)

For each contact, you must return a JSON array. Each element:
{
  "contact_id": "string",
  "original_score": number,
  "adjusted_score": number (your re-scored value, 0-100),
  "reasoning": "string (2-3 sentences explaining why this score)",
  "recommended_action": "string (one concrete next step)",
  "confidence": "high" | "medium" | "low"
}

Rules:
- Be specific. Reference actual data points (job title, company, lifecycle stage, engagement dates).
- Adjust scores UP when you see re-engagement patterns (silence then activity), senior titles, or ICP-matching companies.
- Adjust scores DOWN when the contact looks like a poor fit (wrong industry, junior title, stale data).
- Keep reasoning short. 2-3 sentences max.
- Return ONLY the JSON array. No markdown, no explanation outside the array."""


def _format_contacts_for_prompt(contacts: list[dict[str, Any]]) -> str:
    """Format scored contacts into a readable prompt block."""
    lines = []
    for c in contacts:
        lines.append(
            f"- ID: {c['contact_id']}, "
            f"Name: {c.get('firstname', '')} {c.get('lastname', '')}, "
            f"Title: {c.get('jobtitle', 'Unknown')}, "
            f"Company: {c.get('company', 'Unknown')}, "
            f"Stage: {c.get('lifecyclestage', 'Unknown')}, "
            f"Score: {c.get('total_score', 0):.1f} "
            f"(Engagement={c.get('engagement_score', 0):.0f}, "
            f"Timing={c.get('timing_score', 0):.0f}, "
            f"Context={c.get('deal_context_score', 0):.0f}, "
            f"External={c.get('external_trigger_score', 0):.0f})"
        )
    return "\n".join(lines)


def _run_review_agent(contacts_text: str, model_provider: str | None = None) -> str:
    """Run the Agno agent and return raw response text.

    Separated for easy mocking in tests.
    """
    agent = Agent(
        name="Lead Signal Reviewer",
        model=get_model(model_provider),
        instructions=[REVIEW_PROMPT],
        markdown=False,
    )

    response = agent.run(
        f"Review these {contacts_text.count(chr(10)) + 1} pre-scored leads "
        f"and return your analysis as a JSON array:\n\n{contacts_text}"
    )
    return response.content


def review_contacts(
    contacts: list[dict[str, Any]],
    limit: int = 25,
    model_provider: str | None = None,
) -> list[SignalReview]:
    """Review scored contacts with Claude reasoning.

    Takes a list of contact dicts (from ScoredContact or raw dicts)
    and returns Claude's analysis with adjusted scores and reasoning.

    Args:
        contacts: List of scored contact dicts with keys matching
                  ScoredContact fields (contact_id, firstname, etc.)
        limit: Max contacts to review (controls token usage)

    Returns:
        List of SignalReview objects sorted by adjusted_score descending
    """
    if not contacts:
        return []

    # Trim to limit
    batch = contacts[:limit]

    # Format for prompt
    contacts_text = _format_contacts_for_prompt(batch)

    # Run agent
    raw = _run_review_agent(contacts_text, model_provider=model_provider)

    # Parse response
    try:
        reviews_data = json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract JSON from markdown code blocks
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            reviews_data = json.loads(match.group())
        else:
            return []

    # Build SignalReview objects
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

    # Sort by adjusted score
    reviews.sort(key=lambda x: x.adjusted_score, reverse=True)
    return reviews


def review_scored_contacts(
    scored: list[ScoredContact],
    limit: int = 25,
    model_provider: str | None = None,
) -> list[SignalReview]:
    """Convenience wrapper that accepts ScoredContact objects.

    Converts ScoredContact dataclasses to dicts, then calls review_contacts.
    """
    contacts = [asdict(s) for s in scored]
    return review_contacts(contacts, limit=limit, model_provider=model_provider)


# ── Flow B: Signal Enricher ─────────────────────────────────────────

ENRICHMENT_PROMPT = """You are a B2B sales intelligence agent at Truv, a consumer permissioned data platform for income and employment verification.

You have tools to gather external signals about leads. For each contact:
1. Use get_hubspot_activity to check their CRM history
2. Use enrich_contact_data to get company firmographics and tech stack
3. Use check_company_hiring when the company has 50+ employees to find hiring signals
4. Use detect_job_change for Closed Lost contacts and contacts with stale titles
5. Use search_company_news to find recent company developments
6. Use check_job_changes (web search) if Apollo data is insufficient
7. Use get_form_context for inbound leads to see their form submission data (use case, volume, role, comments)

Key analysis pattern for inbound leads:
- ALWAYS call get_form_context first if the contact has a HubSpot ID
- Cross-reference self-reported volume against Apollo employee count
- If volume >> headcount, this is a high-growth platform play — score UP significantly
- Use case + referring page tells you exactly what product they need
- Role + job function tells you if they have buying authority
- Comments reveal specific pain points — reference these in your reasoning

Truv's ICP: lenders, fintechs, HR platforms needing income/employment verification.

Signals that matter for Truv:
- CRM re-engagement: silence then sudden email opens/clicks
- Hiring surges: lending ops, verification, compliance roles
- Regulatory triggers: NCUA, CFPB, or state-level verification guidance
- Company events: new lending products, geographic expansion, tech overhauls
- Tech stack: Encompass, ICE Mortgage, Blend, or legacy verification providers
- Company size/growth: rapid employee growth signals expanding verification needs

After gathering signals, return a JSON array. Each element:
{
  "contact_id": "string",
  "original_score": number,
  "adjusted_score": number (0-100),
  "reasoning": "string (2-3 sentences, reference specific signals you found)",
  "recommended_action": "string (one concrete next step)",
  "confidence": "high" | "medium" | "low"
}

Return ONLY the JSON array."""


def _run_enrichment_agent(contacts_text: str, model_provider: str | None = None) -> str:
    """Run the enrichment agent with tools. Separated for mocking."""
    from outreach_intel.signal_tools import (
        search_company_news,
        check_job_changes,
        get_hubspot_activity,
        enrich_contact_data,
        check_company_hiring,
        detect_job_change,
        get_form_context,
    )

    agent = Agent(
        name="Lead Signal Enricher",
        model=get_model(model_provider),
        instructions=[ENRICHMENT_PROMPT],
        tools=[
            search_company_news,
            check_job_changes,
            get_hubspot_activity,
            enrich_contact_data,
            check_company_hiring,
            detect_job_change,
            get_form_context,
        ],
        markdown=False,
    )

    response = agent.run(
        f"Enrich these leads with external signals, then score and rank them:\n\n{contacts_text}"
    )
    return response.content


def enrich_contacts(
    contacts: list[dict[str, Any]],
    limit: int = 10,
    model_provider: str | None = None,
) -> list[SignalReview]:
    """Enrich contacts with external signals via Claude agent tools.

    Flow B: Claude calls tools (web search, job changes, HubSpot activity)
    to gather real-time signals before scoring.

    Args:
        contacts: List of scored contact dicts
        limit: Max contacts to enrich (higher cost per contact)

    Returns:
        List of SignalReview objects sorted by adjusted_score descending
    """
    if not contacts:
        return []

    batch = contacts[:limit]
    contacts_text = _format_contacts_for_prompt(batch)
    raw = _run_enrichment_agent(contacts_text, model_provider=model_provider)

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


def enrich_scored_contacts(
    scored: list[ScoredContact],
    limit: int = 10,
    model_provider: str | None = None,
) -> list[SignalReview]:
    """Convenience wrapper accepting ScoredContact objects for Flow B."""
    contacts = [asdict(s) for s in scored]
    return enrich_contacts(contacts, limit=limit, model_provider=model_provider)
