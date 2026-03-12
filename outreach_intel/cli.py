"""Command-line interface for Outreach Intelligence."""
import argparse
import json
import sys
from typing import Optional

from outreach_intel.service import OutreachService
from outreach_intel.scorer import ScoredContact
from outreach_intel.tam_manager import extract_tam, calculate_waves
from outreach_intel.wave_scheduler import (
    build_wave,
    get_wave_status,
    AVAILABLE_ANGLES,
)


def format_contact(contact: ScoredContact, rank: int) -> str:
    """Format a scored contact for display."""
    parts = (
        f"{rank}. {contact.name} ({contact.jobtitle or 'Unknown Title'})\n"
        f"   Company: {contact.company or 'Unknown'}\n"
        f"   Email: {contact.email}\n"
        f"   Score: {contact.total_score:.1f} | "
        f"Stage: {contact.lifecyclestage}\n"
        f"   Breakdown: Engagement={contact.engagement_score:.0f} "
        f"Timing={contact.timing_score:.0f} "
        f"Context={contact.deal_context_score:.0f}"
    )
    if contact.form_fit_score > 0:
        parts += f" FormFit={contact.form_fit_score:.0f}"
    return parts


def cmd_dormant(args: argparse.Namespace) -> None:
    """Get dormant contacts."""
    service = OutreachService()
    contacts = service.get_dormant_contacts(
        limit=args.limit,
        industry=args.industry,
    )

    if args.json:
        output = [
            {
                "id": c.contact_id,
                "name": c.name,
                "email": c.email,
                "company": c.company,
                "score": c.total_score,
            }
            for c in contacts
        ]
        print(json.dumps(output, indent=2))
    else:
        print(f"\nTop {len(contacts)} Dormant Contacts:\n")
        print("-" * 60)
        for i, contact in enumerate(contacts, 1):
            print(format_contact(contact, i))
            print()


def cmd_closed_lost(args: argparse.Namespace) -> None:
    """Get closed-lost contacts."""
    service = OutreachService()
    contacts = service.get_closed_lost(
        limit=args.limit,
        industry=args.industry,
    )

    if args.json:
        output = [
            {
                "id": c.contact_id,
                "name": c.name,
                "email": c.email,
                "company": c.company,
                "score": c.total_score,
            }
            for c in contacts
        ]
        print(json.dumps(output, indent=2))
    else:
        print(f"\nTop {len(contacts)} Closed-Lost Contacts:\n")
        print("-" * 60)
        for i, contact in enumerate(contacts, 1):
            print(format_contact(contact, i))
            print()


def cmd_churned(args: argparse.Namespace) -> None:
    """Get churned customers."""
    service = OutreachService()
    contacts = service.get_churned_customers(limit=args.limit)

    if args.json:
        output = [
            {
                "id": c.contact_id,
                "name": c.name,
                "email": c.email,
                "company": c.company,
                "score": c.total_score,
            }
            for c in contacts
        ]
        print(json.dumps(output, indent=2))
    else:
        print(f"\nTop {len(contacts)} Churned Customers:\n")
        print("-" * 60)
        for i, contact in enumerate(contacts, 1):
            print(format_contact(contact, i))
            print()


def cmd_create_list(args: argparse.Namespace) -> None:
    """Create a HubSpot list from query results."""
    service = OutreachService()

    # Get contacts based on query type
    if args.query == "dormant":
        contacts = service.get_dormant_contacts(limit=args.limit)
    elif args.query == "closed-lost":
        contacts = service.get_closed_lost(limit=args.limit)
    elif args.query == "churned":
        contacts = service.get_churned_customers(limit=args.limit)
    else:
        print(f"Unknown query type: {args.query}")
        sys.exit(1)

    if not contacts:
        print("No contacts found matching criteria.")
        sys.exit(1)

    # Create the list
    result = service.create_campaign_list(contacts, args.name)
    list_id = result.get("listId") or result.get("id")

    print(f"\nCreated list '{args.name}' with {len(contacts)} contacts")
    print(f"List ID: {list_id}")


def cmd_campaign_list(args: argparse.Namespace) -> None:
    """Create a HubSpot list from campaign criteria."""
    service = OutreachService()

    print(f"\nCreating campaign list...")
    print(f"  Campaign Type: {args.campaign_type}")
    print(f"  Vertical: {args.vertical or 'All'}")
    print(f"  Persona: {args.persona or 'All'}")
    print(f"  Limit: {args.limit}")

    result = service.create_campaign_list_from_filters(
        name=args.name,
        campaign_type=args.campaign_type,
        vertical=args.vertical,
        persona=args.persona,
        limit=args.limit,
    )

    if result.get("error"):
        print(f"\nError: {result['error']}")
        sys.exit(1)

    list_id = result.get("listId") or result.get("id")
    count = result.get("contact_count", 0)

    print(f"\n✓ Created list '{args.name}'")
    print(f"  Contacts: {count}")
    print(f"  List ID: {list_id}")
    print(f"\nView in HubSpot: https://app.hubspot.com/contacts/lists/{list_id}")


def cmd_recommend(args: argparse.Namespace) -> None:
    """Recommend best segments for a campaign type."""
    # Persona scores from HubSpot data
    personas = [
        {"id": "coo_ops", "label": "COO/VP Ops", "replyRate": 0.60, "conversionScore": 7.2, "priority": 1},
        {"id": "cfo", "label": "CFO/Finance", "replyRate": 0.50, "conversionScore": 9.3, "priority": 2},
        {"id": "cto", "label": "CTO/VP Engineering", "replyRate": 0.35, "conversionScore": 11.7, "priority": 3},
        {"id": "ceo", "label": "CEO/Founder", "replyRate": 0.29, "conversionScore": 5.8, "priority": 4},
        {"id": "vp_ops", "label": "VP/Director Ops", "replyRate": 0.33, "conversionScore": 8.1, "priority": 5},
    ]

    # Calculate combined score
    for p in personas:
        p["score"] = (p["replyRate"] * 40) + (min(p["conversionScore"] * 8, 100) * 0.4) + ((6 - p["priority"]) / 5 * 20)

    # Sort by score
    personas.sort(key=lambda x: -x["score"])

    print(f"\n{'='*60}")
    print(f"RECOMMENDED SEGMENTS FOR: {args.campaign_type.upper().replace('_', ' ')}")
    print(f"{'='*60}")

    print("\nTop Personas (by response likelihood):\n")
    for i, p in enumerate(personas[:3], 1):
        print(f"  {i}. {p['label']}")
        print(f"     Reply Rate: {p['replyRate']*100:.0f}% | Conversion: {p['conversionScore']:.1f}x | Score: {p['score']:.0f}/100")
        print()

    # Generate CLI command
    best = personas[0]
    print(f"\nQuick Create Command:")
    print(f"  python -m outreach_intel.cli campaign-list \\")
    print(f"    --campaign-type {args.campaign_type} \\")
    print(f"    --persona {best['id']} \\")
    print(f"    --limit 100 \\")
    print(f'    "Campaign - {best["label"]} - {args.campaign_type.replace("_", " ").title()}"')


def cmd_tam(args: argparse.Namespace) -> None:
    """Extract and analyze total addressable market."""
    verticals = args.verticals.split(",") if args.verticals else None
    personas = args.personas.split(",") if args.personas else None

    report = extract_tam(
        verticals=verticals,
        personas=personas,
        count_only=args.count_only,
    )

    if args.json:
        output = {
            "total": report.total,
            "wave_eligible": report.wave_eligible,
            "by_vertical": report.by_vertical,
            "by_persona": report.by_persona,
            "by_outreach_status": report.by_outreach_status,
        }
        print(json.dumps(output, indent=2))
    else:
        print(f"\n{'='*60}")
        print(f"TOTAL ADDRESSABLE MARKET: {report.total:,} contacts")
        print(f"Wave Eligible: {report.wave_eligible:,}")
        print(f"{'='*60}")

        if report.by_vertical:
            print(f"\nBy Vertical:")
            for v, count in report.by_vertical.items():
                pct = count / report.total * 100 if report.total else 0
                print(f"  {v:<25} {count:>6,}  ({pct:.1f}%)")

        if report.by_persona:
            print(f"\nBy Persona:")
            for p, count in report.by_persona.items():
                pct = count / report.total * 100 if report.total else 0
                print(f"  {p:<25} {count:>6,}  ({pct:.1f}%)")

        if report.by_outreach_status:
            print(f"\nBy Outreach Status:")
            for s, count in report.by_outreach_status.items():
                print(f"  {s:<25} {count:>6,}")


def cmd_tam_waves(args: argparse.Namespace) -> None:
    """Calculate wave schedule for TAM coverage."""
    verticals = args.verticals.split(",") if args.verticals else None
    personas = args.personas.split(",") if args.personas else None

    report = extract_tam(verticals=verticals, personas=personas)
    schedule = calculate_waves(
        tam_size=report.wave_eligible,
        wave_size=args.wave_size,
        cycle_days=args.cycle_days,
    )

    if "error" in schedule:
        print(f"Error: {schedule['error']}")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"WAVE SCHEDULE")
    print(f"{'='*60}")
    print(f"  TAM (wave eligible): {schedule['tam_size']:,}")
    print(f"  Wave size:           {schedule['wave_size']:,}")
    print(f"  Cycle length:        {schedule['cycle_days']} days")
    print(f"  Total waves:         {schedule['total_waves']}")
    print(f"  Days between waves:  {schedule['days_between_waves']}")
    print(f"\nInfrastructure:")
    print(f"  Emails per wave:     {schedule['emails_per_wave']:,} (2 per contact)")
    print(f"  Emails per cycle:    {schedule['emails_per_cycle']:,}")
    print(f"  Inboxes needed:      {schedule['inboxes_needed']}")
    print(f"  Domains needed:      {schedule['domains_needed']}")


def cmd_signal_review(args: argparse.Namespace) -> None:
    """Review top contacts with Claude signal analysis."""
    from outreach_intel.signal_agent import review_scored_contacts

    service = OutreachService()

    # Get contacts based on query type
    if args.query == "dormant":
        contacts = service.get_dormant_contacts(limit=args.limit)
    elif args.query == "closed-lost":
        contacts = service.get_closed_lost(limit=args.limit)
    elif args.query == "churned":
        contacts = service.get_churned_customers(limit=args.limit)
    else:
        print(f"Unknown query type: {args.query}")
        sys.exit(1)

    if not contacts:
        print("No contacts found.")
        sys.exit(1)

    model = getattr(args, "model", None)
    provider = "gemini" if model == "gemini" else "claude" if model == "claude" else None
    print(f"\nScored {len(contacts)} contacts. Running signal review ({provider or 'default'})...\n")

    reviews = review_scored_contacts(contacts, limit=args.review_limit, model_provider=provider)

    if args.json:
        from dataclasses import asdict
        output = [asdict(r) for r in reviews]
        print(json.dumps(output, indent=2))
    else:
        print(f"{'='*60}")
        print(f"SIGNAL REVIEW ({len(reviews)} contacts)")
        print(f"{'='*60}\n")
        for i, r in enumerate(reviews, 1):
            match = next((c for c in contacts if c.contact_id == r.contact_id), None)
            name = match.name if match else r.contact_id
            company = match.company if match else ""

            print(f"{i}. {name} ({company})")
            print(f"   Score: {r.original_score:.0f} -> {r.adjusted_score:.0f} [{r.confidence}]")
            print(f"   {r.reasoning}")
            print(f"   Action: {r.recommended_action}")
            print()


def cmd_signal_enrich(args: argparse.Namespace) -> None:
    """Enrich top contacts with external signal tools + Claude."""
    from outreach_intel.signal_agent import enrich_scored_contacts

    service = OutreachService()

    if args.query == "dormant":
        contacts = service.get_dormant_contacts(limit=args.limit)
    elif args.query == "closed-lost":
        contacts = service.get_closed_lost(limit=args.limit)
    elif args.query == "churned":
        contacts = service.get_churned_customers(limit=args.limit)
    else:
        print(f"Unknown query type: {args.query}")
        sys.exit(1)

    if not contacts:
        print("No contacts found.")
        sys.exit(1)

    model = getattr(args, "model", None)
    provider = "gemini" if model == "gemini" else "claude" if model == "claude" else None
    print(f"\nScored {len(contacts)} contacts. Running signal enrichment ({provider or 'default'}, this takes a few minutes)...\n")

    reviews = enrich_scored_contacts(contacts, limit=args.review_limit, model_provider=provider)

    if args.json:
        from dataclasses import asdict
        output = [asdict(r) for r in reviews]
        print(json.dumps(output, indent=2))
    else:
        print(f"{'='*60}")
        print(f"ENRICHED SIGNAL REVIEW ({len(reviews)} contacts)")
        print(f"{'='*60}\n")
        for i, r in enumerate(reviews, 1):
            match = next((c for c in contacts if c.contact_id == r.contact_id), None)
            name = match.name if match else r.contact_id
            company = match.company if match else ""

            print(f"{i}. {name} ({company})")
            print(f"   Score: {r.original_score:.0f} -> {r.adjusted_score:.0f} [{r.confidence}]")
            print(f"   {r.reasoning}")
            print(f"   Action: {r.recommended_action}")
            print()


def cmd_signal_team(args: argparse.Namespace) -> None:
    """Run full multi-agent team analysis on top contacts."""
    from outreach_intel.signal_team import run_signal_team

    service = OutreachService()

    if args.query == "dormant":
        contacts = service.get_dormant_contacts(limit=args.limit)
    elif args.query == "closed-lost":
        contacts = service.get_closed_lost(limit=args.limit)
    elif args.query == "churned":
        contacts = service.get_churned_customers(limit=args.limit)
    else:
        print(f"Unknown query type: {args.query}")
        sys.exit(1)

    if not contacts:
        print("No contacts found.")
        sys.exit(1)

    model = getattr(args, "model", None)
    provider = "gemini" if model == "gemini" else "claude" if model == "claude" else None
    print(f"\nScored {len(contacts)} contacts. Running multi-agent team ({provider or 'default'}, this takes 5-8 minutes)...\n")

    from dataclasses import asdict
    contact_dicts = [asdict(c) for c in contacts]
    reviews = run_signal_team(contact_dicts, limit=args.review_limit, model_provider=provider)

    if args.json:
        output = [asdict(r) for r in reviews]
        print(json.dumps(output, indent=2))
    else:
        print(f"{'='*60}")
        print(f"TEAM SIGNAL ANALYSIS ({len(reviews)} contacts)")
        print(f"{'='*60}\n")
        for i, r in enumerate(reviews, 1):
            match = next((c for c in contacts if c.contact_id == r.contact_id), None)
            name = match.name if match else r.contact_id
            company = match.company if match else ""

            print(f"{i}. {name} ({company})")
            print(f"   Score: {r.original_score:.0f} -> {r.adjusted_score:.0f} [{r.confidence}]")
            print(f"   {r.reasoning}")
            print(f"   Action: {r.recommended_action}")
            print()


def cmd_enrich(args: argparse.Namespace) -> None:
    """Enrich a CSV with Apollo (email finding + firmographics)."""
    from outreach_intel.enrichment import EnrichmentService

    service = EnrichmentService()

    output = args.output or args.csv.replace(".csv", "_enriched.csv")
    print(f"\nEnriching {args.csv} via Apollo...\n")

    results = service.enrich_from_csv(args.csv, output)
    print(f"Enriched {len(results)} contacts -> {output}")

    credits = sum(r.credits_used for r in results)
    print(f"Apollo credits used: {credits}")

    if args.sync_hubspot:
        from outreach_intel.hubspot_client import HubSpotClient
        hs = HubSpotClient()
        print("\nSyncing enrichment data to HubSpot...")
        synced = 0
        for result in results:
            if result.person and result.person.email:
                contact = hs.get_contact_by_email(result.person.email)
                if contact:
                    service.sync_to_hubspot(result, contact["id"], hs)
                    synced += 1
        print(f"Synced {synced} contacts to HubSpot")


def cmd_enrich_contact(args: argparse.Namespace) -> None:
    """Single contact enrichment lookup."""
    from outreach_intel.enrichment import EnrichmentService

    service = EnrichmentService()
    result = service.enrich_contact(
        email=args.email,
        first_name=args.first_name,
        last_name=args.last_name,
        company=args.company,
    )

    if result.person:
        p = result.person
        print(f"\nPerson:")
        if p.email:
            conf = f" ({p.email_confidence:.0%})" if p.email_confidence else ""
            print(f"  Email: {p.email}{conf}")
        if p.title:
            print(f"  Title: {p.title}")
        if p.linkedin_url:
            print(f"  LinkedIn: {p.linkedin_url}")

    if result.company:
        c = result.company
        print(f"\nCompany: {c.name}")
        if c.industry:
            print(f"  Industry: {c.industry}")
        if c.employee_count:
            print(f"  Employees: {c.employee_count:,}")
        if c.revenue:
            print(f"  Revenue: {c.revenue}")
        if c.tech_stack:
            print(f"  Tech Stack: {', '.join(c.tech_stack[:10])}")

    if result.hiring_signals:
        print(f"\nHiring ({len(result.hiring_signals)} open roles):")
        for h in result.hiring_signals[:5]:
            print(f"  - {h.job_title}")

    print(f"\nCredits used: {result.credits_used}")


def cmd_hiring_signals(args: argparse.Namespace) -> None:
    """Check company hiring signals."""
    from outreach_intel.signal_tools import check_company_hiring

    print(f"\nChecking hiring signals for {args.domain}...\n")
    result = check_company_hiring(args.domain)
    print(result)


def cmd_score_inbound(args: argparse.Namespace) -> None:
    """Score a single inbound contact with form data + Apollo enrichment."""
    from outreach_intel.scorer import ContactScorer, FORM_PROPERTIES
    from outreach_intel.hubspot_client import HubSpotClient
    from outreach_intel.enrichment import EnrichmentService

    hs = HubSpotClient()
    scorer = ContactScorer()

    # Look up contact
    if args.email:
        contact = hs.get_contact_by_email(
            args.email,
            properties=[
                "firstname", "lastname", "email", "jobtitle", "company",
                "lifecyclestage", "hs_lead_status",
                "hs_email_last_open_date", "hs_email_last_click_date",
                "notes_last_updated",
            ] + FORM_PROPERTIES,
        )
        if not contact:
            print(f"No contact found for {args.email}")
            sys.exit(1)
    elif args.contact_id:
        contact = hs.get_contact(
            args.contact_id,
            properties=[
                "firstname", "lastname", "email", "jobtitle", "company",
                "lifecyclestage", "hs_lead_status",
                "hs_email_last_open_date", "hs_email_last_click_date",
                "notes_last_updated",
            ] + FORM_PROPERTIES,
        )
    else:
        print("Provide --email or --contact-id")
        sys.exit(1)

    props = contact.get("properties", {})
    name = f"{props.get('firstname', '')} {props.get('lastname', '')}".strip()

    # Step 1: Score
    print(f"\n{'='*60}")
    print(f"INBOUND LEAD SCORING: {name}")
    print(f"{'='*60}")

    scored = scorer.score_contact(contact)

    print(f"\n  Form Fit:        {scored.form_fit_score:.0f}/100")
    print(f"  Engagement:      {scored.engagement_score:.0f}/100")
    print(f"  Timing:          {scored.timing_score:.0f}/100")
    print(f"  Deal Context:    {scored.deal_context_score:.0f}/100")
    print(f"  External Trigger:{scored.external_trigger_score:.0f}/100")
    print(f"  {'─'*25}")
    print(f"  TOTAL:           {scored.total_score:.1f}/100")

    # Show form data
    form_fields = {
        "use_case": "Use Case",
        "how_many_loans_do_you_close_per_year": "Loan Volume",
        "how_many_applications_do_you_see_per_year_": "App Volume",
        "job_function_contact": "Job Function",
        "which_of_these_best_describes_your_job_title_": "Role",
        "message": "Comments",
        "hs_analytics_first_referrer": "Referring Page",
    }
    has_form = False
    for prop, label in form_fields.items():
        value = props.get(prop)
        if value:
            if not has_form:
                print(f"\n  Form Submission Data:")
                has_form = True
            print(f"    {label}: {value}")

    # Step 2: Apollo enrichment
    if not args.skip_enrich:
        print(f"\n  Enriching via Apollo...")
        svc = EnrichmentService()
        result = svc.enrich_contact(
            email=props.get("email"),
            first_name=props.get("firstname"),
            last_name=props.get("lastname"),
            company=props.get("company"),
        )

        if result.company:
            c = result.company
            print(f"\n  Apollo Company Data:")
            if c.employee_count:
                print(f"    Employees: {c.employee_count:,}")
            if c.revenue:
                print(f"    Revenue: {c.revenue}")
            if c.industry:
                print(f"    Industry: {c.industry}")
            if c.tech_stack:
                print(f"    Tech Stack: {', '.join(c.tech_stack[:8])}")

            # Mismatch detection
            vol_str = (
                props.get("how_many_loans_do_you_close_per_year")
                or props.get("how_many_applications_do_you_see_per_year_")
                or ""
            )
            from outreach_intel.scorer import parse_volume_range
            low, _ = parse_volume_range(vol_str)
            if low >= 10_000 and c.employee_count and c.employee_count < 50:
                print(f"\n  *** MISMATCH DETECTED ***")
                print(f"  Self-reported volume: {vol_str}")
                print(f"  Apollo employee count: {c.employee_count}")
                print(f"  Signal: High-volume operation with lean team — likely platform/tech play")

        if result.hiring_signals:
            print(f"\n  Hiring ({len(result.hiring_signals)} open roles):")
            for h in result.hiring_signals[:5]:
                print(f"    - {h.job_title}")

        print(f"\n  Apollo credits used: {result.credits_used}")

    # Step 3: AI agent reasoning (optional)
    if args.agent:
        from outreach_intel.signal_agent import enrich_contacts
        from dataclasses import asdict

        print(f"\n  Running AI agent ({args.model})...")
        contact_dict = asdict(scored)
        reviews = enrich_contacts([contact_dict], limit=1, model_provider=args.model)
        if reviews:
            r = reviews[0]
            print(f"\n  AI Assessment:")
            print(f"    Adjusted Score: {r.adjusted_score:.0f} [{r.confidence}]")
            print(f"    {r.reasoning}")
            print(f"    Action: {r.recommended_action}")

    print()


def cmd_wave_build(args: argparse.Namespace) -> None:
    """Build a wave of contacts for Smartlead."""
    verticals = args.verticals.split(",") if args.verticals else None
    personas = args.personas.split(",") if args.personas else None

    build_wave(
        wave_size=args.size,
        angle=args.angle,
        verticals=verticals,
        personas=personas,
        list_name=args.name,
        dry_run=args.dry_run,
    )


def cmd_wave_status(args: argparse.Namespace) -> None:
    """Show current wave cycling status."""
    status = get_wave_status()

    print(f"\n{'='*60}")
    print(f"WAVE CYCLING STATUS")
    print(f"{'='*60}")

    print(f"\nContacts by Outreach Status:")
    for s, count in status["by_status"].items():
        print(f"  {s:<20} {count:>6}")

    print(f"\nWave Eligibility:")
    print(f"  Never contacted:    {status['never_contacted']}")
    print(f"  Ready to recycle:   {status['ready_to_recycle']} (>{status['cycle_days']}d since last wave)")

    print(f"\nAvailable Angles:")
    for a in status["available_angles"]:
        print(f"  - {a}")


def main(argv: Optional[list[str]] = None) -> None:
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Truv Outreach Intelligence - HubSpot campaign tool"
    )
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Dormant contacts command
    dormant_parser = subparsers.add_parser(
        "dormant", help="Get dormant contacts for outreach"
    )
    dormant_parser.add_argument(
        "-l", "--limit", type=int, default=25, help="Number of contacts"
    )
    dormant_parser.add_argument(
        "-i", "--industry", help="Filter by industry/vertical"
    )
    dormant_parser.add_argument(
        "--json", action="store_true", help="Output as JSON"
    )
    dormant_parser.set_defaults(func=cmd_dormant)

    # Closed-lost command
    cl_parser = subparsers.add_parser(
        "closed-lost", help="Get closed-lost contacts for re-engagement"
    )
    cl_parser.add_argument(
        "-l", "--limit", type=int, default=25, help="Number of contacts"
    )
    cl_parser.add_argument(
        "-i", "--industry", help="Filter by industry/vertical"
    )
    cl_parser.add_argument(
        "--json", action="store_true", help="Output as JSON"
    )
    cl_parser.set_defaults(func=cmd_closed_lost)

    # Churned command
    churned_parser = subparsers.add_parser(
        "churned", help="Get churned customers for win-back"
    )
    churned_parser.add_argument(
        "-l", "--limit", type=int, default=25, help="Number of contacts"
    )
    churned_parser.add_argument(
        "--json", action="store_true", help="Output as JSON"
    )
    churned_parser.set_defaults(func=cmd_churned)

    # Create list command
    list_parser = subparsers.add_parser(
        "create-list", help="Create HubSpot list from query"
    )
    list_parser.add_argument(
        "query", choices=["dormant", "closed-lost", "churned"],
        help="Query type to use"
    )
    list_parser.add_argument(
        "name", help="Name for the new list"
    )
    list_parser.add_argument(
        "-l", "--limit", type=int, default=50, help="Number of contacts"
    )
    list_parser.set_defaults(func=cmd_create_list)

    # Campaign list command (with persona/vertical filters)
    campaign_parser = subparsers.add_parser(
        "campaign-list", help="Create HubSpot list from campaign criteria"
    )
    campaign_parser.add_argument(
        "name", help="Name for the new list"
    )
    campaign_parser.add_argument(
        "-t", "--campaign-type",
        choices=["closed_loss", "vertical", "persona", "product", "case_study"],
        default="closed_loss",
        help="Campaign type"
    )
    campaign_parser.add_argument(
        "-v", "--vertical", help="Vertical/industry filter"
    )
    campaign_parser.add_argument(
        "-p", "--persona",
        choices=["coo_ops", "cfo", "cto", "ceo", "vp_ops"],
        help="Persona filter"
    )
    campaign_parser.add_argument(
        "-l", "--limit", type=int, default=100, help="Number of contacts"
    )
    campaign_parser.set_defaults(func=cmd_campaign_list)

    # Recommend command
    recommend_parser = subparsers.add_parser(
        "recommend", help="Get recommended segments for a campaign type"
    )
    recommend_parser.add_argument(
        "campaign_type",
        choices=["closed_loss", "vertical", "persona", "product", "case_study"],
        help="Campaign type to get recommendations for"
    )
    recommend_parser.set_defaults(func=cmd_recommend)

    # Signal review command (Flow A)
    signal_parser = subparsers.add_parser(
        "signal-review", help="AI-powered signal review of scored contacts"
    )
    signal_parser.add_argument(
        "query", choices=["dormant", "closed-lost", "churned"],
        help="Query type to score and review"
    )
    signal_parser.add_argument(
        "-l", "--limit", type=int, default=50,
        help="Contacts to pull from HubSpot"
    )
    signal_parser.add_argument(
        "-r", "--review-limit", type=int, default=25,
        help="Max contacts to send to Claude for review"
    )
    signal_parser.add_argument(
        "--json", action="store_true", help="Output as JSON"
    )
    signal_parser.add_argument(
        "-m", "--model", choices=["gemini", "claude"], default="gemini",
        help="LLM provider (default: gemini)"
    )
    signal_parser.set_defaults(func=cmd_signal_review)

    # Signal enrich command (Flow B)
    enrich_parser = subparsers.add_parser(
        "signal-enrich", help="AI-powered signal enrichment with external tools"
    )
    enrich_parser.add_argument(
        "query", choices=["dormant", "closed-lost", "churned"],
        help="Query type to score and enrich"
    )
    enrich_parser.add_argument(
        "-l", "--limit", type=int, default=25,
        help="Contacts to pull from HubSpot"
    )
    enrich_parser.add_argument(
        "-r", "--review-limit", type=int, default=10,
        help="Max contacts to enrich (higher cost per contact)"
    )
    enrich_parser.add_argument(
        "--json", action="store_true", help="Output as JSON"
    )
    enrich_parser.add_argument(
        "-m", "--model", choices=["gemini", "claude"], default="gemini",
        help="LLM provider (default: gemini)"
    )
    enrich_parser.set_defaults(func=cmd_signal_enrich)

    # Signal team command (Flow C)
    team_parser = subparsers.add_parser(
        "signal-team", help="Multi-agent team signal analysis (comprehensive, higher cost)"
    )
    team_parser.add_argument(
        "query", choices=["dormant", "closed-lost", "churned"],
        help="Query type to analyze"
    )
    team_parser.add_argument(
        "-l", "--limit", type=int, default=25,
        help="Contacts to pull from HubSpot"
    )
    team_parser.add_argument(
        "-r", "--review-limit", type=int, default=5,
        help="Max contacts to run through the team (keep small)"
    )
    team_parser.add_argument(
        "--json", action="store_true", help="Output as JSON"
    )
    team_parser.add_argument(
        "-m", "--model", choices=["gemini", "claude"], default="gemini",
        help="LLM provider (default: gemini)"
    )
    team_parser.set_defaults(func=cmd_signal_team)

    # TAM command
    tam_parser = subparsers.add_parser(
        "tam", help="Extract and analyze total addressable market"
    )
    tam_parser.add_argument(
        "-v", "--verticals", help="Comma-separated verticals (e.g. mortgage,fintech)"
    )
    tam_parser.add_argument(
        "-p", "--personas", help="Comma-separated personas (e.g. coo_ops,cfo)"
    )
    tam_parser.add_argument(
        "--json", action="store_true", help="Output as JSON"
    )
    tam_parser.add_argument(
        "--count-only", action="store_true",
        help="Fast mode: only return counts, don't fetch full contact records"
    )
    tam_parser.set_defaults(func=cmd_tam)

    # TAM waves command
    tam_waves_parser = subparsers.add_parser(
        "tam-waves", help="Calculate wave schedule for TAM coverage"
    )
    tam_waves_parser.add_argument(
        "--wave-size", type=int, default=2500, help="Contacts per wave (default: 2500)"
    )
    tam_waves_parser.add_argument(
        "--cycle-days", type=int, default=45, help="Days to complete full cycle (default: 45)"
    )
    tam_waves_parser.add_argument(
        "-v", "--verticals", help="Comma-separated verticals"
    )
    tam_waves_parser.add_argument(
        "-p", "--personas", help="Comma-separated personas"
    )
    tam_waves_parser.set_defaults(func=cmd_tam_waves)

    # Wave build command
    wave_build_parser = subparsers.add_parser(
        "wave-build", help="Build a wave of contacts for the next Smartlead campaign"
    )
    wave_build_parser.add_argument(
        "--size", type=int, default=2500, help="Max contacts in this wave (default: 2500)"
    )
    wave_build_parser.add_argument(
        "--angle", default="encompass-integration",
        help=f"Email angle ({', '.join(AVAILABLE_ANGLES)})"
    )
    wave_build_parser.add_argument(
        "--name", help="HubSpot list name (auto-generated if not provided)"
    )
    wave_build_parser.add_argument(
        "-v", "--verticals", help="Comma-separated verticals"
    )
    wave_build_parser.add_argument(
        "-p", "--personas", help="Comma-separated personas"
    )
    wave_build_parser.add_argument(
        "--dry-run", action="store_true", help="Preview without creating list"
    )
    wave_build_parser.set_defaults(func=cmd_wave_build)

    # Wave status command
    wave_status_parser = subparsers.add_parser(
        "wave-status", help="Show current wave cycling status"
    )
    wave_status_parser.set_defaults(func=cmd_wave_status)

    # Enrich CSV command
    enrich_csv_parser = subparsers.add_parser(
        "enrich", help="Enrich a CSV with Apollo (email finding + firmographics)"
    )
    enrich_csv_parser.add_argument("csv", help="Input CSV file path")
    enrich_csv_parser.add_argument(
        "-o", "--output", help="Output CSV path (default: input_enriched.csv)"
    )
    enrich_csv_parser.add_argument(
        "--sync-hubspot", action="store_true",
        help="Write enrichment data back to HubSpot contacts"
    )
    enrich_csv_parser.set_defaults(func=cmd_enrich)

    # Enrich single contact command
    enrich_contact_parser = subparsers.add_parser(
        "enrich-contact", help="Enrich a single contact via Apollo"
    )
    enrich_contact_parser.add_argument(
        "--email", help="Contact email address"
    )
    enrich_contact_parser.add_argument(
        "--first-name", help="Contact first name"
    )
    enrich_contact_parser.add_argument(
        "--last-name", help="Contact last name"
    )
    enrich_contact_parser.add_argument(
        "--company", help="Company name or domain"
    )
    enrich_contact_parser.set_defaults(func=cmd_enrich_contact)

    # Hiring signals command
    hiring_parser = subparsers.add_parser(
        "hiring-signals", help="Check company hiring signals via Apollo"
    )
    hiring_parser.add_argument(
        "--domain", required=True, help="Company domain (e.g. acmefinancial.com)"
    )
    hiring_parser.set_defaults(func=cmd_hiring_signals)

    # Score inbound command
    inbound_parser = subparsers.add_parser(
        "score-inbound", help="Score a single inbound lead with form data + Apollo"
    )
    inbound_parser.add_argument("--email", help="Contact email address")
    inbound_parser.add_argument("--contact-id", help="HubSpot contact ID")
    inbound_parser.add_argument(
        "--skip-enrich", action="store_true", help="Skip Apollo enrichment"
    )
    inbound_parser.add_argument(
        "--agent", action="store_true", help="Run AI agent reasoning after scoring"
    )
    inbound_parser.add_argument(
        "-m", "--model", choices=["gemini", "claude"], default="gemini",
        help="LLM provider for agent (default: gemini)"
    )
    inbound_parser.set_defaults(func=cmd_score_inbound)

    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
