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
