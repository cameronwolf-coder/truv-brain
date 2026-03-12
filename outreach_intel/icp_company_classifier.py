"""
Gemini-powered company ICP classifier for HubSpot.

Writes sales_vertical and segment (market_segment) on Company objects.
Contact-level fields are calculated/copied from the associated Company automatically.
"""

import json
import os
import time
from typing import Any

import requests
from dotenv import load_dotenv

from outreach_intel.hubspot_client import HubSpotClient
from outreach_intel.icp_classifier import (
    GEMINI_API_KEY,
    GEMINI_URL,
    VALID_SEGMENTS,
    VALID_VERTICALS,
    VERTICAL_ALIASES,
)

load_dotenv()

COMPANY_CLASSIFY_PROMPT = """You are an ICP classifier for Truv, a consumer-permissioned data platform for income and employment verification. Your customers are mortgage lenders, banks, credit unions, and fintechs.

Given a list of companies with their name and sample employee titles, classify each into:

1. **sales_vertical** — what type of organization:
   - `Bank` — commercial bank, savings bank, national bank (e.g., U.S. Bank, Frost Bank, PNC)
   - `IMB` — independent mortgage bank/company (e.g., United Home Loans, Guild Mortgage, loanDepot)
   - `Credit Union` — credit unions (e.g., Navy Federal Credit Union)
   - `Channel Partner` — technology vendors, data providers, consultants that serve lenders (e.g., Optimal Blue, Polly, Plaid, Truework, Snapdocs, nCino, ICE Mortgage Technology)
   - `Fintech` — fintech companies not squarely a lender or vendor
   - `Government` — government agencies, GSEs, housing authorities (e.g., Virginia Housing, FHA, Fannie Mae)
   - `Background Screening` — background check / screening companies
   - `Home Equity Lender` — specialists in HELOC/home equity
   - `Lending` — non-bank lenders that aren't purely mortgage (auto, personal, etc.)
   - `Other` — doesn't fit above categories

2. **segment** — estimated company size tier:
   - `Enterprise` — very large (top 25 banks, top 10 lenders, Fortune 500)
   - `Strategic` — large regional banks, top 50 lenders
   - `Mid-Market` — mid-size banks/lenders, 500-5000 employees
   - `Growth` — smaller banks/lenders, 50-500 employees
   - `Self-Service` — very small shops, brokers, <50 employees

Respond ONLY with a JSON array. Each element: {"id": <company_id>, "sales_vertical": ..., "segment": ...}
Use null for fields you can't determine. No explanations."""


def classify_companies_batch(companies: list[dict]) -> list[dict]:
    """Send a batch of companies to Gemini for classification."""
    lines = []
    for c in companies:
        titles = c.get("sample_titles", "")
        lines.append(f"ID: {c['id']} | Company: {c['name']} | Sample titles: {titles}")

    user_msg = "Classify these companies:\n\n" + "\n".join(lines)

    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": COMPANY_CLASSIFY_PROMPT + "\n\n" + user_msg}]}
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }

    resp = requests.post(GEMINI_URL, json=payload, timeout=60)
    resp.raise_for_status()

    text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


def run(write: bool = False):
    """Find companies missing sales_vertical/segment and classify them."""
    client = HubSpotClient()

    # Step 1: Get all ICE26 contacts with email
    print("Fetching ICE26 contacts...")
    contacts = []
    after = None
    while True:
        body = {
            "limit": 100,
            "properties": ["email", "sales_vertical", "market_segment", "jobtitle", "company"],
            "filterGroups": [
                {
                    "filters": [
                        {"propertyName": "pre_event_source", "operator": "EQ", "value": "ICE26"},
                        {"propertyName": "email", "operator": "HAS_PROPERTY"},
                    ]
                }
            ],
        }
        if after:
            body["after"] = after
        resp = client.post("/crm/v3/objects/contacts/search", json_data=body)
        results = resp.get("results", [])
        for r in results:
            props = r.get("properties", {})
            props["id"] = r["id"]
            contacts.append(props)
        after = (resp.get("paging") or {}).get("next", {}).get("after")
        if not after or not results:
            break

    # Filter to contacts missing sales_vertical or market_segment
    needs_fix = [c for c in contacts if not c.get("sales_vertical") or not c.get("market_segment")]
    print(f"Total ICE26 contacts: {len(contacts)}")
    print(f"Missing vertical or segment: {len(needs_fix)}")

    # Step 2: Get associated company IDs for these contacts
    print("\nFetching company associations...")
    contact_ids = [str(c["id"]) for c in needs_fix]
    company_contact_map: dict[str, list[dict]] = {}  # company_id -> [contacts]
    contact_company_map: dict[str, str] = {}  # contact_id -> company_id

    for i in range(0, len(contact_ids), 100):
        batch = contact_ids[i : i + 100]
        assoc_resp = client.post(
            "/crm/v4/associations/contacts/companies/batch/read",
            json_data={"inputs": [{"id": cid} for cid in batch]},
        )
        for result in assoc_resp.get("results", []):
            cid = str(result["from"]["id"])
            for to in result.get("to", []):
                company_id = str(to["toObjectId"])
                contact_company_map[cid] = company_id
                if company_id not in company_contact_map:
                    company_contact_map[company_id] = []
                # Store contact info for title sampling
                contact = next((c for c in needs_fix if str(c["id"]) == cid), None)
                if contact:
                    company_contact_map[company_id].append(contact)
                break  # take first company association

    print(f"Contacts with company association: {len(contact_company_map)}")
    print(f"Unique companies to check: {len(company_contact_map)}")

    no_company = len(needs_fix) - len(contact_company_map)
    if no_company:
        print(f"Contacts with NO company association: {no_company} (skipped)")

    # Step 3: Fetch company properties to find which need updates
    print("\nChecking which companies need classification...")
    companies_to_classify = []
    company_ids = list(company_contact_map.keys())

    for i in range(0, len(company_ids), 100):
        batch = company_ids[i : i + 100]
        batch_resp = client.post(
            "/crm/v3/objects/companies/batch/read",
            json_data={
                "inputs": [{"id": cid} for cid in batch],
                "properties": ["name", "sales_vertical", "segment"],
            },
        )
        for result in batch_resp.get("results", []):
            props = result.get("properties", {})
            cid = str(result["id"])
            needs_vertical = not props.get("sales_vertical")
            needs_segment = not props.get("segment")

            if needs_vertical or needs_segment:
                # Gather sample titles from associated contacts
                assoc_contacts = company_contact_map.get(cid, [])
                titles = [c.get("jobtitle", "") for c in assoc_contacts if c.get("jobtitle")][:5]

                companies_to_classify.append({
                    "id": cid,
                    "name": props.get("name", "Unknown"),
                    "sample_titles": ", ".join(titles),
                    "needs_vertical": needs_vertical,
                    "needs_segment": needs_segment,
                    "current_vertical": props.get("sales_vertical"),
                    "current_segment": props.get("segment"),
                })

    print(f"Companies needing classification: {len(companies_to_classify)}")

    if not companies_to_classify:
        print("Nothing to do!")
        return

    # Step 4: Classify via Gemini
    print("\nClassifying companies via Gemini...")
    all_results = []
    batch_size = 20

    for i in range(0, len(companies_to_classify), batch_size):
        batch = companies_to_classify[i : i + batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(companies_to_classify) + batch_size - 1) // batch_size

        for attempt in range(3):
            try:
                results = classify_companies_batch(batch)
                all_results.extend(results)
                print(f"  Batch {batch_num}/{total_batches}: classified {len(results)} companies")
                break
            except Exception as e:
                if attempt < 2 and "429" in str(e):
                    print(f"  Batch {batch_num}/{total_batches}: rate limited, retrying in 10s...")
                    time.sleep(10)
                else:
                    print(f"  Batch {batch_num}/{total_batches}: ERROR - {e}")
                    break

        if i + batch_size < len(companies_to_classify):
            time.sleep(5)

    print(f"\nClassified: {len(all_results)} companies")

    # Build result lookup
    result_map = {str(r["id"]): r for r in all_results}

    if not write:
        # Dry run — show distribution
        from collections import Counter

        verts = Counter(r.get("sales_vertical") for r in all_results)
        segs = Counter(r.get("segment") for r in all_results)

        print("\nSales Vertical distribution:")
        for k, v in verts.most_common():
            print(f"  {k}: {v}")

        print("\nMarket Segment distribution:")
        for k, v in segs.most_common():
            print(f"  {k}: {v}")

        # Show sample
        print("\nSample classifications:")
        for comp in companies_to_classify[:15]:
            classified = result_map.get(comp["id"], {})
            print(f"  {comp['name']:40s} → vertical={classified.get('sales_vertical')}, segment={classified.get('segment')}")

        return all_results

    # Step 5: Write to HubSpot
    print("\nWriting to HubSpot companies...")
    updated = 0
    skipped = 0

    for comp in companies_to_classify:
        classified = result_map.get(comp["id"])
        if not classified:
            skipped += 1
            continue

        props: dict[str, str] = {}

        if comp["needs_vertical"] and classified.get("sales_vertical"):
            vert = VERTICAL_ALIASES.get(classified["sales_vertical"], classified["sales_vertical"])
            if vert in VALID_VERTICALS:
                props["sales_vertical"] = vert

        if comp["needs_segment"] and classified.get("segment"):
            if classified["segment"] in VALID_SEGMENTS:
                props["segment"] = classified["segment"]

        if props:
            try:
                client._request(
                    "PATCH",
                    f"/crm/v3/objects/companies/{comp['id']}",
                    json_data={"properties": props},
                )
                updated += 1
            except Exception as e:
                print(f"  Failed {comp['id']} ({comp['name']}): {e}")
                skipped += 1
        else:
            skipped += 1

        if updated % 50 == 0 and updated > 0:
            print(f"  Updated {updated} companies...")
            time.sleep(1)

    print(f"\nDone! Updated: {updated} companies | Skipped: {skipped}")
    return all_results


if __name__ == "__main__":
    import sys

    write_mode = "--write" in sys.argv
    run(write=write_mode)
