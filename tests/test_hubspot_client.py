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
