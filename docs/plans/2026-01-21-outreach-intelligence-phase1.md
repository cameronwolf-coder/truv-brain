# Outreach Intelligence Phase 1 - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build HubSpot API integration with basic querying, scoring, and list creation capabilities.

**Architecture:** Python package (`outreach_intel/`) with HubSpot client, contact scoring engine, and CLI interface. Uses existing campaign rules from `/rules/` for scoring logic. Stores API token in `.env` file.

**Tech Stack:** Python 3.11+, `requests` for HTTP, `python-dotenv` for env vars, `pytest` for testing

---

## Task 1: Project Setup

**Files:**
- Create: `outreach_intel/__init__.py`
- Create: `outreach_intel/requirements.txt`
- Create: `.env.example`
- Create: `tests/__init__.py`
- Modify: `.gitignore`

**Step 1: Create package structure**

```bash
mkdir -p outreach_intel tests
```

**Step 2: Create requirements.txt**

Create `outreach_intel/requirements.txt`:
```
requests>=2.31.0
python-dotenv>=1.0.0
pytest>=7.4.0
```

**Step 3: Create .env.example**

Create `.env.example`:
```
HUBSPOT_API_TOKEN=your-hubspot-private-app-token-here
```

**Step 4: Create package init**

Create `outreach_intel/__init__.py`:
```python
"""Truv Outreach Intelligence - HubSpot integration for sales campaigns."""

__version__ = "0.1.0"
```

**Step 5: Create tests init**

Create `tests/__init__.py`:
```python
"""Tests for outreach_intel package."""
```

**Step 6: Update .gitignore**

Add to `.gitignore`:
```
.env
__pycache__/
*.pyc
.pytest_cache/
venv/
```

**Step 7: Create .env with actual token**

Create `.env` (will not be committed):
```
HUBSPOT_API_TOKEN=your-hubspot-api-token-here
```

**Step 8: Install dependencies**

```bash
cd /Users/cameronwolf/Downloads/Projects/truv-brain
python3 -m venv venv
source venv/bin/activate
pip install -r outreach_intel/requirements.txt
```

**Step 9: Commit**

```bash
git add outreach_intel/__init__.py outreach_intel/requirements.txt .env.example .gitignore tests/__init__.py
git commit -m "feat: initialize outreach_intel package structure"
```

---

## Task 2: HubSpot Client - Core HTTP Layer

**Files:**
- Create: `outreach_intel/hubspot_client.py`
- Create: `tests/test_hubspot_client.py`

**Step 1: Write the failing test**

Create `tests/test_hubspot_client.py`:
```python
"""Tests for HubSpot client."""
import os
import pytest
from outreach_intel.hubspot_client import HubSpotClient


def test_client_initialization_with_token():
    """Client initializes with provided token."""
    client = HubSpotClient(api_token="test-token")
    assert client.api_token == "test-token"


def test_client_initialization_from_env(monkeypatch):
    """Client reads token from environment variable."""
    monkeypatch.setenv("HUBSPOT_API_TOKEN", "env-token")
    client = HubSpotClient()
    assert client.api_token == "env-token"


def test_client_raises_without_token(monkeypatch):
    """Client raises error when no token available."""
    monkeypatch.delenv("HUBSPOT_API_TOKEN", raising=False)
    with pytest.raises(ValueError, match="API token"):
        HubSpotClient()
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/cameronwolf/Downloads/Projects/truv-brain
source venv/bin/activate
pytest tests/test_hubspot_client.py -v
```

Expected: FAIL with "ModuleNotFoundError"

**Step 3: Write minimal implementation**

Create `outreach_intel/hubspot_client.py`:
```python
"""HubSpot API client for Outreach Intelligence."""
import os
from typing import Any, Optional
import requests
from dotenv import load_dotenv

load_dotenv()


class HubSpotClient:
    """Client for HubSpot CRM API."""

    BASE_URL = "https://api.hubapi.com"

    def __init__(self, api_token: Optional[str] = None):
        """Initialize client with API token.

        Args:
            api_token: HubSpot private app token. If not provided,
                      reads from HUBSPOT_API_TOKEN environment variable.

        Raises:
            ValueError: If no API token is available.
        """
        self.api_token = api_token or os.getenv("HUBSPOT_API_TOKEN")
        if not self.api_token:
            raise ValueError(
                "API token required. Provide api_token argument or "
                "set HUBSPOT_API_TOKEN environment variable."
            )

    def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[dict] = None,
        json_data: Optional[dict] = None,
    ) -> dict[str, Any]:
        """Make authenticated request to HubSpot API.

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path (e.g., /crm/v3/objects/contacts)
            params: Query parameters
            json_data: JSON body for POST/PUT requests

        Returns:
            Response JSON as dictionary

        Raises:
            requests.HTTPError: If request fails
        """
        url = f"{self.BASE_URL}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            params=params,
            json=json_data,
        )
        response.raise_for_status()
        return response.json()

    def get(self, endpoint: str, params: Optional[dict] = None) -> dict[str, Any]:
        """Make GET request."""
        return self._request("GET", endpoint, params=params)

    def post(
        self, endpoint: str, json_data: Optional[dict] = None
    ) -> dict[str, Any]:
        """Make POST request."""
        return self._request("POST", endpoint, json_data=json_data)
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/test_hubspot_client.py -v
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add outreach_intel/hubspot_client.py tests/test_hubspot_client.py
git commit -m "feat: add HubSpot client core HTTP layer"
```

---

## Task 3: HubSpot Client - Contact Queries

**Files:**
- Modify: `outreach_intel/hubspot_client.py`
- Modify: `tests/test_hubspot_client.py`

**Step 1: Write the failing test**

Add to `tests/test_hubspot_client.py`:
```python
def test_get_contacts_returns_list():
    """get_contacts returns list of contact records."""
    # This is an integration test - requires real API token
    # Skip if no token available
    if not os.getenv("HUBSPOT_API_TOKEN"):
        pytest.skip("No API token available")

    client = HubSpotClient()
    contacts = client.get_contacts(limit=5)

    assert isinstance(contacts, list)
    assert len(contacts) <= 5
    if contacts:
        # Each contact should have an id and properties
        assert "id" in contacts[0]
        assert "properties" in contacts[0]


def test_search_contacts_with_filters():
    """search_contacts applies filters correctly."""
    if not os.getenv("HUBSPOT_API_TOKEN"):
        pytest.skip("No API token available")

    client = HubSpotClient()
    # Search for contacts NOT in excluded lifecycle stages
    contacts = client.search_contacts(
        filters=[
            {
                "propertyName": "lifecyclestage",
                "operator": "NOT_IN",
                "values": ["customer", "268792390"],  # Implementing, Live
            }
        ],
        limit=5,
    )

    assert isinstance(contacts, list)
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_hubspot_client.py::test_get_contacts_returns_list -v
pytest tests/test_hubspot_client.py::test_search_contacts_with_filters -v
```

Expected: FAIL with "AttributeError: 'HubSpotClient' object has no attribute 'get_contacts'"

**Step 3: Write minimal implementation**

Add to `outreach_intel/hubspot_client.py` (after existing methods):
```python
    def get_contacts(
        self,
        limit: int = 100,
        properties: Optional[list[str]] = None,
        after: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Get contacts from HubSpot.

        Args:
            limit: Maximum contacts to return (max 100 per request)
            properties: Contact properties to include
            after: Pagination cursor

        Returns:
            List of contact records
        """
        if properties is None:
            properties = [
                "firstname", "lastname", "email", "jobtitle",
                "company", "lifecyclestage", "hs_lead_status",
            ]

        params = {
            "limit": min(limit, 100),
            "properties": ",".join(properties),
        }
        if after:
            params["after"] = after

        response = self.get("/crm/v3/objects/contacts", params=params)
        return response.get("results", [])

    def search_contacts(
        self,
        filters: Optional[list[dict]] = None,
        sorts: Optional[list[dict]] = None,
        properties: Optional[list[str]] = None,
        limit: int = 100,
        after: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Search contacts with filters.

        Args:
            filters: List of filter objects with propertyName, operator, value(s)
            sorts: List of sort objects with propertyName, direction
            properties: Properties to include in results
            limit: Maximum results to return
            after: Pagination cursor

        Returns:
            List of matching contact records
        """
        if properties is None:
            properties = [
                "firstname", "lastname", "email", "jobtitle",
                "company", "lifecyclestage", "hs_lead_status",
                "industry", "sales_vertical",
            ]

        body: dict[str, Any] = {
            "limit": min(limit, 100),
            "properties": properties,
        }

        if filters:
            body["filterGroups"] = [{"filters": filters}]
        if sorts:
            body["sorts"] = sorts
        if after:
            body["after"] = after

        response = self.post("/crm/v3/objects/contacts/search", json_data=body)
        return response.get("results", [])
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/test_hubspot_client.py -v
```

Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add outreach_intel/hubspot_client.py tests/test_hubspot_client.py
git commit -m "feat: add contact query methods to HubSpot client"
```

---

## Task 4: HubSpot Client - List Operations

**Files:**
- Modify: `outreach_intel/hubspot_client.py`
- Modify: `tests/test_hubspot_client.py`

**Step 1: Write the failing test**

Add to `tests/test_hubspot_client.py`:
```python
def test_get_lists():
    """get_lists returns available lists."""
    if not os.getenv("HUBSPOT_API_TOKEN"):
        pytest.skip("No API token available")

    client = HubSpotClient()
    lists = client.get_lists(limit=5)

    assert isinstance(lists, list)


def test_create_and_delete_list():
    """Can create and delete a static list."""
    if not os.getenv("HUBSPOT_API_TOKEN"):
        pytest.skip("No API token available")

    client = HubSpotClient()

    # Create test list
    test_name = "TEST_DELETE_ME_outreach_intel"
    new_list = client.create_list(
        name=test_name,
        object_type="CONTACT",
    )

    assert new_list is not None
    assert "listId" in new_list or "id" in new_list

    # Clean up - delete the list
    list_id = new_list.get("listId") or new_list.get("id")
    client.delete_list(list_id)
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_hubspot_client.py::test_get_lists -v
pytest tests/test_hubspot_client.py::test_create_and_delete_list -v
```

Expected: FAIL with "AttributeError"

**Step 3: Write minimal implementation**

Add to `outreach_intel/hubspot_client.py`:
```python
    def get_lists(self, limit: int = 100) -> list[dict[str, Any]]:
        """Get contact lists from HubSpot.

        Args:
            limit: Maximum lists to return

        Returns:
            List of list records
        """
        params = {"count": min(limit, 250)}
        response = self.get("/contacts/v1/lists", params=params)
        return response.get("lists", [])

    def create_list(
        self,
        name: str,
        object_type: str = "CONTACT",
    ) -> dict[str, Any]:
        """Create a static list in HubSpot.

        Args:
            name: Name for the new list
            object_type: Object type (CONTACT, COMPANY, etc.)

        Returns:
            Created list record
        """
        body = {
            "name": name,
            "objectTypeId": "0-1" if object_type == "CONTACT" else object_type,
            "processingType": "MANUAL",
        }
        return self.post("/crm/v3/lists", json_data=body)

    def delete_list(self, list_id: str) -> None:
        """Delete a list.

        Args:
            list_id: ID of list to delete
        """
        self._request("DELETE", f"/crm/v3/lists/{list_id}")

    def add_contacts_to_list(
        self,
        list_id: str,
        contact_ids: list[str],
    ) -> dict[str, Any]:
        """Add contacts to a static list.

        Args:
            list_id: ID of the list
            contact_ids: List of contact IDs to add

        Returns:
            Response with update status
        """
        body = {"recordIdsToAdd": contact_ids}
        return self._request(
            "PUT",
            f"/crm/v3/lists/{list_id}/memberships/add",
            json_data=body,
        )
```

Also update the `_request` method to handle DELETE (no JSON response):
```python
    def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[dict] = None,
        json_data: Optional[dict] = None,
    ) -> dict[str, Any]:
        """Make authenticated request to HubSpot API."""
        url = f"{self.BASE_URL}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            params=params,
            json=json_data,
        )
        response.raise_for_status()

        # DELETE requests may return empty response
        if response.status_code == 204 or not response.content:
            return {}
        return response.json()
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/test_hubspot_client.py -v
```

Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add outreach_intel/hubspot_client.py tests/test_hubspot_client.py
git commit -m "feat: add list operations to HubSpot client"
```

---

## Task 5: Exclusion Filter Configuration

**Files:**
- Create: `outreach_intel/config.py`
- Create: `tests/test_config.py`

**Step 1: Write the failing test**

Create `tests/test_config.py`:
```python
"""Tests for configuration."""
from outreach_intel.config import (
    EXCLUDED_LIFECYCLE_STAGES,
    INCLUDED_LIFECYCLE_STAGES,
    CLOSED_WON_DEAL_STAGES,
    get_exclusion_filters,
)


def test_excluded_stages_defined():
    """Excluded lifecycle stages are defined."""
    assert len(EXCLUDED_LIFECYCLE_STAGES) > 0
    assert "customer" in EXCLUDED_LIFECYCLE_STAGES  # Implementing Customer
    assert "268792390" in EXCLUDED_LIFECYCLE_STAGES  # Live Customer


def test_included_stages_defined():
    """Included lifecycle stages are defined."""
    assert len(INCLUDED_LIFECYCLE_STAGES) > 0
    assert "lead" in INCLUDED_LIFECYCLE_STAGES
    assert "268636563" in INCLUDED_LIFECYCLE_STAGES  # Closed Lost


def test_get_exclusion_filters_returns_filter_list():
    """get_exclusion_filters returns HubSpot filter format."""
    filters = get_exclusion_filters()

    assert isinstance(filters, list)
    assert len(filters) > 0

    # Should have a filter for lifecycle stage
    stage_filter = next(
        (f for f in filters if f["propertyName"] == "lifecyclestage"),
        None
    )
    assert stage_filter is not None
    assert stage_filter["operator"] == "NOT_IN"
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_config.py -v
```

Expected: FAIL with "ModuleNotFoundError"

**Step 3: Write minimal implementation**

Create `outreach_intel/config.py`:
```python
"""Configuration for Outreach Intelligence."""

# Lifecycle stages to EXCLUDE (active customers, open deals, disqualified)
EXCLUDED_LIFECYCLE_STAGES = [
    "opportunity",      # Open Deal
    "1154636674",       # Opportunity
    "customer",         # Implementing Customer
    "268792390",        # Live Customer
    "1012659574",       # Indirect Customer
    "1154761341",       # Customer
    "1070076549",       # Advocate
    "other",            # Disqualified / Opt-Out
]

# Lifecycle stages to INCLUDE (dormant prospects, closed lost, churned)
INCLUDED_LIFECYCLE_STAGES = [
    "subscriber",           # New
    "lead",                 # Lead
    "marketingqualifiedlead",  # MQL
    "salesqualifiedlead",   # SAL
    "268636563",            # Closed Lost
    "268798100",            # Churned Customer
]

# Closed Won deal stage IDs (contacts with these are customers)
CLOSED_WON_DEAL_STAGES = [
    "1f7d22d8-b3fd-4918-82c3-ddaa9bdb8a52",  # Enterprise Sales
    "1092340356",                              # Self-Service
    "979907381",                               # Renewals
]

# Default properties to fetch for contacts
DEFAULT_CONTACT_PROPERTIES = [
    # Basic info
    "firstname",
    "lastname",
    "email",
    "jobtitle",
    # Company
    "company",
    "industry",
    "sales_vertical",
    # Status
    "lifecyclestage",
    "hs_lead_status",
    # Engagement
    "notes_last_updated",
    "hs_email_last_open_date",
    "hs_email_last_click_date",
    # Tech stack (mortgage)
    "mortgage_los__new_",
    "mortgage_pos__new_",
    # Volume
    "mortgage_loan_volume",
]


def get_exclusion_filters() -> list[dict]:
    """Get HubSpot search filters to exclude active customers.

    Returns:
        List of filter objects for HubSpot search API
    """
    return [
        {
            "propertyName": "lifecyclestage",
            "operator": "NOT_IN",
            "values": EXCLUDED_LIFECYCLE_STAGES,
        }
    ]


def get_inclusion_filters() -> list[dict]:
    """Get HubSpot search filters for target lifecycle stages.

    Returns:
        List of filter objects for HubSpot search API
    """
    return [
        {
            "propertyName": "lifecyclestage",
            "operator": "IN",
            "values": INCLUDED_LIFECYCLE_STAGES,
        }
    ]
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/test_config.py -v
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add outreach_intel/config.py tests/test_config.py
git commit -m "feat: add exclusion filter configuration"
```

---

## Task 6: Contact Scorer - Basic Implementation

**Files:**
- Create: `outreach_intel/scorer.py`
- Create: `tests/test_scorer.py`

**Step 1: Write the failing test**

Create `tests/test_scorer.py`:
```python
"""Tests for contact scoring."""
from datetime import datetime, timedelta
from outreach_intel.scorer import ContactScorer, ScoredContact


def test_scorer_initialization():
    """Scorer initializes with default weights."""
    scorer = ContactScorer()
    assert scorer.weights is not None
    assert "engagement" in scorer.weights
    assert "timing" in scorer.weights
    assert "deal_context" in scorer.weights


def test_score_contact_returns_scored_contact():
    """score_contact returns ScoredContact with scores."""
    scorer = ContactScorer()
    contact = {
        "id": "123",
        "properties": {
            "firstname": "John",
            "lastname": "Doe",
            "email": "john@example.com",
            "jobtitle": "VP of Operations",
            "lifecyclestage": "268636563",  # Closed Lost
        }
    }

    scored = scorer.score_contact(contact)

    assert isinstance(scored, ScoredContact)
    assert scored.contact_id == "123"
    assert 0 <= scored.total_score <= 100
    assert scored.firstname == "John"


def test_closed_lost_gets_higher_score():
    """Closed Lost contacts score higher than new leads."""
    scorer = ContactScorer()

    closed_lost = {
        "id": "1",
        "properties": {
            "firstname": "Jane",
            "lifecyclestage": "268636563",  # Closed Lost
        }
    }
    new_lead = {
        "id": "2",
        "properties": {
            "firstname": "Bob",
            "lifecyclestage": "subscriber",  # New
        }
    }

    scored_cl = scorer.score_contact(closed_lost)
    scored_new = scorer.score_contact(new_lead)

    # Closed Lost should score higher (they were further in pipeline)
    assert scored_cl.deal_context_score > scored_new.deal_context_score


def test_recent_engagement_boosts_score():
    """Recent email engagement increases score."""
    scorer = ContactScorer()

    recent_open = datetime.now() - timedelta(days=7)
    old_open = datetime.now() - timedelta(days=180)

    engaged = {
        "id": "1",
        "properties": {
            "firstname": "Jane",
            "hs_email_last_open_date": recent_open.isoformat(),
        }
    }
    stale = {
        "id": "2",
        "properties": {
            "firstname": "Bob",
            "hs_email_last_open_date": old_open.isoformat(),
        }
    }

    scored_engaged = scorer.score_contact(engaged)
    scored_stale = scorer.score_contact(stale)

    assert scored_engaged.engagement_score > scored_stale.engagement_score
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_scorer.py -v
```

Expected: FAIL with "ModuleNotFoundError"

**Step 3: Write minimal implementation**

Create `outreach_intel/scorer.py`:
```python
"""Contact scoring engine for Outreach Intelligence."""
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional


@dataclass
class ScoredContact:
    """A contact with calculated scores."""

    contact_id: str
    firstname: str
    lastname: str
    email: str
    jobtitle: str
    company: str
    lifecyclestage: str

    # Individual scores (0-100)
    engagement_score: float
    timing_score: float
    deal_context_score: float
    external_trigger_score: float

    # Combined score
    total_score: float

    # Raw contact data
    raw_properties: dict[str, Any]

    @property
    def name(self) -> str:
        """Full name."""
        return f"{self.firstname} {self.lastname}".strip()


class ContactScorer:
    """Scores contacts for likelihood to respond."""

    # Default weights from signals.md
    DEFAULT_WEIGHTS = {
        "engagement": 0.25,      # 25%
        "timing": 0.25,          # 25%
        "deal_context": 0.30,    # 30%
        "external_trigger": 0.20,  # 20%
    }

    # Lifecycle stage scores (deal context)
    LIFECYCLE_SCORES = {
        "268636563": 80,     # Closed Lost - high value
        "268798100": 75,     # Churned Customer - win-back
        "salesqualifiedlead": 60,  # SAL
        "marketingqualifiedlead": 50,  # MQL
        "lead": 40,          # Lead
        "subscriber": 30,    # New
    }

    def __init__(
        self,
        weights: Optional[dict[str, float]] = None,
    ):
        """Initialize scorer with weights.

        Args:
            weights: Custom weights for scoring dimensions
        """
        self.weights = weights or self.DEFAULT_WEIGHTS.copy()

    def score_contact(self, contact: dict[str, Any]) -> ScoredContact:
        """Score a contact for response likelihood.

        Args:
            contact: HubSpot contact record with id and properties

        Returns:
            ScoredContact with calculated scores
        """
        props = contact.get("properties", {})

        # Calculate individual scores
        engagement = self._score_engagement(props)
        timing = self._score_timing(props)
        deal_context = self._score_deal_context(props)
        external = self._score_external_triggers(props)

        # Calculate weighted total
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
            total_score=total,
            raw_properties=props,
        )

    def _score_engagement(self, props: dict[str, Any]) -> float:
        """Score based on engagement history."""
        score = 0.0

        # Email opens
        last_open = props.get("hs_email_last_open_date")
        if last_open:
            days_since = self._days_since(last_open)
            if days_since < 30:
                score += 40  # Very recent
            elif days_since < 90:
                score += 25  # Recent
            elif days_since < 180:
                score += 10  # Somewhat recent

        # Email clicks (higher intent)
        last_click = props.get("hs_email_last_click_date")
        if last_click:
            days_since = self._days_since(last_click)
            if days_since < 30:
                score += 50
            elif days_since < 90:
                score += 30
            elif days_since < 180:
                score += 15

        return min(score, 100)

    def _score_timing(self, props: dict[str, Any]) -> float:
        """Score based on timing signals."""
        score = 50  # Base score

        # Notes/activity recency
        notes_updated = props.get("notes_last_updated")
        if notes_updated:
            days_since = self._days_since(notes_updated)
            if days_since < 90:
                score += 20
            elif days_since > 365:
                score -= 20  # Very stale

        return max(0, min(score, 100))

    def _score_deal_context(self, props: dict[str, Any]) -> float:
        """Score based on deal context and lifecycle stage."""
        lifecycle = props.get("lifecyclestage", "")
        return self.LIFECYCLE_SCORES.get(lifecycle, 30)

    def _score_external_triggers(self, props: dict[str, Any]) -> float:
        """Score based on external triggers (job changes, etc.)."""
        # Placeholder - would integrate with enrichment data
        return 40  # Default score

    def _days_since(self, date_str: str) -> int:
        """Calculate days since a date string."""
        try:
            # Handle various date formats
            if "T" in date_str:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            else:
                dt = datetime.strptime(date_str, "%Y-%m-%d")

            delta = datetime.now(dt.tzinfo) - dt
            return delta.days
        except (ValueError, TypeError):
            return 365  # Default to old if parsing fails

    def score_contacts(
        self,
        contacts: list[dict[str, Any]],
    ) -> list[ScoredContact]:
        """Score multiple contacts and sort by score.

        Args:
            contacts: List of HubSpot contact records

        Returns:
            List of ScoredContacts, sorted by total_score descending
        """
        scored = [self.score_contact(c) for c in contacts]
        return sorted(scored, key=lambda x: x.total_score, reverse=True)
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/test_scorer.py -v
```

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add outreach_intel/scorer.py tests/test_scorer.py
git commit -m "feat: add contact scoring engine"
```

---

## Task 7: Outreach Service - Query Interface

**Files:**
- Create: `outreach_intel/service.py`
- Create: `tests/test_service.py`

**Step 1: Write the failing test**

Create `tests/test_service.py`:
```python
"""Tests for outreach service."""
import os
import pytest
from outreach_intel.service import OutreachService


def test_service_initialization():
    """Service initializes with HubSpot client and scorer."""
    if not os.getenv("HUBSPOT_API_TOKEN"):
        pytest.skip("No API token available")

    service = OutreachService()
    assert service.client is not None
    assert service.scorer is not None


def test_get_dormant_contacts():
    """get_dormant_contacts returns scored contacts."""
    if not os.getenv("HUBSPOT_API_TOKEN"):
        pytest.skip("No API token available")

    service = OutreachService()
    contacts = service.get_dormant_contacts(limit=10)

    assert isinstance(contacts, list)
    if contacts:
        # Should be ScoredContact objects
        assert hasattr(contacts[0], "total_score")
        assert hasattr(contacts[0], "contact_id")


def test_get_dormant_contacts_respects_limit():
    """get_dormant_contacts respects the limit parameter."""
    if not os.getenv("HUBSPOT_API_TOKEN"):
        pytest.skip("No API token available")

    service = OutreachService()
    contacts = service.get_dormant_contacts(limit=5)

    assert len(contacts) <= 5
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_service.py -v
```

Expected: FAIL with "ModuleNotFoundError"

**Step 3: Write minimal implementation**

Create `outreach_intel/service.py`:
```python
"""Outreach Intelligence service - main query interface."""
from typing import Optional

from outreach_intel.hubspot_client import HubSpotClient
from outreach_intel.scorer import ContactScorer, ScoredContact
from outreach_intel.config import (
    get_exclusion_filters,
    get_inclusion_filters,
    DEFAULT_CONTACT_PROPERTIES,
)


class OutreachService:
    """Main service for outreach intelligence queries."""

    def __init__(
        self,
        api_token: Optional[str] = None,
        scorer: Optional[ContactScorer] = None,
    ):
        """Initialize service.

        Args:
            api_token: HubSpot API token (or uses env var)
            scorer: Custom scorer (or uses default)
        """
        self.client = HubSpotClient(api_token=api_token)
        self.scorer = scorer or ContactScorer()

    def get_dormant_contacts(
        self,
        limit: int = 50,
        industry: Optional[str] = None,
        lifecycle_stage: Optional[str] = None,
    ) -> list[ScoredContact]:
        """Get dormant contacts scored for response likelihood.

        Excludes active customers and open deals.

        Args:
            limit: Maximum contacts to return
            industry: Filter by industry/sales_vertical
            lifecycle_stage: Filter by specific lifecycle stage

        Returns:
            List of ScoredContacts sorted by score
        """
        # Build filters
        filters = get_exclusion_filters()

        if industry:
            filters.append({
                "propertyName": "sales_vertical",
                "operator": "EQ",
                "value": industry,
            })

        if lifecycle_stage:
            filters.append({
                "propertyName": "lifecyclestage",
                "operator": "EQ",
                "value": lifecycle_stage,
            })

        # Query HubSpot
        contacts = self.client.search_contacts(
            filters=filters,
            properties=DEFAULT_CONTACT_PROPERTIES,
            limit=limit,
        )

        # Score and sort
        return self.scorer.score_contacts(contacts)

    def get_closed_lost(
        self,
        limit: int = 50,
        industry: Optional[str] = None,
    ) -> list[ScoredContact]:
        """Get closed-lost contacts for re-engagement.

        Args:
            limit: Maximum contacts to return
            industry: Filter by industry/sales_vertical

        Returns:
            List of ScoredContacts sorted by score
        """
        filters = [
            {
                "propertyName": "lifecyclestage",
                "operator": "EQ",
                "value": "268636563",  # Closed Lost
            }
        ]

        if industry:
            filters.append({
                "propertyName": "sales_vertical",
                "operator": "EQ",
                "value": industry,
            })

        contacts = self.client.search_contacts(
            filters=filters,
            properties=DEFAULT_CONTACT_PROPERTIES,
            limit=limit,
        )

        return self.scorer.score_contacts(contacts)

    def get_churned_customers(
        self,
        limit: int = 50,
    ) -> list[ScoredContact]:
        """Get churned customers for win-back campaigns.

        Args:
            limit: Maximum contacts to return

        Returns:
            List of ScoredContacts sorted by score
        """
        filters = [
            {
                "propertyName": "lifecyclestage",
                "operator": "EQ",
                "value": "268798100",  # Churned Customer
            }
        ]

        contacts = self.client.search_contacts(
            filters=filters,
            properties=DEFAULT_CONTACT_PROPERTIES,
            limit=limit,
        )

        return self.scorer.score_contacts(contacts)

    def create_campaign_list(
        self,
        contacts: list[ScoredContact],
        name: str,
    ) -> dict:
        """Create a HubSpot list from scored contacts.

        Args:
            contacts: List of ScoredContacts to add
            name: Name for the new list

        Returns:
            Created list record
        """
        # Create the list
        new_list = self.client.create_list(name=name)
        list_id = new_list.get("listId") or new_list.get("id")

        # Add contacts to list
        contact_ids = [c.contact_id for c in contacts]
        if contact_ids:
            self.client.add_contacts_to_list(list_id, contact_ids)

        return new_list
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/test_service.py -v
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add outreach_intel/service.py tests/test_service.py
git commit -m "feat: add outreach service query interface"
```

---

## Task 8: CLI Interface

**Files:**
- Create: `outreach_intel/cli.py`
- Modify: `outreach_intel/__init__.py`

**Step 1: Create CLI**

Create `outreach_intel/cli.py`:
```python
"""Command-line interface for Outreach Intelligence."""
import argparse
import json
import sys
from typing import Optional

from outreach_intel.service import OutreachService
from outreach_intel.scorer import ScoredContact


def format_contact(contact: ScoredContact, rank: int) -> str:
    """Format a scored contact for display."""
    return (
        f"{rank}. {contact.name} ({contact.jobtitle or 'Unknown Title'})\n"
        f"   Company: {contact.company or 'Unknown'}\n"
        f"   Email: {contact.email}\n"
        f"   Score: {contact.total_score:.1f} | "
        f"Stage: {contact.lifecyclestage}\n"
        f"   Breakdown: Engagement={contact.engagement_score:.0f} "
        f"Timing={contact.timing_score:.0f} "
        f"Context={contact.deal_context_score:.0f}"
    )


def cmd_dormant(args: argparse.Namespace) -> None:
    """Get dormant contacts."""
    service = OutreachService()
    contacts = service.get_dormant_contacts(
        limit=args.limit,
        industry=args.industry,
    )

    if args.json:
        output = [
            {
                "id": c.contact_id,
                "name": c.name,
                "email": c.email,
                "company": c.company,
                "score": c.total_score,
            }
            for c in contacts
        ]
        print(json.dumps(output, indent=2))
    else:
        print(f"\nTop {len(contacts)} Dormant Contacts:\n")
        print("-" * 60)
        for i, contact in enumerate(contacts, 1):
            print(format_contact(contact, i))
            print()


def cmd_closed_lost(args: argparse.Namespace) -> None:
    """Get closed-lost contacts."""
    service = OutreachService()
    contacts = service.get_closed_lost(
        limit=args.limit,
        industry=args.industry,
    )

    if args.json:
        output = [
            {
                "id": c.contact_id,
                "name": c.name,
                "email": c.email,
                "company": c.company,
                "score": c.total_score,
            }
            for c in contacts
        ]
        print(json.dumps(output, indent=2))
    else:
        print(f"\nTop {len(contacts)} Closed-Lost Contacts:\n")
        print("-" * 60)
        for i, contact in enumerate(contacts, 1):
            print(format_contact(contact, i))
            print()


def cmd_churned(args: argparse.Namespace) -> None:
    """Get churned customers."""
    service = OutreachService()
    contacts = service.get_churned_customers(limit=args.limit)

    if args.json:
        output = [
            {
                "id": c.contact_id,
                "name": c.name,
                "email": c.email,
                "company": c.company,
                "score": c.total_score,
            }
            for c in contacts
        ]
        print(json.dumps(output, indent=2))
    else:
        print(f"\nTop {len(contacts)} Churned Customers:\n")
        print("-" * 60)
        for i, contact in enumerate(contacts, 1):
            print(format_contact(contact, i))
            print()


def cmd_create_list(args: argparse.Namespace) -> None:
    """Create a HubSpot list from query results."""
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
        print("No contacts found matching criteria.")
        sys.exit(1)

    # Create the list
    result = service.create_campaign_list(contacts, args.name)
    list_id = result.get("listId") or result.get("id")

    print(f"\nCreated list '{args.name}' with {len(contacts)} contacts")
    print(f"List ID: {list_id}")


def main(argv: Optional[list[str]] = None) -> None:
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Truv Outreach Intelligence - HubSpot campaign tool"
    )
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Dormant contacts command
    dormant_parser = subparsers.add_parser(
        "dormant", help="Get dormant contacts for outreach"
    )
    dormant_parser.add_argument(
        "-l", "--limit", type=int, default=25, help="Number of contacts"
    )
    dormant_parser.add_argument(
        "-i", "--industry", help="Filter by industry/vertical"
    )
    dormant_parser.add_argument(
        "--json", action="store_true", help="Output as JSON"
    )
    dormant_parser.set_defaults(func=cmd_dormant)

    # Closed-lost command
    cl_parser = subparsers.add_parser(
        "closed-lost", help="Get closed-lost contacts for re-engagement"
    )
    cl_parser.add_argument(
        "-l", "--limit", type=int, default=25, help="Number of contacts"
    )
    cl_parser.add_argument(
        "-i", "--industry", help="Filter by industry/vertical"
    )
    cl_parser.add_argument(
        "--json", action="store_true", help="Output as JSON"
    )
    cl_parser.set_defaults(func=cmd_closed_lost)

    # Churned command
    churned_parser = subparsers.add_parser(
        "churned", help="Get churned customers for win-back"
    )
    churned_parser.add_argument(
        "-l", "--limit", type=int, default=25, help="Number of contacts"
    )
    churned_parser.add_argument(
        "--json", action="store_true", help="Output as JSON"
    )
    churned_parser.set_defaults(func=cmd_churned)

    # Create list command
    list_parser = subparsers.add_parser(
        "create-list", help="Create HubSpot list from query"
    )
    list_parser.add_argument(
        "query", choices=["dormant", "closed-lost", "churned"],
        help="Query type to use"
    )
    list_parser.add_argument(
        "name", help="Name for the new list"
    )
    list_parser.add_argument(
        "-l", "--limit", type=int, default=50, help="Number of contacts"
    )
    list_parser.set_defaults(func=cmd_create_list)

    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
```

**Step 2: Update package init**

Modify `outreach_intel/__init__.py`:
```python
"""Truv Outreach Intelligence - HubSpot integration for sales campaigns."""

from outreach_intel.service import OutreachService
from outreach_intel.scorer import ContactScorer, ScoredContact
from outreach_intel.hubspot_client import HubSpotClient

__version__ = "0.1.0"

__all__ = [
    "OutreachService",
    "ContactScorer",
    "ScoredContact",
    "HubSpotClient",
]
```

**Step 3: Test CLI manually**

```bash
cd /Users/cameronwolf/Downloads/Projects/truv-brain
source venv/bin/activate
python -m outreach_intel.cli --help
python -m outreach_intel.cli dormant --limit 5
```

**Step 4: Commit**

```bash
git add outreach_intel/cli.py outreach_intel/__init__.py
git commit -m "feat: add CLI interface for outreach intelligence"
```

---

## Task 9: Integration Test - End to End

**Files:**
- Create: `tests/test_integration.py`

**Step 1: Write integration test**

Create `tests/test_integration.py`:
```python
"""Integration tests for full workflow."""
import os
import pytest
from outreach_intel import OutreachService


@pytest.mark.integration
def test_full_workflow_dormant_to_list():
    """Test: query dormant contacts -> score -> create list."""
    if not os.getenv("HUBSPOT_API_TOKEN"):
        pytest.skip("No API token available")

    service = OutreachService()

    # 1. Get dormant contacts
    contacts = service.get_dormant_contacts(limit=5)
    assert len(contacts) > 0, "Should find at least some dormant contacts"

    # 2. Verify scoring worked
    assert all(c.total_score > 0 for c in contacts)

    # 3. Verify sorted by score
    scores = [c.total_score for c in contacts]
    assert scores == sorted(scores, reverse=True)

    # 4. Create a test list (and clean up)
    list_name = "TEST_DELETE_ME_integration"
    result = service.create_campaign_list(contacts, list_name)

    list_id = result.get("listId") or result.get("id")
    assert list_id is not None

    # Clean up
    service.client.delete_list(list_id)


@pytest.mark.integration
def test_closed_lost_query():
    """Test closed-lost specific query."""
    if not os.getenv("HUBSPOT_API_TOKEN"):
        pytest.skip("No API token available")

    service = OutreachService()
    contacts = service.get_closed_lost(limit=10)

    # All should have closed-lost lifecycle stage
    for contact in contacts:
        assert contact.lifecyclestage == "268636563", (
            f"Expected closed-lost stage, got {contact.lifecyclestage}"
        )
```

**Step 2: Run integration tests**

```bash
pytest tests/test_integration.py -v -m integration
```

Expected: PASS

**Step 3: Run all tests**

```bash
pytest tests/ -v
```

Expected: All tests PASS

**Step 4: Commit**

```bash
git add tests/test_integration.py
git commit -m "test: add end-to-end integration tests"
```

---

## Task 10: Final Polish and Documentation

**Files:**
- Create: `outreach_intel/README.md`

**Step 1: Create README**

Create `outreach_intel/README.md`:
```markdown
# Outreach Intelligence

HubSpot-based sales intelligence tool for identifying and scoring dormant contacts.

## Setup

1. Create virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r outreach_intel/requirements.txt
   ```

3. Configure HubSpot token:
   ```bash
   cp .env.example .env
   # Edit .env and add your HubSpot private app token
   ```

## Usage

### CLI Commands

**Get dormant contacts:**
```bash
python -m outreach_intel.cli dormant --limit 25
python -m outreach_intel.cli dormant --limit 50 --industry "Mortgage"
python -m outreach_intel.cli dormant --json  # JSON output
```

**Get closed-lost contacts:**
```bash
python -m outreach_intel.cli closed-lost --limit 25
```

**Get churned customers:**
```bash
python -m outreach_intel.cli churned --limit 25
```

**Create HubSpot list:**
```bash
python -m outreach_intel.cli create-list dormant "Q1 Re-engagement Campaign" --limit 50
```

### Python API

```python
from outreach_intel import OutreachService

service = OutreachService()

# Get scored dormant contacts
contacts = service.get_dormant_contacts(limit=50)
for contact in contacts[:10]:
    print(f"{contact.name}: {contact.total_score}")

# Get closed-lost for re-engagement
closed_lost = service.get_closed_lost(limit=25)

# Create a HubSpot list
service.create_campaign_list(contacts[:25], "My Campaign List")
```

## Scoring

Contacts are scored on four dimensions:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Engagement | 25% | Email opens, clicks, recent activity |
| Timing | 25% | Days since last contact, seasonality |
| Deal Context | 30% | Lifecycle stage, how far they got |
| External Triggers | 20% | Job changes, company news |

## Exclusions

These lifecycle stages are excluded (active customers):
- Implementing Customer
- Live Customer
- Indirect Customer
- Customer
- Advocate
- Disqualified / Opt-Out
- Open Deal / Opportunity

## Running Tests

```bash
pytest tests/ -v
pytest tests/ -v -m integration  # Integration tests only
```
```

**Step 2: Final commit**

```bash
git add outreach_intel/README.md
git commit -m "docs: add README for outreach intelligence tool"
```

---

## Summary

**Phase 1 Complete.** You now have:

1. **HubSpot Client** - Read/write access to contacts, lists, properties
2. **Scoring Engine** - Weighted scoring based on engagement, timing, deal context
3. **Exclusion Filters** - Configured for your specific lifecycle stages
4. **Service Layer** - Query interface for dormant, closed-lost, churned contacts
5. **CLI** - Command-line tool for quick queries and list creation
6. **Tests** - Unit and integration tests

**Next Phases:**
- Phase 2: Weekly report generation
- Phase 3: Campaign messaging suggestions (integrate copywriting.md rules)
- Phase 4: Export to Knock/SmartLead
