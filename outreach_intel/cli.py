"""Command-line interface for Outreach Intelligence."""
import argparse
import json
import sys
from typing import Optional

from outreach_intel.service import OutreachService
from outreach_intel.scorer import ScoredContact


def format_contact(contact: ScoredContact, rank: int) -> str:
    """Format a scored contact for display."""
    return (
        f"{rank}. {contact.name} ({contact.jobtitle or 'Unknown Title'})\n"
        f"   Company: {contact.company or 'Unknown'}\n"
        f"   Email: {contact.email}\n"
        f"   Score: {contact.total_score:.1f} | "
        f"Stage: {contact.lifecyclestage}\n"
        f"   Breakdown: Engagement={contact.engagement_score:.0f} "
        f"Timing={contact.timing_score:.0f} "
        f"Context={contact.deal_context_score:.0f}"
    )


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

    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
