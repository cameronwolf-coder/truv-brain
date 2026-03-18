"""Evaluation runner for Truv Scout scoring and routing.

Runs all test leads through the deterministic scorer and checks
routing and tier against expected values.
"""

from truv_scout.evals.test_cases import TEST_LEADS
from truv_scout.scorer import score_and_route

# Tier ordering for "at least" comparisons
TIER_RANK = {"cold": 0, "warm": 1, "hot": 2}


def tier_meets_minimum(actual: str, expected_min: str) -> bool:
    """Return True if actual tier is >= expected minimum."""
    return TIER_RANK.get(actual, -1) >= TIER_RANK.get(expected_min, 0)


def run_evaluation() -> dict:
    """Run all test cases through the scorer and grade results.

    Returns a summary dict with pass/fail counts and details.
    """
    results = []
    passed = 0
    failed = 0

    for lead in TEST_LEADS:
        name = lead["name"]
        contact = lead["contact"]
        expected_routing = lead["expected_routing"]
        expected_tier_min = lead["expected_tier_min"]

        try:
            scored, routing, tier = score_and_route(contact)
        except Exception as e:
            print(f"  FAIL  {name} -- scorer raised: {e}")
            results.append({"name": name, "passed": False, "error": str(e)})
            failed += 1
            continue

        routing_ok = routing == expected_routing
        tier_ok = tier_meets_minimum(tier, expected_tier_min)
        all_ok = routing_ok and tier_ok

        status = "PASS" if all_ok else "FAIL"
        if all_ok:
            passed += 1
        else:
            failed += 1

        detail_parts = []
        if not routing_ok:
            detail_parts.append(f"routing: got '{routing}', expected '{expected_routing}'")
        if not tier_ok:
            detail_parts.append(f"tier: got '{tier}', expected >= '{expected_tier_min}'")
        detail = " | ".join(detail_parts) if detail_parts else ""

        print(f"  {status}  {name} (score={scored.total_score:.1f}, tier={tier}, routing={routing})"
              + (f"  -- {detail}" if detail else ""))

        results.append({
            "name": name,
            "passed": all_ok,
            "score": scored.total_score,
            "tier": tier,
            "routing": routing,
            "expected_routing": expected_routing,
            "expected_tier_min": expected_tier_min,
            "detail": detail,
        })

    total = passed + failed
    rate = (passed / total * 100) if total > 0 else 0.0

    print()
    print(f"Results: {passed}/{total} passed ({rate:.0f}%)")

    return {"passed": passed, "failed": failed, "total": total, "rate": rate, "results": results}


if __name__ == "__main__":
    run_evaluation()
