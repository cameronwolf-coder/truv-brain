"""External signal tools for the Agno agent (Flow B: Signal Enricher).

Each function is a plain Python function with a descriptive docstring.
Agno reads the docstring to tell Claude what the tool does and when
to call it. Claude decides which tools to invoke per contact.
"""
import os
from typing import Optional

import requests
from dotenv import load_dotenv

from outreach_intel.hubspot_client import HubSpotClient

load_dotenv()

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")
FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"


def _firecrawl_search(query: str, limit: int = 5) -> list[dict]:
    """Run a Firecrawl web search. Returns list of result dicts."""
    if not FIRECRAWL_API_KEY:
        return [{"title": "No Firecrawl API key configured", "url": ""}]

    resp = requests.post(
        f"{FIRECRAWL_BASE_URL}/search",
        headers={
            "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
            "Content-Type": "application/json",
        },
        json={"query": query, "limit": limit},
        timeout=15,
    )
    if resp.status_code == 200:
        return resp.json().get("data", [])
    return [{"title": f"Search failed ({resp.status_code})", "url": ""}]


def search_company_news(company_name: str) -> str:
    """Search for recent news about a company.

    Use this tool to find hiring announcements, product launches,
    partnerships, regulatory changes, or leadership moves that
    signal buying intent for income/employment verification.

    Args:
        company_name: The company to search for.

    Returns:
        A summary of recent news, or "No recent news found."
    """
    results = _firecrawl_search(f"{company_name} news 2026", limit=5)

    if not results or (len(results) == 1 and "failed" in results[0].get("title", "")):
        return f"No recent news found for {company_name}."

    summaries = []
    for r in results[:5]:
        title = r.get("title", "Untitled")
        url = r.get("url", "")
        description = r.get("description", "")
        summaries.append(f"- {title}: {description} ({url})")

    return f"Recent news for {company_name}:\n" + "\n".join(summaries)


def check_job_changes(person_name: str, company_name: str) -> str:
    """Check if a person has changed jobs or been promoted recently.

    Use this tool to detect title changes, promotions, or new hires
    that indicate expanded budget authority or new decision-making power.

    Args:
        person_name: Full name of the contact.
        company_name: Their current (or last known) company.

    Returns:
        A summary of any job changes found, or "No job changes detected."
    """
    results = _firecrawl_search(
        f'"{person_name}" "{company_name}" promoted OR hired OR appointed 2026',
        limit=3,
    )

    if not results or (len(results) == 1 and "failed" in results[0].get("title", "")):
        return f"No job changes detected for {person_name} at {company_name}."

    summaries = []
    for r in results[:3]:
        title = r.get("title", "Untitled")
        description = r.get("description", "")
        summaries.append(f"- {title}: {description}")

    return f"Job change signals for {person_name}:\n" + "\n".join(summaries)


def enrich_contact_data(
    email: str = "",
    first_name: str = "",
    last_name: str = "",
    company: str = "",
) -> str:
    """Look up firmographic and demographic data for a contact.

    Use this tool when you need company size, revenue, industry,
    tech stack, or a verified email address. Returns structured
    enrichment data from Apollo.

    Args:
        email: Contact email (optional if name + company given).
        first_name: Contact first name.
        last_name: Contact last name.
        company: Company name or domain.

    Returns:
        Formatted enrichment summary with company and person details.
    """
    from outreach_intel.enrichment import EnrichmentService

    try:
        service = EnrichmentService()
        result = service.enrich_contact(
            email=email or None,
            first_name=first_name or None,
            last_name=last_name or None,
            company=company or None,
        )
    except Exception as e:
        return f"Enrichment failed: {e}"

    lines = []
    if result.person:
        p = result.person
        lines.append(f"Person: {first_name} {last_name}")
        if p.email:
            conf = f" ({p.email_confidence:.0%} confidence)" if p.email_confidence else ""
            lines.append(f"  Verified Email: {p.email}{conf}")
        if p.title:
            lines.append(f"  Title: {p.title}")
        if p.seniority:
            lines.append(f"  Seniority: {p.seniority}")
        if p.linkedin_url:
            lines.append(f"  LinkedIn: {p.linkedin_url}")

    if result.company:
        c = result.company
        lines.append(f"Company: {c.name or company}")
        if c.industry:
            lines.append(f"  Industry: {c.industry}")
        if c.employee_count:
            lines.append(f"  Employees: {c.employee_count:,}")
        if c.revenue:
            lines.append(f"  Revenue: {c.revenue}")
        if c.tech_stack:
            lines.append(f"  Tech Stack: {', '.join(c.tech_stack[:10])}")
        if c.funding_total:
            lines.append(f"  Total Funding: ${c.funding_total:,.0f}")
        if c.hq_location:
            lines.append(f"  HQ: {c.hq_location}")

    if result.hiring_signals:
        lines.append(f"Hiring Signals ({len(result.hiring_signals)} open roles):")
        for h in result.hiring_signals[:5]:
            dept = f" [{h.department}]" if h.department else ""
            lines.append(f"  - {h.job_title}{dept}")

    lines.append(f"Credits used: {result.credits_used}")
    return "\n".join(lines) if lines else "No enrichment data found."


def check_company_hiring(company_domain: str) -> str:
    """Check if a company is actively hiring in relevant roles.

    Use this tool to detect hiring-as-buying-signal. Look for lending ops,
    compliance, verification, or engineering roles that indicate the company
    may need income/employment verification solutions.

    Args:
        company_domain: Company website domain (e.g. acmefinancial.com).

    Returns:
        Summary of active job postings, highlighting relevant roles.
    """
    from outreach_intel.enrichment import ApolloClient

    try:
        client = ApolloClient()
        org = client.enrich_organization(company_domain)

        org_id = org.raw.get("id")
        if not org_id:
            return f"No organization found for {company_domain}."

        signals = client.get_job_postings(org_id)
    except Exception as e:
        return f"Hiring check failed: {e}"

    if not signals:
        return f"No active job postings found for {company_domain}."

    lines = [f"Active job postings at {org.name or company_domain} ({len(signals)} roles):"]

    # Highlight lending/compliance/verification roles
    relevant_keywords = ["lend", "verif", "compliance", "underwrite", "mortgage", "loan", "credit"]
    for s in signals:
        title = s.job_title or "Unknown"
        is_relevant = any(kw in title.lower() for kw in relevant_keywords)
        marker = " [RELEVANT]" if is_relevant else ""
        dept = f" [{s.department}]" if s.department else ""
        loc = f" - {s.location}" if s.location else ""
        lines.append(f"  - {title}{dept}{loc}{marker}")

    return "\n".join(lines)


def detect_job_change(
    first_name: str,
    last_name: str,
    known_title: str = "",
    known_company: str = "",
) -> str:
    """Detect if a contact has changed jobs or been promoted.

    Use this tool to find promotions (Director to VP = expanded budget)
    or company moves. Compares current employment against the known
    title and company from HubSpot.

    Args:
        first_name: Contact first name.
        last_name: Contact last name.
        known_title: Their title in HubSpot (last known).
        known_company: Their company in HubSpot (last known).

    Returns:
        Description of any detected job change, or "No changes detected."
    """
    from outreach_intel.enrichment import ApolloClient

    try:
        client = ApolloClient()
        person = client.enrich_person(
            first_name=first_name,
            last_name=last_name,
            company=known_company or None,
        )
    except Exception as e:
        return f"Job change check failed: {e}"

    if not person.employment_history:
        return f"No employment history found for {first_name} {last_name}."

    current = next(
        (e for e in person.employment_history if e.get("current")),
        person.employment_history[0],
    )

    new_title = current.get("title", "")
    new_company = current.get("company", "")

    changes = []

    if known_title and new_title and known_title.lower() != new_title.lower():
        changes.append(f"Title changed from '{known_title}' to '{new_title}'")

    if known_company and new_company and known_company.lower() != new_company.lower():
        changes.append(f"Moved from '{known_company}' to '{new_company}'")

    if not changes:
        return f"No changes detected for {first_name} {last_name}. Current: {new_title} at {new_company}."

    return f"Job change detected for {first_name} {last_name}: " + "; ".join(changes)


def get_form_context(contact_id: str) -> str:
    """Pull form submission data for an inbound lead from HubSpot.

    Use this tool when analyzing an inbound lead to understand their
    self-reported use case, volume, role, and what they're looking for.
    This data comes from their form submission and is critical for
    understanding their actual needs and scale.

    Key signals to look for:
    - Volume vs company size mismatch (high volume + small team = platform play)
    - Use case alignment with Truv's ICP (lending, fintech, HR verification)
    - Seniority level (Director+ = budget authority)
    - Comments mentioning specific pain points (approval, manual process, compliance)

    Args:
        contact_id: HubSpot contact ID.

    Returns:
        Formatted summary of form submission data and qualifying signals.
    """
    from outreach_intel.scorer import FORM_PROPERTIES

    client = HubSpotClient()
    contact = client.get_contact(contact_id, properties=FORM_PROPERTIES)
    props = contact.get("properties", {})

    lines = [f"Form submission data for contact {contact_id}:"]

    field_labels = {
        "use_case": "Use Case",
        "how_many_loans_do_you_close_per_year": "Loan Volume (annual)",
        "how_many_applications_do_you_see_per_year_": "Application Volume (annual)",
        "job_function_contact": "Job Function",
        "which_of_these_best_describes_your_job_title_": "Role Level",
        "how_can_we_help": "How Can We Help",
        "message": "Comments",
        "hs_analytics_first_referrer": "Referring Page",
        "ecarr": "ECARR (existing revenue)",
        "target_account": "Target Account",
    }

    has_data = False
    for prop, label in field_labels.items():
        value = props.get(prop)
        if value:
            lines.append(f"  {label}: {value}")
            has_data = True

    if not has_data:
        return f"No form submission data found for contact {contact_id}. This may be a dormant/outbound contact without a form fill."

    return "\n".join(lines)


def get_hubspot_activity(contact_id: str) -> str:
    """Pull recent CRM activity for a contact from HubSpot.

    Use this tool to check email engagement, last contact dates,
    lifecycle stage, and deal history. Helps determine if a contact
    is re-engaging or still dormant.

    Args:
        contact_id: HubSpot contact ID.

    Returns:
        Formatted summary of CRM activity for the contact.
    """
    client = HubSpotClient()
    contact = client.get_contact(
        contact_id,
        properties=[
            "firstname", "lastname", "email", "jobtitle", "company",
            "lifecyclestage", "hs_lead_status",
            "hs_email_last_open_date", "hs_email_last_click_date",
            "notes_last_updated", "hs_email_sends_since_last_engagement",
        ],
    )

    props = contact.get("properties", {})
    name = f"{props.get('firstname', '')} {props.get('lastname', '')}".strip()

    lines = [
        f"HubSpot activity for {name} (ID: {contact_id}):",
        f"  Email: {props.get('email', 'Unknown')}",
        f"  Title: {props.get('jobtitle', 'Unknown')}",
        f"  Company: {props.get('company', 'Unknown')}",
        f"  Lifecycle Stage: {props.get('lifecyclestage', 'Unknown')}",
        f"  Lead Status: {props.get('hs_lead_status', 'None')}",
        f"  Last Email Open: {props.get('hs_email_last_open_date', 'Never')}",
        f"  Last Email Click: {props.get('hs_email_last_click_date', 'Never')}",
        f"  Last Notes Update: {props.get('notes_last_updated', 'Never')}",
    ]

    # Check for associated deals
    try:
        deals = client.get_contact_deals(contact_id)
        if deals:
            lines.append(f"  Associated Deals: {len(deals)}")
        else:
            lines.append("  Associated Deals: None")
    except Exception:
        lines.append("  Associated Deals: Could not retrieve")

    return "\n".join(lines)
