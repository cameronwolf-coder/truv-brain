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
