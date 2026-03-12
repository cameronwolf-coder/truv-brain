# Agno Signal Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the hardcoded `_score_external_triggers()` in `outreach_intel/scorer.py` with Claude-powered reasoning, starting with a simple scoring overlay (Flow A) and building toward tool-equipped agents (Flow B) and a multi-agent team (Flow C).

**Architecture:** Three incremental flows, each building on the last. Flow A wraps the existing scorer with Claude for reasoning. Flow B adds tools (web search, job change detection, HubSpot activity). Flow C splits into parallel specialist agents coordinated by a leader. Each flow is independently shippable.

**Tech Stack:** Python 3.11+, Agno framework (`agno`), Anthropic Claude (`agno.models.anthropic.Claude`), existing `outreach_intel` package, pytest

---

## Flow A: Smart Scorer (Claude reviews existing scores)

### Task 1: Install dependencies

**Files:**
- Modify: `requirements.txt`

**Step 1: Add agno and anthropic packages**

```bash
pip install agno anthropic
```

**Step 2: Pin versions in requirements.txt**

Add these lines:

```
agno>=1.0.0
anthropic>=0.40.0
```

**Step 3: Verify import works**

```bash
python -c "from agno.agent import Agent; from agno.models.anthropic import Claude; print('OK')"
```

Expected: `OK`

**Step 4: Commit**

```bash
git add requirements.txt
git commit -m "feat: add agno and anthropic dependencies"
```

---

### Task 2: Write the signal agent module (Flow A core)

**Files:**
- Create: `outreach_intel/signal_agent.py`
- Test: `tests/test_signal_agent.py`

**Step 1: Write failing test for `review_contacts()`**

```python
# tests/test_signal_agent.py
"""Tests for signal agent (Flow A: Smart Scorer)."""
import json
import pytest
from unittest.mock import patch, MagicMock
from outreach_intel.signal_agent import review_contacts, SignalReview


def _make_scored_contact(**overrides):
    """Helper to build a ScoredContact-like dict for testing."""
    defaults = {
        "contact_id": "123",
        "firstname": "Sarah",
        "lastname": "Chen",
        "email": "sarah@example.com",
        "jobtitle": "VP Lending",
        "company": "Pacific Federal Credit Union",
        "lifecyclestage": "268636563",
        "engagement_score": 70.0,
        "timing_score": 50.0,
        "deal_context_score": 80.0,
        "external_trigger_score": 40.0,
        "total_score": 62.5,
    }
    defaults.update(overrides)
    return defaults


def test_review_contacts_returns_signal_reviews():
    """review_contacts returns a list of SignalReview objects."""
    contacts = [_make_scored_contact()]

    mock_response = MagicMock()
    mock_response.content = json.dumps([{
        "contact_id": "123",
        "original_score": 62.5,
        "adjusted_score": 78.0,
        "reasoning": "Recent email engagement after 6 months of silence signals renewed interest.",
        "recommended_action": "Route to sales for immediate follow-up.",
        "confidence": "high",
    }])

    with patch("outreach_intel.signal_agent._run_review_agent") as mock_agent:
        mock_agent.return_value = mock_response.content
        results = review_contacts(contacts)

    assert len(results) == 1
    assert isinstance(results[0], SignalReview)
    assert results[0].contact_id == "123"
    assert results[0].adjusted_score == 78.0
    assert results[0].confidence in ("high", "medium", "low")


def test_review_contacts_empty_list():
    """review_contacts returns empty list for empty input."""
    results = review_contacts([])
    assert results == []
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_signal_agent.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'outreach_intel.signal_agent'`

**Step 3: Write the signal agent module**

```python
# outreach_intel/signal_agent.py
"""Signal agent for AI-powered lead scoring (Flow A: Smart Scorer).

Wraps the existing ContactScorer output with Claude reasoning.
Claude reviews the top N scored contacts, explains why each is
worth pursuing, and adjusts scores based on pattern recognition.
"""
import json
import os
from dataclasses import dataclass, asdict
from typing import Any

from agno.agent import Agent
from agno.models.anthropic import Claude

from outreach_intel.scorer import ScoredContact


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


def _run_review_agent(contacts_text: str) -> str:
    """Run the Agno agent and return raw response text.

    Separated for easy mocking in tests.
    """
    agent = Agent(
        name="Lead Signal Reviewer",
        model=Claude(id="claude-sonnet-4-20250514"),
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
    raw = _run_review_agent(contacts_text)

    # Parse response
    try:
        reviews_data = json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract JSON from markdown code blocks
        import re
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
) -> list[SignalReview]:
    """Convenience wrapper that accepts ScoredContact objects.

    Converts ScoredContact dataclasses to dicts, then calls review_contacts.
    """
    contacts = [asdict(s) for s in scored]
    return review_contacts(contacts, limit=limit)
```

**Step 4: Run tests to verify they pass**

```bash
pytest tests/test_signal_agent.py -v
```

Expected: 2 passed

**Step 5: Commit**

```bash
git add outreach_intel/signal_agent.py tests/test_signal_agent.py
git commit -m "feat: add signal agent module (Flow A smart scorer)"
```

---

### Task 3: Add CLI command for signal review

**Files:**
- Modify: `outreach_intel/cli.py`
- Test: `tests/test_signal_agent.py` (add CLI test)

**Step 1: Write failing test for CLI signal-review command**

Add to `tests/test_signal_agent.py`:

```python
def test_cli_signal_review_command_exists():
    """signal-review CLI command is registered."""
    from outreach_intel.cli import main
    import io
    import contextlib

    f = io.StringIO()
    with contextlib.redirect_stdout(f), contextlib.redirect_stderr(f):
        try:
            main(["signal-review", "--help"])
        except SystemExit:
            pass

    output = f.getvalue()
    assert "signal" in output.lower() or "review" in output.lower()
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_signal_agent.py::test_cli_signal_review_command_exists -v
```

Expected: FAIL

**Step 3: Add signal-review command to CLI**

Add the following to `outreach_intel/cli.py`:

After the `cmd_recommend` function, add:

```python
def cmd_signal_review(args: argparse.Namespace) -> None:
    """Review top contacts with Claude signal analysis."""
    from outreach_intel.signal_agent import review_scored_contacts

    service = OutreachService()

    # Get contacts based on query type
    if args.query == "dormant":
        contacts = service.get_dormant_contacts(limit=args.limit)
    elif args.query == "closed-lost":
        contacts = service.get_closed_lost(limit=args.limit)
    elif args.query == "churned":
        contacts = service.get_churned_customers(limit=args.limit)
    else:
        print(f"Unknown query type: {args.query}")
        sys.exit(1)

    if not contacts:
        print("No contacts found.")
        sys.exit(1)

    print(f"\nScored {len(contacts)} contacts. Running Claude signal review...\n")

    reviews = review_scored_contacts(contacts, limit=args.review_limit)

    if args.json:
        from dataclasses import asdict
        output = [asdict(r) for r in reviews]
        print(json.dumps(output, indent=2))
    else:
        print(f"{'='*60}")
        print(f"SIGNAL REVIEW ({len(reviews)} contacts)")
        print(f"{'='*60}\n")
        for i, r in enumerate(reviews, 1):
            # Find matching original contact for name
            match = next((c for c in contacts if c.contact_id == r.contact_id), None)
            name = match.name if match else r.contact_id
            company = match.company if match else ""

            print(f"{i}. {name} ({company})")
            print(f"   Score: {r.original_score:.0f} -> {r.adjusted_score:.0f} [{r.confidence}]")
            print(f"   {r.reasoning}")
            print(f"   Action: {r.recommended_action}")
            print()
```

In the `main()` function, after the recommend subparser block, add:

```python
    # Signal review command
    signal_parser = subparsers.add_parser(
        "signal-review", help="AI-powered signal review of scored contacts"
    )
    signal_parser.add_argument(
        "query", choices=["dormant", "closed-lost", "churned"],
        help="Query type to score and review"
    )
    signal_parser.add_argument(
        "-l", "--limit", type=int, default=50,
        help="Contacts to pull from HubSpot"
    )
    signal_parser.add_argument(
        "-r", "--review-limit", type=int, default=25,
        help="Max contacts to send to Claude for review"
    )
    signal_parser.add_argument(
        "--json", action="store_true", help="Output as JSON"
    )
    signal_parser.set_defaults(func=cmd_signal_review)
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/test_signal_agent.py::test_cli_signal_review_command_exists -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add outreach_intel/cli.py tests/test_signal_agent.py
git commit -m "feat: add signal-review CLI command"
```

---

### Task 4: Integration test with real HubSpot data (manual)

**Step 1: Activate environment and run**

```bash
source venv/bin/activate
python -m outreach_intel.cli signal-review dormant --limit 10 --review-limit 5
```

Expected: 5 contacts with Claude reasoning, adjusted scores, and recommended actions.

**Step 2: Verify JSON output**

```bash
python -m outreach_intel.cli signal-review dormant --limit 10 --review-limit 5 --json
```

Expected: Valid JSON array of SignalReview objects.

**Step 3: Commit any fixes**

```bash
git add -u
git commit -m "fix: integration fixes for signal-review command"
```

---

## Flow B: Signal Enricher (Claude with external tools)

> **Prerequisite:** Flow A complete and working.

### Task 5: Create tool functions for external signals

**Files:**
- Create: `outreach_intel/signal_tools.py`
- Test: `tests/test_signal_tools.py`

**Step 1: Write failing tests for tool functions**

```python
# tests/test_signal_tools.py
"""Tests for signal enrichment tools (Flow B)."""
from unittest.mock import patch, MagicMock
from outreach_intel.signal_tools import (
    search_company_news,
    check_job_changes,
    get_hubspot_activity,
)


def test_search_company_news_returns_string():
    """search_company_news returns a string summary."""
    with patch("outreach_intel.signal_tools._firecrawl_search") as mock:
        mock.return_value = [{"title": "Pacific Federal expands", "url": "https://example.com"}]
        result = search_company_news("Pacific Federal Credit Union")

    assert isinstance(result, str)
    assert "Pacific Federal" in result


def test_check_job_changes_returns_string():
    """check_job_changes returns a string summary."""
    with patch("outreach_intel.signal_tools._firecrawl_search") as mock:
        mock.return_value = [{"title": "Sarah Chen promoted to VP", "url": "https://example.com"}]
        result = check_job_changes("Sarah Chen", "Pacific Federal Credit Union")

    assert isinstance(result, str)
    assert len(result) > 0


def test_get_hubspot_activity_returns_string():
    """get_hubspot_activity returns formatted activity summary."""
    mock_contact = {
        "id": "123",
        "properties": {
            "firstname": "Sarah",
            "lastname": "Chen",
            "email": "sarah@example.com",
            "hs_email_last_open_date": "2026-03-01T00:00:00Z",
            "hs_email_last_click_date": "2026-02-28T00:00:00Z",
            "notes_last_updated": "2026-01-15T00:00:00Z",
            "lifecyclestage": "268636563",
        }
    }

    with patch("outreach_intel.signal_tools.HubSpotClient") as MockClient:
        MockClient.return_value.get_contact.return_value = mock_contact
        result = get_hubspot_activity("123")

    assert isinstance(result, str)
    assert "Sarah" in result
```

**Step 2: Run tests to verify they fail**

```bash
pytest tests/test_signal_tools.py -v
```

Expected: FAIL with `ModuleNotFoundError`

**Step 3: Write the tools module**

```python
# outreach_intel/signal_tools.py
"""External signal tools for the Agno agent (Flow B: Signal Enricher).

Each function is a plain Python function with a descriptive docstring.
Agno reads the docstring to tell Claude what the tool does and when
to call it. Claude decides which tools to invoke per contact.
"""
import os
import json
from typing import Optional

import requests
from dotenv import load_dotenv

from outreach_intel.hubspot_client import HubSpotClient

load_dotenv()

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")
FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"


def _firecrawl_search(query: str, limit: int = 5) -> list[dict]:
    """Run a Firecrawl web search. Returns list of result dicts."""
    if not FIRECRAWL_API_KEY:
        return [{"title": "No Firecrawl API key configured", "url": ""}]

    resp = requests.post(
        f"{FIRECRAWL_BASE_URL}/search",
        headers={
            "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
            "Content-Type": "application/json",
        },
        json={"query": query, "limit": limit},
        timeout=15,
    )
    if resp.status_code == 200:
        return resp.json().get("data", [])
    return [{"title": f"Search failed ({resp.status_code})", "url": ""}]


def search_company_news(company_name: str) -> str:
    """Search for recent news about a company.

    Use this tool to find hiring announcements, product launches,
    partnerships, regulatory changes, or leadership moves that
    signal buying intent for income/employment verification.

    Args:
        company_name: The company to search for.

    Returns:
        A summary of recent news, or "No recent news found."
    """
    results = _firecrawl_search(f"{company_name} news 2026", limit=5)

    if not results or (len(results) == 1 and "failed" in results[0].get("title", "")):
        return f"No recent news found for {company_name}."

    summaries = []
    for r in results[:5]:
        title = r.get("title", "Untitled")
        url = r.get("url", "")
        description = r.get("description", "")
        summaries.append(f"- {title}: {description} ({url})")

    return f"Recent news for {company_name}:\n" + "\n".join(summaries)


def check_job_changes(person_name: str, company_name: str) -> str:
    """Check if a person has changed jobs or been promoted recently.

    Use this tool to detect title changes, promotions, or new hires
    that indicate expanded budget authority or new decision-making power.

    Args:
        person_name: Full name of the contact.
        company_name: Their current (or last known) company.

    Returns:
        A summary of any job changes found, or "No job changes detected."
    """
    results = _firecrawl_search(
        f'"{person_name}" "{company_name}" promoted OR hired OR appointed 2026',
        limit=3,
    )

    if not results or (len(results) == 1 and "failed" in results[0].get("title", "")):
        return f"No job changes detected for {person_name} at {company_name}."

    summaries = []
    for r in results[:3]:
        title = r.get("title", "Untitled")
        description = r.get("description", "")
        summaries.append(f"- {title}: {description}")

    return f"Job change signals for {person_name}:\n" + "\n".join(summaries)


def get_hubspot_activity(contact_id: str) -> str:
    """Pull recent CRM activity for a contact from HubSpot.

    Use this tool to check email engagement, last contact dates,
    lifecycle stage, and deal history. Helps determine if a contact
    is re-engaging or still dormant.

    Args:
        contact_id: HubSpot contact ID.

    Returns:
        Formatted summary of CRM activity for the contact.
    """
    client = HubSpotClient()
    contact = client.get_contact(
        contact_id,
        properties=[
            "firstname", "lastname", "email", "jobtitle", "company",
            "lifecyclestage", "hs_lead_status",
            "hs_email_last_open_date", "hs_email_last_click_date",
            "notes_last_updated", "hs_email_sends_since_last_engagement",
        ],
    )

    props = contact.get("properties", {})
    name = f"{props.get('firstname', '')} {props.get('lastname', '')}".strip()

    lines = [
        f"HubSpot activity for {name} (ID: {contact_id}):",
        f"  Email: {props.get('email', 'Unknown')}",
        f"  Title: {props.get('jobtitle', 'Unknown')}",
        f"  Company: {props.get('company', 'Unknown')}",
        f"  Lifecycle Stage: {props.get('lifecyclestage', 'Unknown')}",
        f"  Lead Status: {props.get('hs_lead_status', 'None')}",
        f"  Last Email Open: {props.get('hs_email_last_open_date', 'Never')}",
        f"  Last Email Click: {props.get('hs_email_last_click_date', 'Never')}",
        f"  Last Notes Update: {props.get('notes_last_updated', 'Never')}",
    ]

    # Check for associated deals
    try:
        deals = client.get_contact_deals(contact_id)
        if deals:
            lines.append(f"  Associated Deals: {len(deals)}")
        else:
            lines.append("  Associated Deals: None")
    except Exception:
        lines.append("  Associated Deals: Could not retrieve")

    return "\n".join(lines)
```

**Step 4: Run tests to verify they pass**

```bash
pytest tests/test_signal_tools.py -v
```

Expected: 3 passed

**Step 5: Commit**

```bash
git add outreach_intel/signal_tools.py tests/test_signal_tools.py
git commit -m "feat: add signal enrichment tools (company news, job changes, HubSpot activity)"
```

---

### Task 6: Build the enrichment agent (Flow B)

**Files:**
- Modify: `outreach_intel/signal_agent.py`
- Test: `tests/test_signal_agent.py` (add Flow B tests)

**Step 1: Write failing test for `enrich_contacts()`**

Add to `tests/test_signal_agent.py`:

```python
def test_enrich_contacts_returns_signal_reviews():
    """enrich_contacts (Flow B) returns enriched SignalReview objects."""
    contacts = [_make_scored_contact()]

    mock_response = json.dumps([{
        "contact_id": "123",
        "original_score": 62.5,
        "adjusted_score": 85.0,
        "reasoning": "Company posted 4 lending ops roles. Title changed from Director to VP.",
        "recommended_action": "Route to sales immediately.",
        "confidence": "high",
    }])

    with patch("outreach_intel.signal_agent._run_enrichment_agent") as mock_agent:
        mock_agent.return_value = mock_response
        from outreach_intel.signal_agent import enrich_contacts
        results = enrich_contacts(contacts)

    assert len(results) == 1
    assert results[0].adjusted_score == 85.0
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_signal_agent.py::test_enrich_contacts_returns_signal_reviews -v
```

Expected: FAIL with `ImportError` (function doesn't exist yet)

**Step 3: Add enrichment agent to signal_agent.py**

Add the following to the bottom of `outreach_intel/signal_agent.py`:

```python
# ── Flow B: Signal Enricher ─────────────────────────────────────────

ENRICHMENT_PROMPT = """You are a B2B sales intelligence agent at Truv, a consumer permissioned data platform for income and employment verification.

You have tools to gather external signals about leads. For each contact:
1. Use get_hubspot_activity to check their CRM history
2. Use search_company_news to find recent company developments
3. Use check_job_changes if the contact's title or role might have changed

Truv's ICP: lenders, fintechs, HR platforms needing income/employment verification.

Signals that matter for Truv:
- CRM re-engagement: silence then sudden email opens/clicks
- Hiring surges: lending ops, verification, compliance roles
- Regulatory triggers: NCUA, CFPB, or state-level verification guidance
- Company events: new lending products, geographic expansion, tech overhauls

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


def _run_enrichment_agent(contacts_text: str) -> str:
    """Run the enrichment agent with tools. Separated for mocking."""
    from outreach_intel.signal_tools import (
        search_company_news,
        check_job_changes,
        get_hubspot_activity,
    )

    agent = Agent(
        name="Lead Signal Enricher",
        model=Claude(id="claude-sonnet-4-20250514"),
        instructions=[ENRICHMENT_PROMPT],
        tools=[search_company_news, check_job_changes, get_hubspot_activity],
        markdown=False,
        show_tool_calls=True,
    )

    response = agent.run(
        f"Enrich these leads with external signals, then score and rank them:\n\n{contacts_text}"
    )
    return response.content


def enrich_contacts(
    contacts: list[dict[str, Any]],
    limit: int = 10,
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
    raw = _run_enrichment_agent(contacts_text)

    # Parse (same logic as review_contacts)
    try:
        reviews_data = json.loads(raw)
    except json.JSONDecodeError:
        import re
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
) -> list[SignalReview]:
    """Convenience wrapper accepting ScoredContact objects for Flow B."""
    contacts = [asdict(s) for s in scored]
    return enrich_contacts(contacts, limit=limit)
```

**Step 4: Run tests to verify they pass**

```bash
pytest tests/test_signal_agent.py -v
```

Expected: All passed

**Step 5: Commit**

```bash
git add outreach_intel/signal_agent.py tests/test_signal_agent.py
git commit -m "feat: add signal enrichment agent with tools (Flow B)"
```

---

### Task 7: Add CLI command for signal enrichment

**Files:**
- Modify: `outreach_intel/cli.py`

**Step 1: Add signal-enrich command**

After the `cmd_signal_review` function, add:

```python
def cmd_signal_enrich(args: argparse.Namespace) -> None:
    """Enrich top contacts with external signal tools + Claude."""
    from outreach_intel.signal_agent import enrich_scored_contacts

    service = OutreachService()

    if args.query == "dormant":
        contacts = service.get_dormant_contacts(limit=args.limit)
    elif args.query == "closed-lost":
        contacts = service.get_closed_lost(limit=args.limit)
    elif args.query == "churned":
        contacts = service.get_churned_customers(limit=args.limit)
    else:
        print(f"Unknown query type: {args.query}")
        sys.exit(1)

    if not contacts:
        print("No contacts found.")
        sys.exit(1)

    print(f"\nScored {len(contacts)} contacts. Running signal enrichment (this takes a few minutes)...\n")

    reviews = enrich_scored_contacts(contacts, limit=args.review_limit)

    if args.json:
        from dataclasses import asdict
        output = [asdict(r) for r in reviews]
        print(json.dumps(output, indent=2))
    else:
        print(f"{'='*60}")
        print(f"ENRICHED SIGNAL REVIEW ({len(reviews)} contacts)")
        print(f"{'='*60}\n")
        for i, r in enumerate(reviews, 1):
            match = next((c for c in contacts if c.contact_id == r.contact_id), None)
            name = match.name if match else r.contact_id
            company = match.company if match else ""

            print(f"{i}. {name} ({company})")
            print(f"   Score: {r.original_score:.0f} -> {r.adjusted_score:.0f} [{r.confidence}]")
            print(f"   {r.reasoning}")
            print(f"   Action: {r.recommended_action}")
            print()
```

In `main()`, add the subparser:

```python
    # Signal enrich command (Flow B)
    enrich_parser = subparsers.add_parser(
        "signal-enrich", help="AI-powered signal enrichment with external tools"
    )
    enrich_parser.add_argument(
        "query", choices=["dormant", "closed-lost", "churned"],
        help="Query type to score and enrich"
    )
    enrich_parser.add_argument(
        "-l", "--limit", type=int, default=25,
        help="Contacts to pull from HubSpot"
    )
    enrich_parser.add_argument(
        "-r", "--review-limit", type=int, default=10,
        help="Max contacts to enrich (higher cost per contact)"
    )
    enrich_parser.add_argument(
        "--json", action="store_true", help="Output as JSON"
    )
    enrich_parser.set_defaults(func=cmd_signal_enrich)
```

**Step 2: Run test**

```bash
pytest tests/test_signal_agent.py -v
```

Expected: All passed

**Step 3: Commit**

```bash
git add outreach_intel/cli.py
git commit -m "feat: add signal-enrich CLI command (Flow B)"
```

---

### Task 8: Add Firecrawl API key to environment

**Files:**
- Modify: `.env` (add `FIRECRAWL_API_KEY`)

**Step 1: Check if Firecrawl key exists**

```bash
grep FIRECRAWL .env
```

If missing, add it. You can get a key at https://firecrawl.dev.

**Step 2: Verify tools work**

```bash
python -c "from outreach_intel.signal_tools import search_company_news; print(search_company_news('Pacific Federal Credit Union'))"
```

Expected: Recent news results or "No Firecrawl API key configured" if key is missing.

---

## Flow C: Multi-Agent Team (parallel specialists)

> **Prerequisite:** Flow B complete and working.

### Task 9: Build specialist agents and team coordinator

**Files:**
- Create: `outreach_intel/signal_team.py`
- Test: `tests/test_signal_team.py`

**Step 1: Write failing test**

```python
# tests/test_signal_team.py
"""Tests for multi-agent signal team (Flow C)."""
import json
from unittest.mock import patch, MagicMock
from outreach_intel.signal_team import run_signal_team, SignalReview


def _make_contact():
    return {
        "contact_id": "123",
        "firstname": "Sarah",
        "lastname": "Chen",
        "email": "sarah@example.com",
        "jobtitle": "VP Lending",
        "company": "Pacific Federal Credit Union",
        "lifecyclestage": "268636563",
        "total_score": 62.5,
        "engagement_score": 70.0,
        "timing_score": 50.0,
        "deal_context_score": 80.0,
        "external_trigger_score": 40.0,
    }


def test_run_signal_team_returns_reviews():
    """run_signal_team returns SignalReview objects."""
    mock_response = json.dumps([{
        "contact_id": "123",
        "original_score": 62.5,
        "adjusted_score": 91.0,
        "reasoning": "Multiple strong signals across CRM, hiring, and regulatory dimensions.",
        "recommended_action": "Priority outreach from account executive.",
        "confidence": "high",
    }])

    with patch("outreach_intel.signal_team._run_team") as mock:
        mock.return_value = mock_response
        results = run_signal_team([_make_contact()])

    assert len(results) == 1
    assert results[0].adjusted_score == 91.0


def test_run_signal_team_empty():
    """run_signal_team returns empty for empty input."""
    assert run_signal_team([]) == []
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_signal_team.py -v
```

Expected: FAIL with `ModuleNotFoundError`

**Step 3: Write the team module**

```python
# outreach_intel/signal_team.py
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
from dataclasses import dataclass, asdict
from typing import Any

from agno.agent import Agent
from agno.models.anthropic import Claude
from agno.team.team import Team
from agno.team.mode import TeamMode

from outreach_intel.signal_agent import SignalReview, _format_contacts_for_prompt


def _build_crm_analyst() -> Agent:
    """CRM Analyst: deep-dives into HubSpot activity patterns."""
    from outreach_intel.signal_tools import get_hubspot_activity

    return Agent(
        name="CRM Analyst",
        role="Analyze CRM engagement patterns and deal history for each contact",
        model=Claude(id="claude-sonnet-4-20250514"),
        tools=[get_hubspot_activity],
        instructions=[
            "You analyze HubSpot CRM data for buying signals.",
            "Look for: re-engagement patterns (silence then activity), "
            "lifecycle stage transitions, deal history, email engagement spikes.",
            "Report your findings as structured text, one section per contact.",
        ],
    )


def _build_market_scout() -> Agent:
    """Market Scout: searches for external company and people signals."""
    from outreach_intel.signal_tools import search_company_news, check_job_changes

    return Agent(
        name="Market Scout",
        role="Search for external signals: company news, hiring patterns, job changes",
        model=Claude(id="claude-sonnet-4-20250514"),
        tools=[search_company_news, check_job_changes],
        instructions=[
            "You search for external buying signals relevant to Truv's business "
            "(income and employment verification for lenders, fintechs, HR platforms).",
            "Look for: hiring surges in lending/compliance roles, "
            "regulatory changes (NCUA, CFPB), geographic expansion, "
            "tech overhauls, leadership changes.",
            "Report findings as structured text, one section per contact.",
        ],
    )


def _run_team(contacts_text: str) -> str:
    """Run the multi-agent team. Separated for mocking."""
    crm_analyst = _build_crm_analyst()
    market_scout = _build_market_scout()

    team = Team(
        name="Lead Signal Team",
        mode=TeamMode.coordinate,
        model=Claude(id="claude-sonnet-4-20250514"),
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
) -> list[SignalReview]:
    """Run the full multi-agent team on a batch of contacts.

    Flow C: parallel specialist agents coordinated by a leader.
    Most comprehensive analysis, highest cost.

    Args:
        contacts: List of scored contact dicts
        limit: Max contacts (keep small, ~$2/batch)

    Returns:
        List of SignalReview objects sorted by adjusted_score descending
    """
    if not contacts:
        return []

    batch = contacts[:limit]
    contacts_text = _format_contacts_for_prompt(batch)
    raw = _run_team(contacts_text)

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
```

**Step 4: Run tests**

```bash
pytest tests/test_signal_team.py -v
```

Expected: 2 passed

**Step 5: Commit**

```bash
git add outreach_intel/signal_team.py tests/test_signal_team.py
git commit -m "feat: add multi-agent signal team (Flow C)"
```

---

### Task 10: Add CLI command for team analysis

**Files:**
- Modify: `outreach_intel/cli.py`

**Step 1: Add signal-team command**

After `cmd_signal_enrich`, add:

```python
def cmd_signal_team(args: argparse.Namespace) -> None:
    """Run full multi-agent team analysis on top contacts."""
    from outreach_intel.signal_team import run_signal_team
    from outreach_intel.scorer import ContactScorer

    service = OutreachService()

    if args.query == "dormant":
        contacts = service.get_dormant_contacts(limit=args.limit)
    elif args.query == "closed-lost":
        contacts = service.get_closed_lost(limit=args.limit)
    elif args.query == "churned":
        contacts = service.get_churned_customers(limit=args.limit)
    else:
        print(f"Unknown query type: {args.query}")
        sys.exit(1)

    if not contacts:
        print("No contacts found.")
        sys.exit(1)

    print(f"\nScored {len(contacts)} contacts. Running multi-agent team (this takes 5-8 minutes)...\n")

    from dataclasses import asdict
    contact_dicts = [asdict(c) for c in contacts]
    reviews = run_signal_team(contact_dicts, limit=args.review_limit)

    if args.json:
        output = [asdict(r) for r in reviews]
        print(json.dumps(output, indent=2))
    else:
        print(f"{'='*60}")
        print(f"TEAM SIGNAL ANALYSIS ({len(reviews)} contacts)")
        print(f"{'='*60}\n")
        for i, r in enumerate(reviews, 1):
            match = next((c for c in contacts if c.contact_id == r.contact_id), None)
            name = match.name if match else r.contact_id
            company = match.company if match else ""

            print(f"{i}. {name} ({company})")
            print(f"   Score: {r.original_score:.0f} -> {r.adjusted_score:.0f} [{r.confidence}]")
            print(f"   {r.reasoning}")
            print(f"   Action: {r.recommended_action}")
            print()
```

In `main()`, add:

```python
    # Signal team command (Flow C)
    team_parser = subparsers.add_parser(
        "signal-team", help="Multi-agent team signal analysis (comprehensive, higher cost)"
    )
    team_parser.add_argument(
        "query", choices=["dormant", "closed-lost", "churned"],
        help="Query type to analyze"
    )
    team_parser.add_argument(
        "-l", "--limit", type=int, default=25,
        help="Contacts to pull from HubSpot"
    )
    team_parser.add_argument(
        "-r", "--review-limit", type=int, default=5,
        help="Max contacts to run through the team (keep small)"
    )
    team_parser.add_argument(
        "--json", action="store_true", help="Output as JSON"
    )
    team_parser.set_defaults(func=cmd_signal_team)
```

**Step 2: Run all tests**

```bash
pytest tests/ -v
```

Expected: All passed

**Step 3: Commit**

```bash
git add outreach_intel/cli.py
git commit -m "feat: add signal-team CLI command (Flow C)"
```

---

## Integration: Pipedream Automation

### Task 11: Wire Flow A into the existing Pipedream workflow

**Files:**
- Document: `docs/plans/signal-agent-pipedream.md`

**Step 1: Document the Pipedream integration plan**

The existing Pipedream workflow (Friday 7:30 AM CST) already:
1. Queries HubSpot for dormant contacts
2. Scores them with `ContactScorer`
3. Creates a list
4. Notifies Slack

To add Flow A, insert a step between scoring and list creation:

```
Step 1: Search HubSpot (existing)
Step 2: Score contacts (existing)
Step 3: NEW — Run signal_agent.review_scored_contacts() on top 25
Step 4: Create list sorted by adjusted_score (existing, modified)
Step 5: Notify Slack with Claude's reasoning (existing, enriched)
```

The Pipedream step would call the Python function via a code step or via an API route.

**Option A (simpler):** Add a Vercel API route `/api/signal-review` that accepts scored contacts and returns SignalReview JSON.

**Option B (direct):** Run the Python code in Pipedream's Python step with `agno` and `anthropic` packages.

Recommendation: Option A. Keeps the agent code in the repo, Pipedream just calls the API.

**Step 2: Commit the doc**

```bash
git add docs/plans/signal-agent-pipedream.md
git commit -m "docs: add Pipedream integration plan for signal agent"
```

---

## Summary: CLI Commands After Full Build

```bash
# Flow A: Smart Scorer (~$0.02/run, 30s)
python -m outreach_intel.cli signal-review dormant --limit 25

# Flow B: Signal Enricher (~$0.50/run, 3-5min)
python -m outreach_intel.cli signal-enrich closed-lost --limit 25 --review-limit 10

# Flow C: Multi-Agent Team (~$2.00/run, 5-8min)
python -m outreach_intel.cli signal-team dormant --limit 25 --review-limit 5

# All support --json for piping to other tools
python -m outreach_intel.cli signal-review dormant --json | jq '.[] | select(.confidence == "high")'
```

## Estimated Build Timeline

| Flow | Tasks | Est. Build Time | Files Created/Modified |
|------|-------|----------------|----------------------|
| A: Smart Scorer | Tasks 1-4 | 3-4 hours | 2 new, 2 modified |
| B: Signal Enricher | Tasks 5-8 | 4-6 hours | 2 new, 2 modified |
| C: Multi-Agent Team | Tasks 9-10 | 3-4 hours | 2 new, 1 modified |
| Integration | Task 11 | 2-3 hours | 1 new doc + API route |
| **Total** | **11 tasks** | **12-17 hours** | **7 new, 3 modified** |

Build order: A first, validate with real data, then B, then C. Each flow is independently shippable.
