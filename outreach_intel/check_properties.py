"""Check what properties are populated for contacts."""
from outreach_intel.hubspot_client import HubSpotClient
from collections import Counter


def check_property_values(client: HubSpotClient):
    """Sample contacts and see what vertical/industry values exist."""
    properties = [
        "industry",
        "sales_vertical",
        "hs_analytics_source",
        "company",
        "jobtitle",
    ]

    # Get a sample of contacts
    body = {
        "limit": 100,
        "properties": properties,
    }
    response = client.post("/crm/v3/objects/contacts/search", json_data=body)
    contacts = response.get("results", [])

    print(f"Sampled {len(contacts)} contacts")
    print(f"Total in HubSpot: {response.get('total', 'unknown')}")
    print()

    # Check each property
    for prop in properties:
        values = [c.get("properties", {}).get(prop) for c in contacts]
        non_empty = [v for v in values if v]
        print(f"Property: {prop}")
        print(f"  Populated: {len(non_empty)}/{len(contacts)}")
        if non_empty:
            counter = Counter(non_empty)
            print(f"  Top values: {counter.most_common(5)}")
        print()


if __name__ == "__main__":
    client = HubSpotClient()
    check_property_values(client)
