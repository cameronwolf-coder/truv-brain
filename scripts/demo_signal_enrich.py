"""Demo: end-to-end signal enrichment on a HubSpot list.

Usage:
    python scripts/demo_signal_enrich.py <list_id> [--model gemini|claude] [--limit N]

Example:
    python scripts/demo_signal_enrich.py 9229 --model gemini
"""

import argparse
import json
import sys
import time
from dataclasses import asdict

from outreach_intel.hubspot_client import HubSpotClient
from outreach_intel.enrichment import EnrichmentService
from outreach_intel.signal_agent import (
    enrich_contacts,
    _format_contacts_for_prompt,
    SignalReview,
)
from outreach_intel.scorer import ContactScorer, FORM_PROPERTIES


def main():
    parser = argparse.ArgumentParser(description="Demo signal enrichment on a HubSpot list")
    parser.add_argument("list_id", help="HubSpot list ID")
    parser.add_argument("-m", "--model", choices=["gemini", "claude"], default="gemini")
    parser.add_argument("-l", "--limit", type=int, default=25, help="Max contacts to enrich")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    hs = HubSpotClient()

    # ── Step 1: Pull contacts from HubSpot list ───────────────────
    print(f"\n{'='*70}")
    print(f"STEP 1: Pulling contacts from HubSpot list {args.list_id}")
    print(f"{'='*70}")

    resp = hs.get(f"/crm/v3/lists/{args.list_id}/memberships")
    member_ids = [m["recordId"] for m in resp.get("results", [])]
    print(f"  Found {len(member_ids)} members in list")

    if not member_ids:
        print("  No contacts in list. Exiting.")
        sys.exit(1)

    contacts_raw = hs.batch_get_contacts(
        member_ids[:args.limit],
        properties=[
            "firstname", "lastname", "email", "jobtitle", "company",
            "lifecyclestage", "hs_lead_status", "industry", "sales_vertical",
            "hs_email_last_open_date", "hs_email_last_click_date",
            "notes_last_updated", "hs_email_sends_since_last_engagement",
        ] + FORM_PROPERTIES,
    )

    print(f"  Fetched details for {len(contacts_raw)} contacts:\n")
    for c in contacts_raw:
        p = c.get("properties", {})
        name = f"{p.get('firstname', '')} {p.get('lastname', '')}".strip()
        print(f"    {name:<30} {p.get('jobtitle') or '(no title)':<35} {p.get('company') or '(no company)'}")

    # ── Step 2: Score contacts ────────────────────────────────────
    print(f"\n{'='*70}")
    print(f"STEP 2: Scoring contacts (engagement + timing + deal context)")
    print(f"{'='*70}")

    scorer = ContactScorer()
    scored = []
    for c in contacts_raw:
        p = c.get("properties", {})
        sc = scorer.score_contact(c)
        scored.append({
            "contact_id": c["id"],
            "firstname": p.get("firstname", ""),
            "lastname": p.get("lastname", ""),
            "email": p.get("email", ""),
            "jobtitle": p.get("jobtitle", ""),
            "company": p.get("company", ""),
            "lifecyclestage": p.get("lifecyclestage", ""),
            "engagement_score": sc.engagement_score,
            "timing_score": sc.timing_score,
            "deal_context_score": sc.deal_context_score,
            "external_trigger_score": sc.external_trigger_score,
            "form_fit_score": sc.form_fit_score,
            "total_score": sc.total_score,
        })

    scored.sort(key=lambda x: x["total_score"], reverse=True)

    for s in scored:
        name = f"{s['firstname']} {s['lastname']}".strip()
        print(f"    {name:<30} Score: {s['total_score']:5.1f}  "
              f"(E={s['engagement_score']:.0f} T={s['timing_score']:.0f} "
              f"D={s['deal_context_score']:.0f} X={s['external_trigger_score']:.0f}"
              f"{f' F={s[\"form_fit_score\"]:.0f}' if s['form_fit_score'] > 0 else ''})")

    # ── Step 3: Apollo enrichment (per contact) ───────────────────
    print(f"\n{'='*70}")
    print(f"STEP 3: Apollo enrichment (firmographics + hiring signals)")
    print(f"{'='*70}")

    enrichment_svc = EnrichmentService()
    apollo_data = {}
    total_credits = 0

    for s in scored:
        name = f"{s['firstname']} {s['lastname']}".strip()
        print(f"\n  Enriching {name} ({s['company'] or s['email']})...")

        try:
            result = enrichment_svc.enrich_contact(
                email=s["email"] or None,
                first_name=s["firstname"] or None,
                last_name=s["lastname"] or None,
                company=s["company"] or None,
            )
            total_credits += result.credits_used

            if result.person and result.person.title:
                print(f"    Title (Apollo): {result.person.title}")
            if result.company:
                c = result.company
                parts = []
                if c.industry:
                    parts.append(f"Industry: {c.industry}")
                if c.employee_count:
                    parts.append(f"Employees: {c.employee_count:,}")
                if c.tech_stack:
                    parts.append(f"Tech: {', '.join(c.tech_stack[:5])}")
                if parts:
                    print(f"    Company: {' | '.join(parts)}")
            if result.hiring_signals:
                print(f"    Hiring: {len(result.hiring_signals)} open roles")
                for h in result.hiring_signals[:3]:
                    print(f"      - {h.job_title}")
            if not result.person and not result.company:
                print(f"    No enrichment data found")

            apollo_data[s["contact_id"]] = result

        except Exception as e:
            print(f"    Error: {e}")

        time.sleep(0.2)  # Rate limit courtesy

    print(f"\n  Total Apollo credits used: {total_credits}")

    # ── Step 4: Gemini/Claude agent reasoning ─────────────────────
    print(f"\n{'='*70}")
    print(f"STEP 4: AI agent reasoning ({args.model})")
    print(f"{'='*70}")
    print(f"  Sending {len(scored)} contacts to {args.model} for analysis...")
    print(f"  The agent will call tools and synthesize findings...\n")

    start = time.time()
    reviews = enrich_contacts(scored, limit=args.limit, model_provider=args.model)
    elapsed = time.time() - start

    print(f"  Agent completed in {elapsed:.1f}s")

    # ── Step 5: Results ───────────────────────────────────────────
    print(f"\n{'='*70}")
    print(f"STEP 5: FINAL RESULTS — Enriched Signal Review")
    print(f"{'='*70}\n")

    if args.json:
        output = [asdict(r) for r in reviews]
        print(json.dumps(output, indent=2))
    else:
        for i, r in enumerate(reviews, 1):
            match = next((s for s in scored if s["contact_id"] == r.contact_id), None)
            name = f"{match['firstname']} {match['lastname']}".strip() if match else r.contact_id
            company = match["company"] if match else ""

            apollo = apollo_data.get(r.contact_id)
            apollo_title = ""
            if apollo and apollo.person and apollo.person.title:
                apollo_title = f" (Apollo: {apollo.person.title})"

            print(f"  {i}. {name} — {company}{apollo_title}")
            print(f"     Score: {r.original_score:.0f} -> {r.adjusted_score:.0f}  [{r.confidence} confidence]")
            print(f"     {r.reasoning}")
            print(f"     -> Action: {r.recommended_action}")
            print()

    # ── Summary ───────────────────────────────────────────────────
    print(f"{'='*70}")
    print(f"DEMO SUMMARY")
    print(f"{'='*70}")
    print(f"  HubSpot list:      {args.list_id} ({len(contacts_raw)} contacts)")
    print(f"  Apollo credits:    {total_credits}")
    print(f"  LLM provider:      {args.model}")
    print(f"  Agent runtime:     {elapsed:.1f}s")
    print(f"  Contacts reviewed: {len(reviews)}")
    if reviews:
        top = reviews[0]
        top_match = next((s for s in scored if s["contact_id"] == top.contact_id), None)
        top_name = f"{top_match['firstname']} {top_match['lastname']}".strip() if top_match else top.contact_id
        print(f"  Top lead:          {top_name} (score {top.adjusted_score:.0f})")
    print()


if __name__ == "__main__":
    main()
