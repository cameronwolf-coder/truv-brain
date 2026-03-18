"""Unit tests for truv_scout.tools.apollo tech stack filtering and classification."""

import pytest
from unittest.mock import patch, MagicMock

from outreach_intel.enrichment.base import HiringSignal
from truv_scout.tools.apollo import FilteredApolloEnrichment


@pytest.fixture
def apollo():
    with patch("truv_scout.tools.apollo.ApolloClient"):
        return FilteredApolloEnrichment(api_key="test-key")


# ── _filter_tech_stack: LOS/POS matches ─────────────────────────────


class TestFilterLOS:
    def test_filter_los_encompass(self, apollo):
        result = apollo._filter_tech_stack(
            ["ICE Mortgage Technology / Encompass"], apollo._los_pos_providers
        )
        assert result == ["ICE Mortgage Technology / Encompass"]

    def test_filter_los_blend(self, apollo):
        result = apollo._filter_tech_stack(["Blend"], apollo._los_pos_providers)
        assert result == ["Blend"]

    def test_filter_los_no_match(self, apollo):
        result = apollo._filter_tech_stack(
            ["Salesforce", "Slack"], apollo._los_pos_providers
        )
        assert result == []


# ── _filter_tech_stack: VOI/VOE matches ─────────────────────────────


class TestFilterVOE:
    def test_filter_voe_work_number(self, apollo):
        result = apollo._filter_tech_stack(
            ["The Work Number"], apollo._voi_voe_providers
        )
        assert result == ["The Work Number"]

    def test_filter_voe_truework(self, apollo):
        result = apollo._filter_tech_stack(["Truework"], apollo._voi_voe_providers)
        assert result == ["Truework"]


# ── _filter_tech_stack: mixed ────────────────────────────────────────


class TestFilterMixed:
    def test_filter_mixed(self, apollo):
        tech_stack = ["Encompass", "Salesforce", "Truework"]
        los = apollo._filter_tech_stack(tech_stack, apollo._los_pos_providers)
        voe = apollo._filter_tech_stack(tech_stack, apollo._voi_voe_providers)
        assert "Encompass" in los
        assert "Salesforce" not in los
        assert "Truework" in voe
        assert "Salesforce" not in voe


# ── _filter_tech_stack: case insensitivity ───────────────────────────


class TestFilterCaseInsensitive:
    def test_filter_case_insensitive(self, apollo):
        result = apollo._filter_tech_stack(["encompass"], apollo._los_pos_providers)
        assert result == ["encompass"]


# ── classify_tech_intent ─────────────────────────────────────────────


class TestClassifyTechIntent:
    def test_intent_greenfield(self, apollo):
        assert apollo.classify_tech_intent(["Encompass"], []) == "greenfield"

    def test_intent_displacement(self, apollo):
        assert (
            apollo.classify_tech_intent(["Encompass"], ["The Work Number"])
            == "displacement"
        )

    def test_intent_competitive(self, apollo):
        assert apollo.classify_tech_intent(["Blend"], ["Argyle"]) == "competitive"

    def test_intent_no_match(self, apollo):
        assert apollo.classify_tech_intent([], []) == "no-match"

    def test_intent_displacement_priority(self, apollo):
        """Legacy provider takes priority over modern competitor."""
        assert (
            apollo.classify_tech_intent(
                ["Encompass"], ["The Work Number", "Argyle"]
            )
            == "displacement"
        )


# ── _filter_hiring ───────────────────────────────────────────────────


class TestFilterHiring:
    def test_filter_hiring_relevant(self, apollo):
        signal = HiringSignal(
            job_title="Mortgage Underwriter",
            department="Lending",
            company_name="Acme Lending",
            location="Remote",
            url="https://example.com/job/1",
        )
        result = apollo._filter_hiring([signal])
        assert len(result) == 1
        assert result[0]["job_title"] == "Mortgage Underwriter"

    def test_filter_hiring_irrelevant(self, apollo):
        signal = HiringSignal(
            job_title="Marketing Manager",
            department="Marketing",
            company_name="Acme Lending",
            location="Remote",
            url="https://example.com/job/2",
        )
        result = apollo._filter_hiring([signal])
        assert len(result) == 0
