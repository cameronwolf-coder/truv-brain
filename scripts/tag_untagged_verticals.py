"""Auto-tag untagged HubSpot companies with sales_vertical based on domain + name.

The contact-level sales_vertical is a calculated (read-only) property inherited
from the associated company. So we tag COMPANIES, and the contacts inherit.

Usage:
    # Preview only (no changes)
    python scripts/tag_untagged_verticals.py --dry-run

    # Apply tags
    python scripts/tag_untagged_verticals.py

    # Apply tags for a single vertical
    python scripts/tag_untagged_verticals.py --vertical Bank
"""

import argparse
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from outreach_intel.hubspot_client import HubSpotClient

# ── Keyword rules for classification ─────────────────────────────────
# Order matters: first match wins. More specific patterns go first.

VERTICAL_RULES = {
    "Credit Union": {
        "domain_keywords": [
            "creditunion", "cu.org", "cuso", "cuanswers", "cunamutual",
            "ncua", "cuna.", "fcu.", "tfcu.", "becu.", "nfcu.",
        ],
        "name_keywords": [
            "credit union", "federal credit", " fcu", "employees credit",
        ],
        "exact_domains": {
            "trustone.org", "nfcu.net", "becu.org", "suncoastcreditunion.com",
        },
    },
    "IMB": {
        "domain_keywords": [
            "mortgage", "homeloan", "homeloans", "mtg.", "lending",
            "homefinance", "homepoint", "loancare", "loanpal",
            "loandepot", "rocketmortgage",
        ],
        "name_keywords": [
            "mortgage", "home loan", "home loans", "home lending",
            "va rates", "va loan",
        ],
        "exact_domains": {
            "carringtonms.com", "cmghomeloans.com", "guildmortgage.net",
            "htlenders.com", "university-lending.com", "homepointfinancial.com",
            "fgmc.com", "princetonmortgage.com", "mcleanmortgage.com",
            "gfshomeloans.com", "envoy.com", "hpfc.com", "sirva.com",
            "flagstar.com", "firstam.com",
            # Round 2 fixes
            "sibcycline.com", "victorianfinance.com", "stearns.com",
            "lowvarates.com", "ovmfinancial.com", "offerpad.com",
            "dreeshomes.com", "ifinancial.com", "gocaribou.com",
            "amerifirstloan.com", "lendtheway.com", "ntfn.com",
            "gocolonial.com", "formfree.com", "mwhc.com",
            "richmondamerican.com", "centurycommunities.com",
            "valleydirect.com", "acemtgpro.com", "americahl.com",
            "accreditedhl.com", "allstarmtgprocessing.com",
        },
    },
    "Home Equity Lender": {
        "domain_keywords": [
            "homeequity", "heloc", "equity.com",
        ],
        "name_keywords": [
            "home equity", "heloc",
        ],
        "exact_domains": set(),
    },
    "Bank": {
        "domain_keywords": [
            "bank", "bancorp", "bancshares", "bankers", "banking",
            "bnk.", "fsb.", "fsbbank", "nationalbank", "savingsbank",
            "statebank", "communitybank", "trustco",
        ],
        "name_keywords": [
            " bank", "bank ", "bancorp", "bancshares", "bankers",
            "savings bank", "national bank", "trust co",
        ],
        "exact_domains": {
            "bxs.com", "carybank.com", "plainscapital.com", "ampf.com",
            "fremontbank.com", "wellsfargoadvisors.com", "pacificwesternbank.com",
            "midwestone.com", "firstib.com", "etrade.com", "nscbank.com",
            "cnob.com", "q2ebanking.com",
            # Round 2 fixes
            "abbotdowning.com", "aaanortheast.com",
        },
    },
    "Lending": {
        "domain_keywords": [
            "lend.", "lender", "subprime", "consumer-lending",
            "personalloans", "financeloans",
        ],
        "name_keywords": [
            "subprime", "consumer lend",
        ],
        "exact_domains": set(),
    },
    "Auto Lending": {
        "domain_keywords": [
            "autolend", "carloan", "vehicleloan",
        ],
        "name_keywords": [
            "auto lend", "auto loan", "vehicle lend",
        ],
        "exact_domains": set(),
    },
    "Government": {
        "domain_keywords": [
            ".gov", ".state.", "state.us",
        ],
        "name_keywords": [
            "state of ", "county of ", "city of ", "department of",
            "government", "public housing", "medicaid",
        ],
        "exact_domains": {
            "state.nm.us", "medicaid.alabama.gov", "wa.gov", "co.dakota.mn.us",
            "state.gov", "alaska.gov", "wrightcountymn.gov", "stearnscountymn.gov",
            # Round 2 fixes
            "us-hc.com", "calsaws.org", "stpha.org",
        },
    },
    "Background Screening": {
        "domain_keywords": [
            "background", "screening", "bgcheck",
        ],
        "name_keywords": [
            "background", "screening", "verification",
        ],
        "exact_domains": set(),
    },
    "Fintech": {
        "domain_keywords": [
            "fintech",
        ],
        "name_keywords": [
            "fintech",
        ],
        "exact_domains": {
            "anduril.com", "buildertrend.com",
        },
    },
    "Tenant Screening": {
        "domain_keywords": [
            "tenant", "rentalscreen", "apartmenthomes", "propertymgmt",
        ],
        "name_keywords": [
            "tenant screen", "apartment", "property manage",
            "residential property",
        ],
        "exact_domains": {
            "weidner.com",
        },
    },
}


def classify(domain: str, name: str) -> str | None:
    """Return the sales_vertical for a company domain/name, or None."""
    domain_lower = (domain or "").lower()
    name_lower = (name or "").lower()

    for vertical, rules in VERTICAL_RULES.items():
        if domain_lower in rules.get("exact_domains", set()):
            return vertical
        for kw in rules.get("domain_keywords", []):
            if kw in domain_lower:
                return vertical
        if name_lower:
            for kw in rules.get("name_keywords", []):
                if kw in name_lower:
                    return vertical
    return None


def fetch_untagged_companies(client: HubSpotClient) -> list[dict]:
    """Fetch all companies with no sales_vertical."""
    properties = ["name", "domain", "sales_vertical"]
    ranges = [
        (None, "2023-01-01"),
        ("2023-01-01", "2024-01-01"),
        ("2024-01-01", "2024-07-01"),
        ("2024-07-01", "2025-01-01"),
        ("2025-01-01", "2025-07-01"),
        ("2025-07-01", "2026-01-01"),
        ("2026-01-01", None),
    ]

    all_companies = []
    for start, end in ranges:
        after = None
        while True:
            filters = [{"propertyName": "sales_vertical", "operator": "NOT_HAS_PROPERTY"}]
            if start:
                filters.append({"propertyName": "createdate", "operator": "GTE", "value": start})
            if end:
                filters.append({"propertyName": "createdate", "operator": "LT", "value": end})
            body = {
                "filterGroups": [{"filters": filters}],
                "limit": 100,
                "properties": properties,
            }
            if after:
                body["after"] = after
            try:
                resp = client.post("/crm/v3/objects/companies/search", json_data=body)
            except Exception as e:
                print(f"  Error fetching {start}-{end}: {e}", flush=True)
                break
            results = resp.get("results", [])
            all_companies.extend(results)
            after = resp.get("paging", {}).get("next", {}).get("after")
            if not after or not results:
                break
            time.sleep(0.05)
        label = f"{start or 'beginning'} -> {end or 'now'}"
        print(f"  {label}: {len(all_companies):,} total", flush=True)

    seen = {}
    for c in all_companies:
        seen[c["id"]] = c
    return list(seen.values())


def batch_update_companies(client: HubSpotClient, updates: list[dict]) -> tuple[int, int]:
    """Batch update companies. Returns (updated, errors)."""
    updated = 0
    errors = 0
    for i in range(0, len(updates), 100):
        batch = updates[i:i + 100]
        body = {"inputs": batch}
        try:
            client.post("/crm/v3/objects/companies/batch/update", json_data=body)
            updated += len(batch)
            if updated % 500 == 0 or i + 100 >= len(updates):
                print(f"  Updated {updated:,}/{len(updates):,}...", flush=True)
        except Exception as e:
            errors += len(batch)
            print(f"  Error updating batch: {e}", flush=True)
        time.sleep(0.1)
    return updated, errors


def main():
    parser = argparse.ArgumentParser(description="Auto-tag untagged HubSpot companies by vertical")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, no changes")
    parser.add_argument("--vertical", help="Only tag companies matching this vertical")
    args = parser.parse_args()

    client = HubSpotClient()

    print("Fetching untagged companies...", flush=True)
    companies = fetch_untagged_companies(client)
    print(f"\nTotal untagged companies: {len(companies):,}\n")

    tagged = defaultdict(list)  # vertical -> [(company_id, domain, name)]
    unclassified = []

    for c in companies:
        p = c["properties"]
        domain = (p.get("domain") or "").strip()
        name = (p.get("name") or "").strip()

        vertical = classify(domain, name)
        if vertical:
            if args.vertical and vertical != args.vertical:
                continue
            tagged[vertical].append((c["id"], domain, name))
        else:
            unclassified.append((c["id"], domain, name))

    total_taggable = sum(len(v) for v in tagged.values())
    print(f"{'='*60}")
    print(f"CLASSIFICATION RESULTS")
    print(f"{'='*60}")
    print(f"  Taggable:       {total_taggable:,}")
    print(f"  Unclassified:   {len(unclassified):,}")
    print()

    for vertical, items in sorted(tagged.items(), key=lambda x: -len(x[1])):
        print(f"  {vertical:<25} {len(items):>6,}")

    if args.dry_run:
        print(f"\n[DRY RUN] No changes made.")
        if unclassified:
            print(f"\nTop 30 unclassified company domains:")
            domain_counts = Counter(d for _, d, _ in unclassified if d)
            for domain, count in domain_counts.most_common(30):
                sample_name = next((n for _, dd, n in unclassified if dd == domain and n), "")
                print(f"  {domain:<40} {count:>5}  {sample_name[:35]}")
        return

    # Apply tags to companies
    print(f"\nApplying tags to {total_taggable:,} companies...", flush=True)
    all_updates = []
    for vertical, items in tagged.items():
        for cid, _, _ in items:
            all_updates.append({"id": cid, "properties": {"sales_vertical": vertical}})

    updated, errors = batch_update_companies(client, all_updates)

    print(f"\n{'='*60}")
    print(f"DONE!")
    print(f"  Companies updated:  {updated:,}")
    print(f"  Errors:             {errors:,}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
