"""Truv Scout CLI — score, route, and enrich leads from the command line."""

import json
import sys
from dataclasses import asdict
from typing import Optional

import typer

app = typer.Typer(name="truv-scout", help="Self-learning lead scoring agent.")


@app.command()
def score(
    contact_id: str = typer.Argument(..., help="HubSpot contact ID to score"),
    skip_enrichment: bool = typer.Option(False, "--skip-enrichment", help="Skip Apollo enrichment"),
    skip_agent: bool = typer.Option(False, "--skip-agent", help="Skip agent reasoning"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """Score a single lead through the full pipeline."""
    from truv_scout.pipeline import run_pipeline

    result = run_pipeline(
        contact_id=contact_id,
        skip_enrichment=skip_enrichment,
        skip_agent=skip_agent,
    )

    if json_output:
        typer.echo(json.dumps({
            "contact_id": result.contact_id,
            "final_score": result.final_score,
            "base_score": result.base_score,
            "agent_adjustment": result.agent_adjustment,
            "tier": result.final_tier,
            "routing": result.final_routing,
            "confidence": result.confidence,
            "reasoning": result.reasoning,
            "recommended_action": result.recommended_action,
            "form_fit_score": result.form_fit_score,
            "engagement_score": result.engagement_score,
            "timing_score": result.timing_score,
            "deal_context_score": result.deal_context_score,
            "external_trigger_score": result.external_trigger_score,
            "tech_matches": result.decision.tech_matches if result.decision else {},
            "enrichment_error": result.enrichment_error,
            "agent_error": result.agent_error,
        }, indent=2))
        return

    tier_emoji = {"hot": "🔥", "warm": "🟡", "cold": "🔵"}.get(result.final_tier, "⚪")
    typer.echo(f"\n{tier_emoji} Scout Score: {result.final_score:.1f} ({result.final_tier.upper()})")
    typer.echo(f"   Base Score: {result.base_score:.1f} | Adjustment: {result.agent_adjustment:+.1f}")
    typer.echo(f"   Routing: {result.final_routing} | Confidence: {result.confidence}")
    typer.echo(f"\n   Breakdown:")
    typer.echo(f"     Form Fit: {result.form_fit_score:.0f}")
    typer.echo(f"     Engagement: {result.engagement_score:.0f}")
    typer.echo(f"     Timing: {result.timing_score:.0f}")
    typer.echo(f"     Deal Context: {result.deal_context_score:.0f}")
    typer.echo(f"     External: {result.external_trigger_score:.0f}")

    if result.enrichment:
        typer.echo(f"\n   Enrichment:")
        if result.enrichment.company_name:
            typer.echo(f"     Company: {result.enrichment.company_name}")
        if result.enrichment.employee_count:
            typer.echo(f"     Employees: {result.enrichment.employee_count:,}")
        if result.enrichment.los_pos_matches:
            typer.echo(f"     LOS/POS: {', '.join(result.enrichment.los_pos_matches)}")
        if result.enrichment.voi_voe_matches:
            typer.echo(f"     VOI/VOE: {', '.join(result.enrichment.voi_voe_matches)}")
        typer.echo(f"     Tech Intent: {result.enrichment.tech_intent}")

    if result.reasoning:
        typer.echo(f"\n   Reasoning: {result.reasoning}")
    if result.recommended_action:
        typer.echo(f"   Action: {result.recommended_action}")

    if result.enrichment_error:
        typer.echo(f"\n   ⚠ Enrichment error: {result.enrichment_error}")
    if result.agent_error:
        typer.echo(f"   ⚠ Agent error: {result.agent_error}")
    typer.echo()


@app.command()
def score_batch(
    list_id: str = typer.Argument(..., help="HubSpot list ID"),
    limit: int = typer.Option(10, "--limit", "-n", help="Max contacts to score"),
    skip_enrichment: bool = typer.Option(False, "--skip-enrichment"),
    skip_agent: bool = typer.Option(False, "--skip-agent"),
):
    """Score multiple contacts from a HubSpot list."""
    from outreach_intel.hubspot_client import HubSpotClient
    from truv_scout.pipeline import run_pipeline

    client = HubSpotClient()
    contacts = client.get_list_contacts(list_id, limit=limit)

    if not contacts:
        typer.echo(f"No contacts found in list {list_id}")
        raise typer.Exit(1)

    typer.echo(f"Scoring {len(contacts)} contacts from list {list_id}...\n")

    results = []
    for i, contact in enumerate(contacts, 1):
        cid = contact.get("id", "unknown")
        try:
            result = run_pipeline(
                contact_id=cid,
                skip_enrichment=skip_enrichment,
                skip_agent=skip_agent,
            )
            results.append(result)
            tier_emoji = {"hot": "🔥", "warm": "🟡", "cold": "🔵"}.get(result.final_tier, "⚪")
            typer.echo(f"  [{i}/{len(contacts)}] {tier_emoji} {result.final_score:.0f} {result.final_tier:5s} {result.final_routing:15s} {cid}")
        except Exception as e:
            typer.echo(f"  [{i}/{len(contacts)}] ❌ Error: {e} ({cid})")

    # Summary
    if results:
        hot = sum(1 for r in results if r.final_tier == "hot")
        warm = sum(1 for r in results if r.final_tier == "warm")
        cold = sum(1 for r in results if r.final_tier == "cold")
        typer.echo(f"\nSummary: 🔥 {hot} hot | 🟡 {warm} warm | 🔵 {cold} cold")


@app.command()
def route(
    contact_id: str = typer.Argument(..., help="HubSpot contact ID"),
):
    """Classify routing only (no agent, no enrichment)."""
    from truv_scout.pipeline import run_pipeline

    result = run_pipeline(contact_id=contact_id, skip_enrichment=True, skip_agent=True)
    typer.echo(f"Routing: {result.final_routing}")
    typer.echo(f"Tier: {result.final_tier}")
    typer.echo(f"Score: {result.final_score:.1f}")


@app.command()
def enrich(
    email: str = typer.Argument(..., help="Email address to enrich"),
    first_name: str = typer.Option("", "--first-name", "-f"),
    last_name: str = typer.Option("", "--last-name", "-l"),
    company: str = typer.Option("", "--company", "-c"),
    domain: str = typer.Option("", "--domain", "-d"),
):
    """Run filtered Apollo enrichment and show tech stack matches."""
    from truv_scout.tools.apollo import FilteredApolloEnrichment

    apollo = FilteredApolloEnrichment()
    result = apollo.enrich(
        email=email,
        first_name=first_name,
        last_name=last_name,
        company=company,
        domain=domain,
    )

    typer.echo(f"\nEnrichment for {email}:")
    if result.company_name:
        typer.echo(f"  Company: {result.company_name}")
    if result.employee_count:
        typer.echo(f"  Employees: {result.employee_count:,}")
    if result.revenue:
        typer.echo(f"  Revenue: {result.revenue}")
    if result.industry:
        typer.echo(f"  Industry: {result.industry}")
    if result.person_title:
        typer.echo(f"  Title: {result.person_title}")

    typer.echo(f"\n  Tech Intent: {result.tech_intent}")
    if result.los_pos_matches:
        typer.echo(f"  LOS/POS Matches: {', '.join(result.los_pos_matches)}")
    else:
        typer.echo("  LOS/POS Matches: None")
    if result.voi_voe_matches:
        typer.echo(f"  VOI/VOE Matches: {', '.join(result.voi_voe_matches)}")
    else:
        typer.echo("  VOI/VOE Matches: None")

    if result.filtered_hiring:
        typer.echo(f"\n  Relevant Hiring ({len(result.filtered_hiring)} roles):")
        for h in result.filtered_hiring:
            typer.echo(f"    - {h.get('job_title', 'Unknown')}")
    typer.echo()


@app.command()
def search(
    query: str = typer.Argument(..., help="Search query"),
    directory: str = typer.Option("", "--dir", "-d", help="Subdirectory to search"),
):
    """Search the knowledge base."""
    from truv_scout.tools.search import search_knowledge_base

    result = search_knowledge_base(query, directory=directory)
    typer.echo(result)


@app.command(name="eval")
def run_eval():
    """Run test cases through the grader."""
    from truv_scout.evals.grader import run_evaluation

    run_evaluation()


@app.command(name="score-closed-lost")
def score_closed_lost(
    limit: int = typer.Option(50, "--limit", "-n", help="Max contacts to score"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Score but don't write to HubSpot"),
):
    """Batch score stale closed-lost contacts and post Slack digest.

    Targets contacts with lifecycle=closed-lost, outreach_status!=active,
    and deal closed >90 days ago.
    """
    from truv_scout.batch import run_closed_lost_batch
    from truv_scout.slack import post_closed_lost_digest

    typer.echo(f"Fetching stale closed-lost contacts (limit={limit})...")
    results = run_closed_lost_batch(limit=limit, dry_run=dry_run)

    hot = sum(1 for r in results if r.final_tier == "hot")
    warm = sum(1 for r in results if r.final_tier == "warm")
    cold = sum(1 for r in results if r.final_tier == "cold")

    typer.echo(f"Scored {len(results)} contacts: 🔥 {hot} hot | ♨️ {warm} warm | 🔵 {cold} cold")

    if dry_run:
        typer.echo("Dry run — no HubSpot writes performed.")

    post_closed_lost_digest(results)
    typer.echo("Slack digest posted to #outreach-intelligence.")


if __name__ == "__main__":
    app()
