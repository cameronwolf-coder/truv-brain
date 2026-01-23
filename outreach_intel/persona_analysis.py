"""Analyze HubSpot data to score personas by engagement and deal progression."""
import os
import json
from collections import defaultdict
from typing import Any
from dotenv import load_dotenv

load_dotenv()

from outreach_intel.hubspot_client import HubSpotClient


# Persona classification rules
PERSONA_PATTERNS = {
    "ceo": ["ceo", "chief executive", "founder", "president", "owner"],
    "coo": ["coo", "chief operating", "vp operations", "vp of operations", "svp operations", "evp operations", "director of operations"],
    "cfo": ["cfo", "chief financial", "vp finance", "controller", "treasurer"],
    "cto": ["cto", "chief technology", "chief information", "vp engineering", "vp of engineering", "head of engineering"],
    "vp_lending": ["vp lending", "vp of lending", "svp lending", "evp lending", "director of lending", "head of lending", "lending manager"],
    "vp_underwriting": ["underwriting", "credit officer", "chief credit"],
    "vp_product": ["vp product", "cpo", "chief product", "head of product", "director of product"],
    "other_exec": ["vice president", "vp ", "svp", "evp", "director"],
    "manager": ["manager", "lead", "supervisor"],
}


def classify_persona(job_title: str) -> str:
    """Classify a job title into a persona category."""
    if not job_title:
        return "unknown"

    title_lower = job_title.lower()

    for persona, patterns in PERSONA_PATTERNS.items():
        for pattern in patterns:
            if pattern in title_lower:
                return persona

    return "other"


def fetch_all_contacts(client: HubSpotClient, filters: list, properties: list, max_results: int = 10000) -> list:
    """Fetch contacts matching filters using pagination (up to HubSpot's 10k limit)."""
    all_contacts = []
    after = None
    page = 0

    while len(all_contacts) < max_results:
        page += 1
        try:
            response = client.post(
                "/crm/v3/objects/contacts/search",
                json_data={
                    "filterGroups": [{"filters": filters}],
                    "properties": properties,
                    "limit": 100,
                    **({"after": after} if after else {})
                }
            )
        except Exception as e:
            # HubSpot returns 400 when exceeding 10k limit
            print(f"    Reached HubSpot limit at {len(all_contacts)} contacts")
            break

        contacts = response.get("results", [])
        all_contacts.extend(contacts)

        paging = response.get("paging", {})
        after = paging.get("next", {}).get("after")

        if page % 10 == 0:
            print(f"    Fetched {len(all_contacts)} contacts...")

        if not after or not contacts:
            break

    return all_contacts


def analyze_contacts_by_lifecycle(client: HubSpotClient) -> dict[str, Any]:
    """Analyze contact personas by lifecycle stage."""

    lifecycle_stages = [
        "subscriber",
        "lead",
        "marketingqualifiedlead",
        "salesqualifiedlead",
        "opportunity",
        "customer",
    ]

    results = {}

    for stage in lifecycle_stages:
        print(f"Fetching {stage} contacts...")

        contacts = fetch_all_contacts(
            client,
            filters=[{
                "propertyName": "lifecyclestage",
                "operator": "EQ",
                "value": stage
            }],
            properties=["jobtitle", "email", "firstname", "lastname", "company"]
        )

        persona_counts = defaultdict(int)
        for contact in contacts:
            props = contact.get("properties", {})
            job_title = props.get("jobtitle", "")
            persona = classify_persona(job_title)
            persona_counts[persona] += 1

        results[stage] = {
            "total": len(contacts),
            "by_persona": dict(persona_counts)
        }
        print(f"  Found {len(contacts)} {stage} contacts")

    return results


def fetch_all_deals(client: HubSpotClient, max_results: int = 10000) -> list:
    """Fetch deals using pagination (up to HubSpot's 10k limit)."""
    all_deals = []
    after = None
    page = 0

    while len(all_deals) < max_results:
        page += 1
        try:
            response = client.post(
                "/crm/v3/objects/deals/search",
                json_data={
                    "limit": 100,
                    "properties": ["dealname", "dealstage", "amount", "closedate", "pipeline"],
                    "sorts": [{"propertyName": "createdate", "direction": "DESCENDING"}],
                    **({"after": after} if after else {})
                }
            )
        except Exception as e:
            print(f"    Reached HubSpot limit at {len(all_deals)} deals")
            break

        deals = response.get("results", [])
        all_deals.extend(deals)

        paging = response.get("paging", {})
        after = paging.get("next", {}).get("after")

        if page % 10 == 0:
            print(f"    Fetched {len(all_deals)} deals...")

        if not after or not deals:
            break

    return all_deals


def analyze_deals_by_stage(client: HubSpotClient) -> dict[str, Any]:
    """Analyze deals and their associated contact personas."""

    print("Fetching all deals...")

    deals = fetch_all_deals(client)
    print(f"Found {len(deals)} deals")

    # Get unique deal stages
    stage_counts = defaultdict(lambda: {"count": 0, "total_amount": 0, "personas": defaultdict(int)})

    for deal in deals:
        props = deal.get("properties", {})
        stage = props.get("dealstage", "unknown")
        amount = float(props.get("amount") or 0)
        deal_id = deal.get("id")

        stage_counts[stage]["count"] += 1
        stage_counts[stage]["total_amount"] += amount

        # Get associated contacts for this deal
        try:
            assoc_response = client.get(
                f"/crm/v4/objects/deals/{deal_id}/associations/contacts"
            )
            contact_ids = [r.get("toObjectId") for r in assoc_response.get("results", [])]

            for contact_id in contact_ids[:5]:  # Limit to 5 contacts per deal
                try:
                    contact = client.get(
                        f"/crm/v3/objects/contacts/{contact_id}",
                        params={"properties": "jobtitle"}
                    )
                    job_title = contact.get("properties", {}).get("jobtitle", "")
                    persona = classify_persona(job_title)
                    stage_counts[stage]["personas"][persona] += 1
                except Exception:
                    pass
        except Exception as e:
            print(f"  Could not get associations for deal {deal_id}: {e}")

    return {stage: dict(data) for stage, data in stage_counts.items()}


def analyze_email_engagement(client: HubSpotClient) -> dict[str, Any]:
    """Analyze email engagement by persona."""

    print("Fetching all contacts with email engagement data...")

    # Get contacts with engagement properties
    contacts = fetch_all_contacts(
        client,
        filters=[{
            "propertyName": "hs_email_open",
            "operator": "HAS_PROPERTY"
        }],
        properties=[
            "jobtitle", "email", "firstname", "lastname",
            "hs_email_open", "hs_email_click", "hs_email_replied",
            "hs_sales_email_last_replied", "num_contacted_notes"
        ]
    )

    print(f"Found {len(contacts)} contacts with email engagement")

    engagement_by_persona = defaultdict(lambda: {
        "count": 0,
        "opens": 0,
        "clicks": 0,
        "replies": 0,
    })

    for contact in contacts:
        props = contact.get("properties", {})
        job_title = props.get("jobtitle", "")
        persona = classify_persona(job_title)

        engagement_by_persona[persona]["count"] += 1
        engagement_by_persona[persona]["opens"] += int(props.get("hs_email_open") or 0)
        engagement_by_persona[persona]["clicks"] += int(props.get("hs_email_click") or 0)

        # Check for replies
        if props.get("hs_email_replied") or props.get("hs_sales_email_last_replied"):
            engagement_by_persona[persona]["replies"] += 1

    # Calculate rates
    for persona, data in engagement_by_persona.items():
        if data["count"] > 0:
            data["open_rate"] = round(data["opens"] / data["count"], 2)
            data["click_rate"] = round(data["clicks"] / data["count"], 2)
            data["reply_rate"] = round(data["replies"] / data["count"], 2)

    return dict(engagement_by_persona)


def calculate_persona_scores(
    lifecycle_data: dict,
    deal_data: dict,
    engagement_data: dict
) -> dict[str, Any]:
    """Calculate overall persona scores based on all data."""

    scores = {}

    all_personas = set()
    for stage_data in lifecycle_data.values():
        all_personas.update(stage_data.get("by_persona", {}).keys())
    all_personas.update(engagement_data.keys())

    for persona in all_personas:
        if persona in ["unknown", "other"]:
            continue

        # Conversion score: ratio of customers to leads
        leads = lifecycle_data.get("lead", {}).get("by_persona", {}).get(persona, 0)
        customers = lifecycle_data.get("customer", {}).get("by_persona", {}).get(persona, 0)
        sqls = lifecycle_data.get("salesqualifiedlead", {}).get("by_persona", {}).get(persona, 0)

        conversion_score = 0
        if leads > 0:
            conversion_score = (customers + sqls) / leads

        # Engagement score
        eng = engagement_data.get(persona, {})
        engagement_score = (
            eng.get("open_rate", 0) * 0.3 +
            eng.get("click_rate", 0) * 0.3 +
            eng.get("reply_rate", 0) * 0.4
        )

        # Deal score: presence in won deals
        deal_score = 0
        for stage, data in deal_data.items():
            if stage and ("won" in stage.lower() or "closed" in stage.lower()):
                deal_score += data.get("personas", {}).get(persona, 0)

        scores[persona] = {
            "conversion_score": round(conversion_score, 3),
            "engagement_score": round(engagement_score, 3),
            "deal_score": deal_score,
            "sample_size": {
                "leads": leads,
                "customers": customers,
                "engaged_contacts": eng.get("count", 0)
            }
        }

    return scores


def main():
    """Run persona analysis."""
    client = HubSpotClient()

    print("=" * 60)
    print("PERSONA ANALYSIS - HubSpot Data")
    print("=" * 60)

    # Analyze lifecycle stages
    print("\n1. Analyzing contacts by lifecycle stage...")
    lifecycle_data = analyze_contacts_by_lifecycle(client)

    print("\nLifecycle Stage Summary:")
    for stage, data in lifecycle_data.items():
        print(f"  {stage}: {data['total']} contacts")
        for persona, count in sorted(data['by_persona'].items(), key=lambda x: -x[1])[:5]:
            print(f"    - {persona}: {count}")

    # Analyze deals
    print("\n2. Analyzing deals by stage...")
    deal_data = analyze_deals_by_stage(client)

    print("\nDeal Stage Summary:")
    for stage, data in deal_data.items():
        print(f"  {stage}: {data['count']} deals, ${data['total_amount']:,.0f}")

    # Analyze engagement
    print("\n3. Analyzing email engagement...")
    engagement_data = analyze_email_engagement(client)

    print("\nEngagement by Persona:")
    for persona, data in sorted(engagement_data.items(), key=lambda x: -x[1].get('reply_rate', 0)):
        print(f"  {persona}:")
        print(f"    - Contacts: {data['count']}")
        print(f"    - Open Rate: {data.get('open_rate', 0):.1%}")
        print(f"    - Click Rate: {data.get('click_rate', 0):.1%}")
        print(f"    - Reply Rate: {data.get('reply_rate', 0):.1%}")

    # Calculate scores
    print("\n4. Calculating persona scores...")
    scores = calculate_persona_scores(lifecycle_data, deal_data, engagement_data)

    print("\n" + "=" * 60)
    print("PERSONA SCORES (Higher = Better)")
    print("=" * 60)

    for persona, data in sorted(scores.items(), key=lambda x: -(x[1]['conversion_score'] + x[1]['engagement_score'])):
        total = data['conversion_score'] + data['engagement_score']
        print(f"\n{persona.upper()}:")
        print(f"  Conversion Score: {data['conversion_score']:.3f}")
        print(f"  Engagement Score: {data['engagement_score']:.3f}")
        print(f"  Deal Presence: {data['deal_score']}")
        print(f"  TOTAL SCORE: {total:.3f}")
        print(f"  Sample: {data['sample_size']}")

    # Save results
    output = {
        "lifecycle_data": lifecycle_data,
        "deal_data": deal_data,
        "engagement_data": engagement_data,
        "persona_scores": scores
    }

    output_path = os.path.join(os.path.dirname(__file__), "persona_analysis_results.json")
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, default=str)

    print(f"\nResults saved to: {output_path}")

    return output


if __name__ == "__main__":
    main()
