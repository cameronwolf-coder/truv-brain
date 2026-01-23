"""Query HubSpot for segment statistics."""
from typing import Optional
from outreach_intel.hubspot_client import HubSpotClient
from outreach_intel.config import get_exclusion_filters, DEFAULT_CONTACT_PROPERTIES


def get_segment_count(
    client: HubSpotClient,
    filters: list[dict],
) -> int:
    """Get count of contacts matching filters.

    HubSpot search API returns total count in response.
    """
    body = {
        "limit": 1,  # We only need the count, not results
        "properties": ["email"],
        "filterGroups": [{"filters": filters}],
    }
    response = client.post("/crm/v3/objects/contacts/search", json_data=body)
    return response.get("total", 0)


def get_vertical_counts(client: HubSpotClient) -> dict[str, int]:
    """Get contact counts by sales_vertical."""
    verticals = ["mortgage", "consumer", "auto", "background", "tenant"]
    base_filters = get_exclusion_filters()

    counts = {}
    for vertical in verticals:
        filters = base_filters + [{
            "propertyName": "sales_vertical",
            "operator": "EQ",
            "value": vertical,
        }]
        counts[vertical] = get_segment_count(client, filters)

    # Also get total for contacts without vertical set
    counts["_total_filtered"] = get_segment_count(client, base_filters)

    return counts


def get_lifecycle_counts(client: HubSpotClient) -> dict[str, int]:
    """Get contact counts by lifecycle stage (for objection mapping)."""
    # These map roughly to objection types
    stages = {
        "subscriber": "subscriber",
        "lead": "lead",
        "marketingqualifiedlead": "marketingqualifiedlead",
        "salesqualifiedlead": "salesqualifiedlead",
        "closed_lost": "268636563",
        "churned": "268798100",
    }

    counts = {}
    for name, stage_id in stages.items():
        filters = [{
            "propertyName": "lifecyclestage",
            "operator": "EQ",
            "value": stage_id,
        }]
        counts[name] = get_segment_count(client, filters)

    return counts


def get_persona_counts(client: HubSpotClient) -> dict[str, int]:
    """Get contact counts by job title patterns (for persona mapping)."""
    base_filters = get_exclusion_filters()

    # Job title patterns for each persona
    persona_patterns = {
        "vp_ops": ["VP", "Director", "Operations", "Head of"],
        "cto": ["CTO", "VP Engineering", "Technical", "Technology", "IT Director"],
        "cfo": ["CFO", "Finance", "Controller", "Accounting"],
        "ceo": ["CEO", "Founder", "President", "Owner", "Principal"],
    }

    counts = {}
    for persona, patterns in persona_patterns.items():
        # Use CONTAINS_TOKEN for pattern matching
        total = 0
        for pattern in patterns:
            filters = base_filters + [{
                "propertyName": "jobtitle",
                "operator": "CONTAINS_TOKEN",
                "value": pattern,
            }]
            total += get_segment_count(client, filters)
        counts[persona] = total

    return counts


def print_all_stats():
    """Print all segment statistics."""
    client = HubSpotClient()

    print("=" * 50)
    print("HUBSPOT SEGMENT STATISTICS")
    print("=" * 50)

    print("\n📊 VERTICAL COUNTS (excluding customers/opportunities):")
    print("-" * 40)
    vertical_counts = get_vertical_counts(client)
    total = vertical_counts.pop("_total_filtered", 0)
    for vertical, count in sorted(vertical_counts.items(), key=lambda x: -x[1]):
        pct = (count / total * 100) if total > 0 else 0
        print(f"  {vertical:20} {count:>6,} contacts ({pct:.1f}%)")
    print(f"  {'TOTAL':20} {total:>6,} contacts")

    print("\n📈 LIFECYCLE STAGE COUNTS:")
    print("-" * 40)
    lifecycle_counts = get_lifecycle_counts(client)
    for stage, count in sorted(lifecycle_counts.items(), key=lambda x: -x[1]):
        print(f"  {stage:25} {count:>6,} contacts")

    print("\n👤 PERSONA COUNTS (by job title patterns):")
    print("-" * 40)
    persona_counts = get_persona_counts(client)
    persona_total = sum(persona_counts.values())
    for persona, count in sorted(persona_counts.items(), key=lambda x: -x[1]):
        pct = (count / persona_total * 100) if persona_total > 0 else 0
        print(f"  {persona:20} {count:>6,} contacts ({pct:.1f}%)")

    print("\n" + "=" * 50)

    # Return data for programmatic use
    return {
        "verticals": vertical_counts,
        "total_targetable": total,
        "lifecycle": lifecycle_counts,
        "personas": persona_counts,
    }


if __name__ == "__main__":
    print_all_stats()
