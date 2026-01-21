"""Integration tests for full workflow."""
import os
import time
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
    list_name = f"TEST_DELETE_ME_integration_{int(time.time())}"
    result = service.create_campaign_list(contacts, list_name)

    # HubSpot v3 API returns nested structure: {"list": {"listId": ...}}
    list_data = result.get("list", result)
    list_id = list_data.get("listId") or list_data.get("id")
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
