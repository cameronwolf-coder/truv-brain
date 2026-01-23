"""Get all sales_vertical values from HubSpot."""
from outreach_intel.hubspot_client import HubSpotClient
from outreach_intel.config import get_exclusion_filters
from collections import Counter


def get_all_vertical_values(client: HubSpotClient):
    """Page through contacts and count all sales_vertical values."""
    base_filters = get_exclusion_filters()

    all_values = []
    after = None
    page = 0

    print("Fetching contacts to count verticals...")

    while True:
        body = {
            "limit": 100,
            "properties": ["sales_vertical"],
            "filterGroups": [{"filters": base_filters}],
        }
        if after:
            body["after"] = after

        response = client.post("/crm/v3/objects/contacts/search", json_data=body)
        contacts = response.get("results", [])

        for c in contacts:
            val = c.get("properties", {}).get("sales_vertical")
            if val:
                all_values.append(val)

        page += 1
        if page % 10 == 0:
            print(f"  Processed {page * 100} contacts...")

        # Check for next page
        paging = response.get("paging", {})
        next_page = paging.get("next", {})
        after = next_page.get("after")

        if not after or page >= 50:  # Cap at 5000 contacts for speed
            break

    total = response.get("total", 0)
    print(f"\nTotal targetable contacts: {total:,}")
    print(f"Sampled: {len(all_values):,}")
    print()

    # Count values
    counter = Counter(all_values)
    print("SALES_VERTICAL VALUES (from sample):")
    print("-" * 50)
    for value, count in counter.most_common():
        pct = count / len(all_values) * 100
        estimated_total = int(total * (count / len(all_values)))
        print(f"  {value:30} {count:>5} ({pct:5.1f}%) ~{estimated_total:,} total")


if __name__ == "__main__":
    client = HubSpotClient()
    get_all_vertical_values(client)
