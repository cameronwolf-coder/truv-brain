"""Unit tests for truv_scout.scorer routing and tier logic."""

import pytest

from outreach_intel.scorer import ScoredContact
from truv_scout.models import ScoutEnrichment
from truv_scout.scorer import classify_route, classify_tier, score_and_route, _parse_revenue


def _make_scored(raw_properties=None, **kwargs) -> ScoredContact:
    defaults = dict(
        contact_id="test-123",
        firstname="Test",
        lastname="User",
        email="test@example.com",
        jobtitle="Manager",
        company="Acme Inc",
        lifecyclestage="lead",
        engagement_score=50,
        timing_score=50,
        deal_context_score=50,
        external_trigger_score=40,
        form_fit_score=50,
        total_score=50,
        raw_properties=raw_properties or {},
    )
    defaults.update(kwargs)
    return ScoredContact(**defaults)


# ── classify_route: not-a-lead ───────────────────────────────────────


class TestNotALead:
    def test_not_a_lead_login(self):
        sc = _make_scored(raw_properties={"how_can_we_help": "Log in to Truv"})
        assert classify_route(sc) == "not-a-lead"

    def test_not_a_lead_verification_help(self):
        sc = _make_scored(raw_properties={"how_can_we_help___forms_": "Verification Help"})
        assert classify_route(sc) == "not-a-lead"


# ── classify_route: government ───────────────────────────────────────


class TestGovernment:
    def test_government_public_services(self):
        sc = _make_scored(raw_properties={"use_case": "Public Services"})
        assert classify_route(sc) == "government"

    def test_government_use_case_forms(self):
        sc = _make_scored(
            raw_properties={"what_s_your_use_case___forms_": "public services / government"}
        )
        assert classify_route(sc) == "government"


# ── classify_route: enterprise ───────────────────────────────────────


class TestEnterprise:
    def test_enterprise_executive_role(self):
        sc = _make_scored(
            raw_properties={"which_of_these_best_describes_your_job_title_": "Executive"}
        )
        assert classify_route(sc) == "enterprise"

    def test_enterprise_vp_role(self):
        sc = _make_scored(
            raw_properties={"which_of_these_best_describes_your_job_title_": "VP"}
        )
        assert classify_route(sc) == "enterprise"

    def test_enterprise_director_role(self):
        sc = _make_scored(
            raw_properties={"which_of_these_best_describes_your_job_title_": "Director"}
        )
        assert classify_route(sc) == "enterprise"

    def test_enterprise_high_apps(self):
        sc = _make_scored(
            raw_properties={"how_many_applications_do_you_see_per_year_": "30,000-100,000"}
        )
        assert classify_route(sc) == "enterprise"

    def test_enterprise_high_loans(self):
        sc = _make_scored(
            raw_properties={"how_many_loans_do_you_close_per_year": "5,000+"}
        )
        assert classify_route(sc) == "enterprise"


# ── classify_route: self-service ─────────────────────────────────────


class TestSelfService:
    def test_self_service_manager(self):
        sc = _make_scored(
            raw_properties={
                "which_of_these_best_describes_your_job_title_": "Manager",
                "how_many_applications_do_you_see_per_year_": "1,000-5,000",
                "how_many_loans_do_you_close_per_year": "500",
            }
        )
        assert classify_route(sc) == "self-service"

    def test_self_service_no_form(self):
        sc = _make_scored(raw_properties={})
        assert classify_route(sc) == "self-service"


# ── classify_route: Apollo overrides ─────────────────────────────────


class TestApolloOverride:
    def test_apollo_override_employees(self):
        sc = _make_scored(
            raw_properties={"which_of_these_best_describes_your_job_title_": "Manager"}
        )
        enrichment = ScoutEnrichment(employee_count=200)
        assert classify_route(sc, enrichment) == "enterprise"

    def test_apollo_override_revenue(self):
        sc = _make_scored(
            raw_properties={"which_of_these_best_describes_your_job_title_": "Manager"}
        )
        enrichment = ScoutEnrichment(revenue="$100M")
        assert classify_route(sc, enrichment) == "enterprise"

    def test_no_apollo_override_small(self):
        sc = _make_scored(
            raw_properties={"which_of_these_best_describes_your_job_title_": "Manager"}
        )
        enrichment = ScoutEnrichment(employee_count=50)
        assert classify_route(sc, enrichment) == "self-service"


# ── classify_tier ────────────────────────────────────────────────────


class TestClassifyTier:
    def test_classify_tier_hot(self):
        assert classify_tier(85) == "hot"

    def test_classify_tier_warm(self):
        assert classify_tier(55) == "warm"

    def test_classify_tier_cold(self):
        assert classify_tier(25) == "cold"

    def test_classify_tier_boundary_70(self):
        assert classify_tier(70) == "hot"

    def test_classify_tier_boundary_40(self):
        assert classify_tier(40) == "warm"


# ── _parse_revenue ───────────────────────────────────────────────────


class TestParseRevenue:
    def test_parse_revenue_50m(self):
        assert _parse_revenue("$50M") == 50_000_000

    def test_parse_revenue_range(self):
        assert _parse_revenue("$50M-$100M") == 50_000_000

    def test_parse_revenue_billion(self):
        assert _parse_revenue("$1B+") == 1_000_000_000

    def test_parse_revenue_none(self):
        assert _parse_revenue(None) == 0.0

    def test_parse_revenue_unknown(self):
        assert _parse_revenue("Unknown") == 0.0
