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
