# Form-Aware Inbound Lead Scoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the scorer and signal agent smart about inbound form data — use case, self-reported volume, role, job function, comments, and referring page — so a 3-person fintech doing 30k-100k verifications scores as enterprise-tier, not "small shop."

**Architecture:** Two layers. Layer 1: deterministic scoring in `scorer.py` that reads form fields from HubSpot properties and produces a `form_fit_score` (0-100). Layer 2: Agno agent tool that pulls form context for the LLM to cross-reference against Apollo enrichment data, catching mismatches like "3 employees but 30k-100k volume." The scorer detects whether a contact has form data (inbound) or not (dormant/outbound) and weights accordingly.

**Tech Stack:** Python, HubSpot API, Agno (Gemini/Claude), Apollo enrichment (existing)

---

## HubSpot Property Map

These are the exact HubSpot contact properties storing form submission data:

| Form Field | HubSpot Property Name | Example Value |
|---|---|---|
| Use Case | `use_case` | "Fintech / Retail banking" |
| Volume (loans) | `how_many_loans_do_you_close_per_year` | "30,000-100,000" |
| Volume (apps) | `how_many_applications_do_you_see_per_year_` | "30,000-100,000" |
| Job Function | `job_function_contact` | "Risk & Compliance" |
| Role Level | `which_of_these_best_describes_your_job_title_` | "Director" |
| How Can We Help | `how_can_we_help` | "Contact sales" |
| Comments | `message` | "Looking to bolster our approval capabilities..." |
| Referring Page | `hs_analytics_first_referrer` | "https://truv.com/solutions/consumer-lending" |
| ECARR | `ecarr` | "" (empty = net-new) |
| Target Account | `target_account` | "false" |

---

## Scoring Design

### Current Weights (dormant/outbound contacts)
```
engagement:       25%  (email opens/clicks)
timing:           25%  (days since activity)
deal_context:     30%  (lifecycle stage)
external_trigger: 20%  (hardcoded at 40)
```

### New Weights (inbound contacts with form data)
```
form_fit:         35%  (use case + volume + role + job function + referring page)
engagement:       15%  (email opens/clicks — less relevant for brand-new inbound)
timing:           10%  (recency — always fresh for inbound)
deal_context:     20%  (lifecycle stage)
external_trigger: 20%  (Apollo: company size, revenue, tech stack, hiring)
```

The scorer auto-detects inbound vs dormant by checking if `use_case` or volume fields are populated.

### Form Fit Score Breakdown (0-100)

| Component | Max Points | Logic |
|---|---|---|
| **Volume** | 35 | 100k+ → 35, 30k-100k → 30, 10k-30k → 22, 1k-10k → 15, <1k → 8 |
| **Use Case Match** | 25 | Mortgage/Consumer Lending → 25, Fintech/Retail Banking → 25, Auto Lending → 22, Personal Loans → 20, HR/Employment → 18, Other → 5 |
| **Role Level** | 15 | C-Suite/EVP → 15, VP → 13, Director → 12, Manager → 8, Individual → 4 |
| **Job Function** | 15 | Risk & Compliance → 15, Operations → 14, Engineering/Product → 12, Finance → 10, Other → 5 |
| **Intent Signals** | 10 | Referring page = /solutions/* → 5, Comments mention verification/income/approval → 5 |

**Rick Pommenville example:**
- Volume: 30k-100k → 30
- Use Case: Fintech / Retail banking → 25
- Role: Director → 12
- Job Function: Risk & Compliance → 15
- Intent: /solutions/consumer-lending (5) + "approval capabilities" + "income verification" (5) → 10
- **Form Fit Score: 92/100**

### External Trigger Score (replaces hardcoded 40)

When Apollo enrichment data is available (via `EnrichmentResult`):

| Component | Max Points | Logic |
|---|---|---|
| **Volume vs Headcount Mismatch** | 30 | Volume > 10k but employees < 50 → 30 ("punching above weight") |
| **Tech Stack Match** | 25 | Encompass/ICE/Blend/legacy VOI → 25, LOS but not VOI → 15, No match → 0 |
| **Hiring Signals** | 25 | Lending/compliance roles open → 25, Engineering roles → 15, No relevant → 0 |
| **Revenue Match** | 20 | Revenue > $50M → 20, $10-50M → 15, $1-10M → 10, Unknown → 5 |

Falls back to 40 when no enrichment data is available (preserves existing behavior).

---

## Tasks

### Task 1: Add form field constants and volume parser to scorer

**Files:**
- Modify: `outreach_intel/scorer.py`
- Test: `tests/test_scorer.py`

**Step 1: Write the failing tests**

```python
# tests/test_scorer.py — add these tests

from outreach_intel.scorer import ContactScorer, parse_volume_range

def test_parse_volume_range_bracket():
    """Parse '30,000-100,000' -> (30000, 100000)."""
    assert parse_volume_range("30,000-100,000") == (30000, 100000)

def test_parse_volume_range_plus():
    """Parse '100,000+' -> (100000, None)."""
    assert parse_volume_range("100,000+") == (100000, None)

def test_parse_volume_range_single():
    """Parse '5000' -> (5000, 5000)."""
    assert parse_volume_range("5000") == (5000, 5000)

def test_parse_volume_range_empty():
    """Parse empty -> (0, 0)."""
    assert parse_volume_range("") == (0, 0)

def test_parse_volume_range_none():
    """Parse None -> (0, 0)."""
    assert parse_volume_range(None) == (0, 0)
```

**Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=. pytest tests/test_scorer.py::test_parse_volume_range_bracket tests/test_scorer.py::test_parse_volume_range_plus tests/test_scorer.py::test_parse_volume_range_single tests/test_scorer.py::test_parse_volume_range_empty tests/test_scorer.py::test_parse_volume_range_none -v`
Expected: FAIL — `parse_volume_range` not defined

**Step 3: Implement volume parser and form field constants**

Add to `outreach_intel/scorer.py`, before the `ContactScorer` class:

```python
import re

# ── HubSpot form field property names ─────────────────────────────
FORM_PROPERTIES = [
    "use_case",
    "how_many_loans_do_you_close_per_year",
    "how_many_applications_do_you_see_per_year_",
    "job_function_contact",
    "which_of_these_best_describes_your_job_title_",
    "how_can_we_help",
    "message",
    "hs_analytics_first_referrer",
    "ecarr",
    "target_account",
]

# ── Use case ICP match tiers ─────────────────────────────────────
USE_CASE_SCORES: dict[str, int] = {
    "mortgage": 25,
    "consumer lending": 25,
    "fintech / retail banking": 25,
    "fintech": 25,
    "retail banking": 25,
    "auto lending": 22,
    "personal loans": 20,
    "hr": 18,
    "employment": 18,
    "background checks": 15,
}

# ── Role level scores ────────────────────────────────────────────
ROLE_SCORES: dict[str, int] = {
    "c-suite": 15,
    "evp": 15,
    "vp": 13,
    "svp": 13,
    "director": 12,
    "senior director": 12,
    "manager": 8,
    "senior manager": 8,
    "individual contributor": 4,
}

# ── Job function scores ──────────────────────────────────────────
JOB_FUNCTION_SCORES: dict[str, int] = {
    "risk & compliance": 15,
    "risk": 15,
    "compliance": 15,
    "operations": 14,
    "lending operations": 14,
    "engineering": 12,
    "product": 12,
    "technology": 12,
    "finance": 10,
}

# ── Intent keywords in comments/message ──────────────────────────
INTENT_KEYWORDS = [
    "verification", "verify", "income", "employment",
    "approval", "underwriting", "compliance", "voi", "voe",
    "automate", "manual process", "paper",
]


def parse_volume_range(value: str | None) -> tuple[int, int | None]:
    """Parse a volume string like '30,000-100,000' into (low, high).

    Returns (0, 0) for empty/None values.
    Returns (N, None) for 'N+' patterns.
    """
    if not value:
        return (0, 0)

    # Strip commas and whitespace
    clean = value.replace(",", "").strip()

    # Handle "100000+" pattern
    plus_match = re.match(r"^(\d+)\+$", clean)
    if plus_match:
        return (int(plus_match.group(1)), None)

    # Handle "30000-100000" range pattern
    range_match = re.match(r"^(\d+)\s*[-–]\s*(\d+)$", clean)
    if range_match:
        return (int(range_match.group(1)), int(range_match.group(2)))

    # Handle single number
    single_match = re.match(r"^(\d+)$", clean)
    if single_match:
        n = int(single_match.group(1))
        return (n, n)

    return (0, 0)
```

**Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=. pytest tests/test_scorer.py -k "parse_volume" -v`
Expected: 5 PASS

**Step 5: Commit**

```bash
git add outreach_intel/scorer.py tests/test_scorer.py
git commit -m "feat: add form field constants and volume parser to scorer"
```

---

### Task 2: Add `_score_form_fit()` method to ContactScorer

**Files:**
- Modify: `outreach_intel/scorer.py`
- Test: `tests/test_scorer.py`

**Step 1: Write the failing tests**

```python
# tests/test_scorer.py — add these tests

def test_score_form_fit_full_match():
    """Rick Pommenville: high-volume fintech director in risk & compliance."""
    scorer = ContactScorer()
    props = {
        "use_case": "Fintech / Retail banking",
        "how_many_loans_do_you_close_per_year": "30,000-100,000",
        "job_function_contact": "Risk & Compliance",
        "which_of_these_best_describes_your_job_title_": "Director",
        "message": "Looking to bolster our approval capabilities and interested to see if income verification would help us.",
        "hs_analytics_first_referrer": "https://truv.com/solutions/consumer-lending",
    }
    score = scorer._score_form_fit(props)
    assert score >= 85, f"Expected >= 85 for ideal ICP inbound, got {score}"

def test_score_form_fit_no_form_data():
    """Dormant contact with no form fields returns 0."""
    scorer = ContactScorer()
    props = {
        "firstname": "John",
        "lastname": "Smith",
        "email": "john@example.com",
    }
    score = scorer._score_form_fit(props)
    assert score == 0

def test_score_form_fit_partial_data():
    """Contact with only use case and role, no volume."""
    scorer = ContactScorer()
    props = {
        "use_case": "Mortgage",
        "which_of_these_best_describes_your_job_title_": "Manager",
    }
    score = scorer._score_form_fit(props)
    # use_case=25, role=8, no volume/function/intent = 0
    assert 30 <= score <= 40, f"Expected 30-40 for partial, got {score}"

def test_score_form_fit_low_volume_wrong_use_case():
    """Low volume, unrelated use case, junior role."""
    scorer = ContactScorer()
    props = {
        "use_case": "Other",
        "how_many_loans_do_you_close_per_year": "100",
        "which_of_these_best_describes_your_job_title_": "Individual Contributor",
        "job_function_contact": "Marketing",
    }
    score = scorer._score_form_fit(props)
    assert score <= 25, f"Expected <= 25 for poor fit, got {score}"

def test_score_form_fit_applications_volume_field():
    """Volume from applications field instead of loans field."""
    scorer = ContactScorer()
    props = {
        "how_many_applications_do_you_see_per_year_": "100,000+",
        "use_case": "Consumer Lending",
    }
    score = scorer._score_form_fit(props)
    # volume=35 + use_case=25 = 60+
    assert score >= 55, f"Expected >= 55, got {score}"
```

**Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=. pytest tests/test_scorer.py -k "score_form_fit" -v`
Expected: FAIL — `_score_form_fit` not defined

**Step 3: Implement `_score_form_fit()`**

Add to `ContactScorer` class in `outreach_intel/scorer.py`:

```python
def _score_form_fit(self, props: dict[str, Any]) -> float:
    """Score based on form submission data (inbound leads).

    Components (max 100):
        Volume:        35 pts — self-reported loan/application volume
        Use Case:      25 pts — ICP vertical match
        Role Level:    15 pts — seniority/authority
        Job Function:  15 pts — department relevance
        Intent:        10 pts — referring page + comment keywords
    """
    score = 0.0

    # ── Volume (35 pts) ──────────────────────────────────────
    vol_str = (
        props.get("how_many_loans_do_you_close_per_year")
        or props.get("how_many_applications_do_you_see_per_year_")
        or ""
    )
    low, high = parse_volume_range(vol_str)
    # Use the lower bound for scoring
    if low >= 100_000:
        score += 35
    elif low >= 30_000:
        score += 30
    elif low >= 10_000:
        score += 22
    elif low >= 1_000:
        score += 15
    elif low > 0:
        score += 8

    # ── Use Case (25 pts) ────────────────────────────────────
    use_case = (props.get("use_case") or "").lower().strip()
    use_case_pts = 0
    for pattern, pts in USE_CASE_SCORES.items():
        if pattern in use_case:
            use_case_pts = max(use_case_pts, pts)
    if use_case and not use_case_pts:
        use_case_pts = 5  # Unknown but present = some intent
    score += use_case_pts

    # ── Role Level (15 pts) ──────────────────────────────────
    role = (props.get("which_of_these_best_describes_your_job_title_") or "").lower().strip()
    role_pts = 0
    for pattern, pts in ROLE_SCORES.items():
        if pattern in role:
            role_pts = max(role_pts, pts)
    score += role_pts

    # ── Job Function (15 pts) ────────────────────────────────
    function = (props.get("job_function_contact") or "").lower().strip()
    function_pts = 0
    for pattern, pts in JOB_FUNCTION_SCORES.items():
        if pattern in function:
            function_pts = max(function_pts, pts)
    if function and not function_pts:
        function_pts = 5  # Known function but not core ICP
    score += function_pts

    # ── Intent Signals (10 pts) ──────────────────────────────
    # Referring page from solutions section = 5 pts
    referrer = props.get("hs_analytics_first_referrer") or ""
    if "/solutions/" in referrer or "/products/" in referrer:
        score += 5

    # Comments/message contain intent keywords = 5 pts
    comments = (
        (props.get("message") or "")
        + " "
        + (props.get("how_can_we_help") or "")
    ).lower()
    if any(kw in comments for kw in INTENT_KEYWORDS):
        score += 5

    return min(score, 100)
```

**Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=. pytest tests/test_scorer.py -k "score_form_fit" -v`
Expected: 5 PASS

**Step 5: Commit**

```bash
git add outreach_intel/scorer.py tests/test_scorer.py
git commit -m "feat: add form fit scoring for inbound leads"
```

---

### Task 3: Wire form_fit into the scoring pipeline with auto-detect

**Files:**
- Modify: `outreach_intel/scorer.py`
- Test: `tests/test_scorer.py`

**Step 1: Write the failing tests**

```python
# tests/test_scorer.py — add these tests

def test_inbound_contact_uses_form_weights():
    """Contact with form data should use inbound weight profile."""
    scorer = ContactScorer()
    contact = {
        "id": "123",
        "properties": {
            "firstname": "Rick",
            "lastname": "Pommenville",
            "email": "rick@own.lease",
            "jobtitle": "Director",
            "company": "Own.lease",
            "lifecyclestage": "lead",
            "use_case": "Fintech / Retail banking",
            "how_many_loans_do_you_close_per_year": "30,000-100,000",
            "job_function_contact": "Risk & Compliance",
            "which_of_these_best_describes_your_job_title_": "Director",
            "message": "Looking to bolster our approval capabilities and interested to see if income verification would help us.",
            "hs_analytics_first_referrer": "https://truv.com/solutions/consumer-lending",
        },
    }
    scored = scorer.score_contact(contact)
    # Form fit should be high (~92), overall should be well above 50
    assert scored.form_fit_score > 80
    assert scored.total_score > 55

def test_dormant_contact_uses_standard_weights():
    """Contact without form data should use standard weight profile."""
    scorer = ContactScorer()
    contact = {
        "id": "456",
        "properties": {
            "firstname": "Jane",
            "lastname": "Doe",
            "email": "jane@acme.com",
            "jobtitle": "VP Operations",
            "company": "ACME Lending",
            "lifecyclestage": "268636563",  # Closed Lost
            "hs_email_last_open_date": "2026-02-15T10:00:00Z",
        },
    }
    scored = scorer.score_contact(contact)
    assert scored.form_fit_score == 0
    # Should still score reasonably from engagement + deal context
    assert scored.total_score > 30

def test_scored_contact_has_form_fit_field():
    """ScoredContact dataclass should include form_fit_score."""
    scorer = ContactScorer()
    contact = {"id": "789", "properties": {"firstname": "Test"}}
    scored = scorer.score_contact(contact)
    assert hasattr(scored, "form_fit_score")
```

**Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=. pytest tests/test_scorer.py -k "inbound_contact or dormant_contact or form_fit_field" -v`
Expected: FAIL — `form_fit_score` not in ScoredContact

**Step 3: Update ScoredContact and scoring pipeline**

In `outreach_intel/scorer.py`:

1. Add `form_fit_score: float` field to `ScoredContact` dataclass (after `external_trigger_score`).

2. Add inbound weight profile to `ContactScorer`:

```python
INBOUND_WEIGHTS = {
    "form_fit": 0.35,
    "engagement": 0.15,
    "timing": 0.10,
    "deal_context": 0.20,
    "external_trigger": 0.20,
}
```

3. Add `_has_form_data()` helper:

```python
def _has_form_data(self, props: dict[str, Any]) -> bool:
    """Detect if contact has inbound form submission data."""
    return bool(
        props.get("use_case")
        or props.get("how_many_loans_do_you_close_per_year")
        or props.get("how_many_applications_do_you_see_per_year_")
    )
```

4. Update `score_contact()` to calculate form_fit and select weights:

```python
def score_contact(self, contact: dict[str, Any]) -> ScoredContact:
    props = contact.get("properties", {})

    engagement = self._score_engagement(props)
    timing = self._score_timing(props)
    deal_context = self._score_deal_context(props)
    external = self._score_external_triggers(props)
    form_fit = self._score_form_fit(props)

    # Auto-detect inbound vs dormant
    if self._has_form_data(props):
        weights = self.INBOUND_WEIGHTS
        total = (
            form_fit * weights["form_fit"]
            + engagement * weights["engagement"]
            + timing * weights["timing"]
            + deal_context * weights["deal_context"]
            + external * weights["external_trigger"]
        )
    else:
        total = (
            engagement * self.weights["engagement"]
            + timing * self.weights["timing"]
            + deal_context * self.weights["deal_context"]
            + external * self.weights["external_trigger"]
        )

    return ScoredContact(
        contact_id=contact.get("id", ""),
        firstname=props.get("firstname", ""),
        lastname=props.get("lastname", ""),
        email=props.get("email", ""),
        jobtitle=props.get("jobtitle", ""),
        company=props.get("company", ""),
        lifecyclestage=props.get("lifecyclestage", ""),
        engagement_score=engagement,
        timing_score=timing,
        deal_context_score=deal_context,
        external_trigger_score=external,
        form_fit_score=form_fit,
        total_score=total,
        raw_properties=props,
    )
```

**Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=. pytest tests/test_scorer.py -v`
Expected: ALL PASS (including existing tests — check no regressions)

**Step 5: Commit**

```bash
git add outreach_intel/scorer.py tests/test_scorer.py
git commit -m "feat: wire form_fit_score into scoring pipeline with inbound auto-detect"
```

---

### Task 4: Add `get_form_context` agent tool

**Files:**
- Modify: `outreach_intel/signal_tools.py`
- Test: `tests/test_signal_tools.py`

**Step 1: Write the failing test**

```python
# tests/test_signal_tools.py — add this test

from unittest.mock import patch, MagicMock

def test_get_form_context_returns_form_fields():
    """get_form_context pulls form submission fields from HubSpot."""
    mock_client = MagicMock()
    mock_client.get_contact.return_value = {
        "properties": {
            "firstname": "Rick",
            "lastname": "Pommenville",
            "use_case": "Fintech / Retail banking",
            "how_many_loans_do_you_close_per_year": "30,000-100,000",
            "job_function_contact": "Risk & Compliance",
            "which_of_these_best_describes_your_job_title_": "Director",
            "message": "Looking to bolster our approval capabilities",
            "hs_analytics_first_referrer": "https://truv.com/solutions/consumer-lending",
            "how_can_we_help": "Contact sales",
            "ecarr": "",
            "target_account": "false",
        },
    }

    with patch("outreach_intel.signal_tools.HubSpotClient", return_value=mock_client):
        from outreach_intel.signal_tools import get_form_context
        result = get_form_context("12345")

    assert "Fintech / Retail banking" in result
    assert "30,000-100,000" in result
    assert "Risk & Compliance" in result
    assert "Director" in result
    assert "consumer-lending" in result
    assert "approval capabilities" in result
```

**Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. pytest tests/test_signal_tools.py::test_get_form_context_returns_form_fields -v`
Expected: FAIL — `get_form_context` not defined

**Step 3: Implement `get_form_context`**

Add to `outreach_intel/signal_tools.py` (after `get_hubspot_activity`):

```python
def get_form_context(contact_id: str) -> str:
    """Pull form submission data for an inbound lead from HubSpot.

    Use this tool when analyzing an inbound lead to understand their
    self-reported use case, volume, role, and what they're looking for.
    This data comes from their form submission and is critical for
    understanding their actual needs and scale.

    Key signals to look for:
    - Volume vs company size mismatch (high volume + small team = platform play)
    - Use case alignment with Truv's ICP (lending, fintech, HR verification)
    - Seniority level (Director+ = budget authority)
    - Comments mentioning specific pain points (approval, manual process, compliance)

    Args:
        contact_id: HubSpot contact ID.

    Returns:
        Formatted summary of form submission data and qualifying signals.
    """
    from outreach_intel.scorer import FORM_PROPERTIES

    client = HubSpotClient()
    contact = client.get_contact(contact_id, properties=FORM_PROPERTIES)
    props = contact.get("properties", {})

    lines = [f"Form submission data for contact {contact_id}:"]

    field_labels = {
        "use_case": "Use Case",
        "how_many_loans_do_you_close_per_year": "Loan Volume (annual)",
        "how_many_applications_do_you_see_per_year_": "Application Volume (annual)",
        "job_function_contact": "Job Function",
        "which_of_these_best_describes_your_job_title_": "Role Level",
        "how_can_we_help": "How Can We Help",
        "message": "Comments",
        "hs_analytics_first_referrer": "Referring Page",
        "ecarr": "ECARR (existing revenue)",
        "target_account": "Target Account",
    }

    has_data = False
    for prop, label in field_labels.items():
        value = props.get(prop)
        if value:
            lines.append(f"  {label}: {value}")
            has_data = True

    if not has_data:
        return f"No form submission data found for contact {contact_id}. This may be a dormant/outbound contact without a form fill."

    return "\n".join(lines)
```

**Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. pytest tests/test_signal_tools.py::test_get_form_context_returns_form_fields -v`
Expected: PASS

**Step 5: Commit**

```bash
git add outreach_intel/signal_tools.py tests/test_signal_tools.py
git commit -m "feat: add get_form_context agent tool for inbound lead data"
```

---

### Task 5: Register new tool and update agent prompts

**Files:**
- Modify: `outreach_intel/signal_agent.py`
- Modify: `outreach_intel/signal_team.py`

**Step 1: Update ENRICHMENT_PROMPT in signal_agent.py**

Add to the tool instructions section (after existing step 6):

```
7. Use get_form_context for inbound leads to see their form submission data (use case, volume, role, comments)

Key analysis pattern for inbound leads:
- ALWAYS call get_form_context first if the contact has a HubSpot ID
- Cross-reference self-reported volume against Apollo employee count
- If volume >> headcount, this is a high-growth platform play — score UP significantly
- Use case + referring page tells you exactly what product they need
- Role + job function tells you if they have buying authority
- Comments reveal specific pain points — reference these in your reasoning
```

**Step 2: Register `get_form_context` in `_run_enrichment_agent()` tools list**

```python
from outreach_intel.signal_tools import (
    search_company_news,
    check_job_changes,
    get_hubspot_activity,
    enrich_contact_data,
    check_company_hiring,
    detect_job_change,
    get_form_context,  # NEW
)

# In the Agent tools list:
tools=[
    search_company_news,
    check_job_changes,
    get_hubspot_activity,
    enrich_contact_data,
    check_company_hiring,
    detect_job_change,
    get_form_context,  # NEW
],
```

**Step 3: Update signal_team.py — add `get_form_context` to CRM Analyst's tools**

The CRM Analyst is the right agent to pull form context (it's CRM data):

```python
def _build_crm_analyst(model_provider: str | None = None) -> Agent:
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
```

**Step 4: Run existing tests to verify no regressions**

Run: `PYTHONPATH=. pytest tests/test_signal_agent.py tests/test_signal_team.py -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add outreach_intel/signal_agent.py outreach_intel/signal_team.py
git commit -m "feat: register get_form_context tool and update agent prompts for inbound"
```

---

### Task 6: Update HubSpot property fetching to include form fields

**Files:**
- Modify: `outreach_intel/service.py` (or wherever contacts are fetched for scoring)
- Modify: `scripts/demo_signal_enrich.py`

**Step 1: Update contact property lists**

Any place that fetches contacts for scoring needs to include `FORM_PROPERTIES`. Check these locations:

1. **`outreach_intel/service.py`** — `get_dormant_contacts()`, `get_closed_lost()`, `get_churned_customers()` — add form properties to the `properties` list passed to `search_contacts()`.

2. **`scripts/demo_signal_enrich.py`** — update the `batch_get_contacts()` call to include form properties:

```python
from outreach_intel.scorer import FORM_PROPERTIES

contacts_raw = hs.batch_get_contacts(
    member_ids[:args.limit],
    properties=[
        "firstname", "lastname", "email", "jobtitle", "company",
        "lifecyclestage", "hs_lead_status", "industry", "sales_vertical",
        "hs_email_last_open_date", "hs_email_last_click_date",
        "notes_last_updated", "hs_email_sends_since_last_engagement",
    ] + FORM_PROPERTIES,
)
```

3. **`outreach_intel/signal_tools.py`** — update `get_hubspot_activity()` to also fetch form properties so the agent sees them in CRM context.

**Step 2: Update format_contact in cli.py to show form fit score**

```python
def format_contact(contact: ScoredContact, rank: int) -> str:
    parts = (
        f"{rank}. {contact.name} ({contact.jobtitle or 'Unknown Title'})\n"
        f"   Company: {contact.company or 'Unknown'}\n"
        f"   Email: {contact.email}\n"
        f"   Score: {contact.total_score:.1f} | "
        f"Stage: {contact.lifecyclestage}\n"
        f"   Breakdown: Engagement={contact.engagement_score:.0f} "
        f"Timing={contact.timing_score:.0f} "
        f"Context={contact.deal_context_score:.0f}"
    )
    if contact.form_fit_score > 0:
        parts += f" FormFit={contact.form_fit_score:.0f}"
    return parts
```

**Step 3: Update demo script to display form fit score**

In `scripts/demo_signal_enrich.py`, add `form_fit_score` to the scored dict and display:

```python
scored.append({
    ...existing fields...,
    "form_fit_score": sc.form_fit_score,
})

# In the display loop:
print(f"    {name:<30} Score: {s['total_score']:5.1f}  "
      f"(E={s['engagement_score']:.0f} T={s['timing_score']:.0f} "
      f"D={s['deal_context_score']:.0f} X={s['external_trigger_score']:.0f}"
      f"{f' F={s[\"form_fit_score\"]:.0f}' if s['form_fit_score'] > 0 else ''})")
```

**Step 4: Run all tests**

Run: `PYTHONPATH=. pytest tests/ -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add outreach_intel/service.py outreach_intel/signal_tools.py outreach_intel/cli.py scripts/demo_signal_enrich.py
git commit -m "feat: fetch form properties everywhere and display form_fit_score"
```

---

### Task 7: Add CLI command `score-inbound` for single-contact scoring

**Files:**
- Modify: `outreach_intel/cli.py`
- Test: `tests/test_signal_agent.py`

**Step 1: Write the failing test**

```python
# tests/test_signal_agent.py — add this test

def test_cli_score_inbound_registered():
    """score-inbound CLI command is registered."""
    from outreach_intel.cli import main
    import sys
    try:
        main(["score-inbound", "--help"])
    except SystemExit as e:
        assert e.code == 0
```

**Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. pytest tests/test_signal_agent.py::test_cli_score_inbound_registered -v`
Expected: FAIL

**Step 3: Implement `cmd_score_inbound` and register subparser**

```python
def cmd_score_inbound(args: argparse.Namespace) -> None:
    """Score a single inbound contact with form data + Apollo enrichment."""
    from outreach_intel.scorer import ContactScorer, FORM_PROPERTIES
    from outreach_intel.hubspot_client import HubSpotClient
    from outreach_intel.enrichment import EnrichmentService

    hs = HubSpotClient()
    scorer = ContactScorer()

    # Look up contact
    if args.email:
        contact = hs.get_contact_by_email(
            args.email,
            properties=[
                "firstname", "lastname", "email", "jobtitle", "company",
                "lifecyclestage", "hs_lead_status",
                "hs_email_last_open_date", "hs_email_last_click_date",
                "notes_last_updated",
            ] + FORM_PROPERTIES,
        )
        if not contact:
            print(f"No contact found for {args.email}")
            sys.exit(1)
    elif args.contact_id:
        contact = hs.get_contact(
            args.contact_id,
            properties=[
                "firstname", "lastname", "email", "jobtitle", "company",
                "lifecyclestage", "hs_lead_status",
                "hs_email_last_open_date", "hs_email_last_click_date",
                "notes_last_updated",
            ] + FORM_PROPERTIES,
        )
    else:
        print("Provide --email or --contact-id")
        sys.exit(1)

    props = contact.get("properties", {})
    name = f"{props.get('firstname', '')} {props.get('lastname', '')}".strip()

    # Step 1: Score
    print(f"\n{'='*60}")
    print(f"INBOUND LEAD SCORING: {name}")
    print(f"{'='*60}")

    scored = scorer.score_contact(contact)

    print(f"\n  Form Fit:        {scored.form_fit_score:.0f}/100")
    print(f"  Engagement:      {scored.engagement_score:.0f}/100")
    print(f"  Timing:          {scored.timing_score:.0f}/100")
    print(f"  Deal Context:    {scored.deal_context_score:.0f}/100")
    print(f"  External Trigger:{scored.external_trigger_score:.0f}/100")
    print(f"  ─────────────────────────")
    print(f"  TOTAL:           {scored.total_score:.1f}/100")

    # Show form data
    form_fields = {
        "use_case": "Use Case",
        "how_many_loans_do_you_close_per_year": "Loan Volume",
        "how_many_applications_do_you_see_per_year_": "App Volume",
        "job_function_contact": "Job Function",
        "which_of_these_best_describes_your_job_title_": "Role",
        "message": "Comments",
        "hs_analytics_first_referrer": "Referring Page",
    }
    has_form = False
    for prop, label in form_fields.items():
        value = props.get(prop)
        if value:
            if not has_form:
                print(f"\n  Form Submission Data:")
                has_form = True
            print(f"    {label}: {value}")

    # Step 2: Apollo enrichment
    if not args.skip_enrich:
        print(f"\n  Enriching via Apollo...")
        svc = EnrichmentService()
        result = svc.enrich_contact(
            email=props.get("email"),
            first_name=props.get("firstname"),
            last_name=props.get("lastname"),
            company=props.get("company"),
        )

        if result.company:
            c = result.company
            print(f"\n  Apollo Company Data:")
            if c.employee_count:
                print(f"    Employees: {c.employee_count:,}")
            if c.revenue:
                print(f"    Revenue: {c.revenue}")
            if c.industry:
                print(f"    Industry: {c.industry}")
            if c.tech_stack:
                print(f"    Tech Stack: {', '.join(c.tech_stack[:8])}")

            # Mismatch detection
            vol_str = (
                props.get("how_many_loans_do_you_close_per_year")
                or props.get("how_many_applications_do_you_see_per_year_")
                or ""
            )
            from outreach_intel.scorer import parse_volume_range
            low, _ = parse_volume_range(vol_str)
            if low >= 10_000 and c.employee_count and c.employee_count < 50:
                print(f"\n  *** MISMATCH DETECTED ***")
                print(f"  Self-reported volume: {vol_str}")
                print(f"  Apollo employee count: {c.employee_count}")
                print(f"  Signal: High-volume operation with lean team — likely platform/tech play")

        if result.hiring_signals:
            print(f"\n  Hiring ({len(result.hiring_signals)} open roles):")
            for h in result.hiring_signals[:5]:
                print(f"    - {h.job_title}")

        print(f"\n  Apollo credits used: {result.credits_used}")

    # Step 3: AI agent reasoning (optional)
    if args.agent:
        from outreach_intel.signal_agent import enrich_contacts
        from dataclasses import asdict

        print(f"\n  Running AI agent ({args.model})...")
        contact_dict = asdict(scored)
        reviews = enrich_contacts([contact_dict], limit=1, model_provider=args.model)
        if reviews:
            r = reviews[0]
            print(f"\n  AI Assessment:")
            print(f"    Adjusted Score: {r.adjusted_score:.0f} [{r.confidence}]")
            print(f"    {r.reasoning}")
            print(f"    Action: {r.recommended_action}")

    print()
```

Register the subparser:

```python
# Score inbound command
inbound_parser = subparsers.add_parser(
    "score-inbound", help="Score a single inbound lead with form data + Apollo"
)
inbound_parser.add_argument("--email", help="Contact email address")
inbound_parser.add_argument("--contact-id", help="HubSpot contact ID")
inbound_parser.add_argument(
    "--skip-enrich", action="store_true", help="Skip Apollo enrichment"
)
inbound_parser.add_argument(
    "--agent", action="store_true", help="Run AI agent reasoning after scoring"
)
inbound_parser.add_argument(
    "-m", "--model", choices=["gemini", "claude"], default="gemini",
    help="LLM provider for agent (default: gemini)"
)
inbound_parser.set_defaults(func=cmd_score_inbound)
```

**Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. pytest tests/test_signal_agent.py::test_cli_score_inbound_registered -v`
Expected: PASS

**Step 5: Commit**

```bash
git add outreach_intel/cli.py tests/test_signal_agent.py
git commit -m "feat: add score-inbound CLI command for single-contact scoring"
```

---

### Task 8: Mirror changes to gtm_automation

**Files:**
- Copy updated: `scorer.py`, `signal_tools.py`, `signal_agent.py`, `signal_team.py`, `cli.py`
- Target: `/tmp/gtm_automation_clone/Agno Agent/agno_signal/`

**Step 1: Copy files and swap imports**

For each file, copy from `outreach_intel/` to `agno_signal/` and replace:
- `outreach_intel.` → `agno_signal.`
- `from outreach_intel.` → `from agno_signal.`

**Step 2: Run standalone tests**

Run: `cd "/tmp/gtm_automation_clone/Agno Agent" && PYTHONPATH=. pytest agno_signal/tests/ -v`
Expected: ALL PASS

**Step 3: Commit and push**

```bash
cd "/tmp/gtm_automation_clone/Agno Agent"
git add agno_signal/
git commit -m "feat: add form-aware inbound lead scoring with volume mismatch detection"
git push origin production
```

---

## Verification

1. **Unit tests:** `PYTHONPATH=. pytest tests/test_scorer.py tests/test_signal_tools.py tests/test_signal_agent.py -v` — all pass
2. **Rick Pommenville test:**
   ```bash
   PYTHONPATH=. python -m outreach_intel.cli score-inbound --email rick@own.lease
   ```
   Expected: Form Fit ~92, Total > 55, mismatch detected (30k-100k volume vs small headcount)
3. **Rick with AI agent:**
   ```bash
   PYTHONPATH=. python -m outreach_intel.cli score-inbound --email rick@own.lease --agent -m gemini
   ```
   Expected: Agent reasoning references volume mismatch, recommends fast-track to sales
4. **Dormant contact regression:** Existing dormant/closed-lost scoring unchanged (form_fit_score = 0, standard weights used)
5. **Batch inbound scoring:**
   ```bash
   PYTHONPATH=. python scripts/demo_signal_enrich.py 9229 --model gemini
   ```
   Expected: Inbound contacts show FormFit scores; dormant contacts score normally

---

## What This Does NOT Include (Future)

- **Real-time webhook scoring** — auto-score when form is submitted (needs Pipedream trigger on HubSpot workflow)
- **Write-back to HubSpot** — store `form_fit_score` and `total_score` as contact properties for sales dashboards
- **Apollo-based external_trigger replacement** — `_score_external_triggers` still returns hardcoded 40 unless enrichment data is passed in; a future task should wire Apollo results into this method
- **Slack notification on high-score inbound** — alert #outreach-intelligence when score > 75
