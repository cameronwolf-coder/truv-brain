"""
Gemini-powered ICP classifier for HubSpot contacts.

Uses title + company to classify:
  - Job Function (icp): lending, technology, operations, c_suite, deposits, servicing
  - Sales Vertical (sales_vertical): Bank, IMB, Credit Union, Channel Partner, Fintech, etc.
  - Market Segment (market_segment): Enterprise, Strategic, Mid-Market, Growth, Self-Service
"""

import json
import os
import time
from typing import Any

import requests
from dotenv import load_dotenv

from outreach_intel.hubspot_client import HubSpotClient

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"

# Valid values for each field (from existing HubSpot data)
VALID_JOB_FUNCTIONS = ["lending", "technology", "operations", "c_suite", "deposits", "servicing"]
VALID_VERTICALS = [
    "Bank", "IMB", "Credit Union", "Channel Partner", "Fintech",
    "Government", "Background Screening", "Lending", "Home Equity Lender", "Other"
]
VALID_SEGMENTS = ["Enterprise", "Strategic", "Mid-Market", "Growth", "Self-Service"]

# Map Gemini outputs that don't match valid values
JOB_FUNCTION_ALIASES = {
    "sales": "lending",
    "compliance": "operations",
}
VERTICAL_ALIASES = {
    "Servicing": "Other",
}

SYSTEM_PROMPT = """You are an ICP classifier for Truv, a consumer-permissioned data platform for income and employment verification. Your customers are mortgage lenders, banks, credit unions, and fintechs.

Given a list of contacts with their job title and company, classify each into:

1. **job_function** — the person's role category:
   - `lending` — mortgage, loan origination, closing, underwriting, secondary marketing, capital markets
   - `technology` — IT, engineering, software, product, business analyst, data, systems
   - `operations` — operations, processing, production, fulfillment, compliance, risk, QC
   - `c_suite` — CEO, CIO, CTO, COO, CRO, CFO, President, Chief _____ Officer (standalone executive titles)
   - `deposits` — consumer banking, digital banking, deposits, retail banking
   - `servicing` — loan servicing, default, loss mitigation, post-closing
   - `null` — if the title is missing or truly ambiguous

2. **sales_vertical** — what type of organization the company is:
   - `Bank` — commercial bank, savings bank, national bank (e.g., U.S. Bank, Frost Bank)
   - `IMB` — independent mortgage bank/company (e.g., United Home Loans, Guild Mortgage)
   - `Credit Union` — credit unions (e.g., Navy Federal Credit Union)
   - `Channel Partner` — technology vendors, data providers, consultants that serve lenders (e.g., Optimal Blue, Polly, Plaid, Truework, Snapdocs, nCino, Encompass/ICE)
   - `Fintech` — fintech companies not squarely a lender or vendor
   - `Government` — government agencies, GSEs, housing authorities (e.g., Virginia Housing, FHA)
   - `Background Screening` — background check / screening companies
   - `Home Equity Lender` — specialists in HELOC/home equity
   - `Lending` — non-bank lenders that aren't purely mortgage (auto, personal, etc.)
   - `Other` — doesn't fit above categories
   - `null` — if the company is missing

3. **market_segment** — estimated company size tier:
   - `Enterprise` — very large (top 25 banks, top 10 lenders, Fortune 500)
   - `Strategic` — large regional banks, top 50 lenders
   - `Mid-Market` — mid-size banks/lenders, 500-5000 employees
   - `Growth` — smaller banks/lenders, 50-500 employees
   - `Self-Service` — very small shops, brokers, <50 employees
   - `null` — if you're not confident

Respond ONLY with a JSON array. Each element must have: {"id": <contact_id>, "job_function": ..., "sales_vertical": ..., "market_segment": ...}

Use null (not "null") for fields you can't determine. Do not include explanations."""


def classify_batch(contacts: list[dict]) -> list[dict]:
    """Send a batch of contacts to Gemini for classification."""
    contact_lines = []
    for c in contacts:
        contact_lines.append(
            f"ID: {c['id']} | Title: {c.get('jobtitle', '')} | Company: {c.get('company', '')}"
        )

    user_msg = "Classify these contacts:\n\n" + "\n".join(contact_lines)

    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": SYSTEM_PROMPT + "\n\n" + user_msg}]}
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


def fetch_contacts_missing_icp(client: HubSpotClient) -> list[dict]:
    """Fetch all ICE26 contacts with email but missing Job Function."""
    contacts = []
    after = None

    while True:
        body = {
            "limit": 100,
            "properties": ["email", "icp", "sales_vertical", "market_segment", "jobtitle", "company"],
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

    return contacts


def dry_run(limit: int = 10):
    """Classify a small batch and print results for review."""
    client = HubSpotClient()
    all_contacts = fetch_contacts_missing_icp(client)

    # Filter to those missing at least one ICP field
    needs_classification = [
        c for c in all_contacts
        if not c.get("icp") or not c.get("sales_vertical") or not c.get("market_segment")
    ]

    print(f"Total ICE26 contacts with email: {len(all_contacts)}")
    print(f"Missing at least one ICP field: {len(needs_classification)}")
    print(f"\nClassifying first {limit} contacts...\n")

    batch = needs_classification[:limit]
    results = classify_batch(batch)

    # Print side by side
    for orig, classified in zip(batch, results):
        print(f"  {orig.get('jobtitle', '?'):40s} | {orig.get('company', '?'):30s}")
        print(f"    → function={classified.get('job_function')}, vertical={classified.get('sales_vertical')}, segment={classified.get('market_segment')}")
        print()

    return needs_classification, results


def run_full(batch_size: int = 20, write: bool = False):
    """Classify all contacts missing ICP fields.

    Args:
        batch_size: Contacts per Gemini call (max ~25 recommended)
        write: If True, write results to HubSpot. If False, just print summary.
    """
    client = HubSpotClient()
    all_contacts = fetch_contacts_missing_icp(client)

    needs_classification = [
        c for c in all_contacts
        if not c.get("icp") or not c.get("sales_vertical") or not c.get("market_segment")
    ]

    print(f"Total ICE26 contacts with email: {len(all_contacts)}")
    print(f"Need classification: {len(needs_classification)}")

    all_results = []
    errors = []

    for i in range(0, len(needs_classification), batch_size):
        batch = needs_classification[i : i + batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(needs_classification) + batch_size - 1) // batch_size

        for attempt in range(3):
            try:
                results = classify_batch(batch)
                all_results.extend(results)
                print(f"  Batch {batch_num}/{total_batches}: classified {len(results)} contacts")
                break
            except Exception as e:
                if attempt < 2 and "429" in str(e):
                    print(f"  Batch {batch_num}/{total_batches}: rate limited, retrying in 10s...")
                    time.sleep(10)
                else:
                    errors.append({"batch": batch_num, "error": str(e)})
                    print(f"  Batch {batch_num}/{total_batches}: ERROR - {e}")
                    break

        # Rate limit: Gemini Flash free tier = 15 RPM
        if i + batch_size < len(needs_classification):
            time.sleep(5)

    print(f"\nClassified: {len(all_results)} | Errors: {len(errors)}")

    if write:
        _write_to_hubspot(client, all_results, needs_classification)
    else:
        # Print summary
        from collections import Counter

        funcs = Counter(r.get("job_function") for r in all_results)
        verts = Counter(r.get("sales_vertical") for r in all_results)
        segs = Counter(r.get("market_segment") for r in all_results)

        print("\nJob Function distribution:")
        for k, v in funcs.most_common():
            print(f"  {k}: {v}")

        print("\nSales Vertical distribution:")
        for k, v in verts.most_common():
            print(f"  {k}: {v}")

        print("\nMarket Segment distribution:")
        for k, v in segs.most_common():
            print(f"  {k}: {v}")

    return all_results


def _write_to_hubspot(client: HubSpotClient, results: list[dict], contacts: list[dict]):
    """Write classification results back to HubSpot."""
    # Build lookup by contact ID
    result_map = {str(r["id"]): r for r in results}

    updated = 0
    skipped = 0

    for contact in contacts:
        cid = str(contact["id"])
        classified = result_map.get(cid)
        if not classified:
            skipped += 1
            continue

        props: dict[str, Any] = {}

        # Only set fields that are currently empty AND have a non-null classification
        if not contact.get("icp") and classified.get("job_function"):
            func = JOB_FUNCTION_ALIASES.get(classified["job_function"], classified["job_function"])
            if func in VALID_JOB_FUNCTIONS:
                props["icp"] = func

        if not contact.get("sales_vertical") and classified.get("sales_vertical"):
            vert = VERTICAL_ALIASES.get(classified["sales_vertical"], classified["sales_vertical"])
            if vert in VALID_VERTICALS:
                props["sales_vertical"] = vert

        if not contact.get("market_segment") and classified.get("market_segment"):
            if classified["market_segment"] in VALID_SEGMENTS:
                props["market_segment"] = classified["market_segment"]

        if props:
            try:
                client._request(
                    "PATCH",
                    f"/crm/v3/objects/contacts/{cid}",
                    json_data={"properties": props},
                )
                updated += 1
            except Exception as e:
                print(f"  Failed to update {cid}: {e}")
                skipped += 1
        else:
            skipped += 1

        # Throttle HubSpot writes
        if updated % 50 == 0 and updated > 0:
            print(f"  Updated {updated} contacts...")
            time.sleep(1)

    print(f"\nDone! Updated: {updated} | Skipped: {skipped}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "run":
        write = "--write" in sys.argv
        run_full(write=write)
    else:
        dry_run()
