"""Slack notification for scored leads."""

import logging
from datetime import datetime

import requests

from truv_scout.models import PipelineResult
from truv_scout.settings import get_settings

logger = logging.getLogger(__name__)

ROI_PROPERTIES = [
    "roi_funded_loans", "roi_annual_savings", "roi_savings_per_loan",
    "roi_current_cost", "roi_truv_cost", "roi_manual_reduction_pct",
    "roi_los_system", "roi_pos_system", "roi_use_case", "roi_pdf_downloaded",
]


def _fetch_roi_data(contact_id: str) -> dict:
    """Fetch ROI calculator properties from HubSpot for a contact."""
    try:
        from outreach_intel.hubspot_client import HubSpotClient
        hs = HubSpotClient()
        resp = hs.get(f"/crm/v3/objects/contacts/{contact_id}", params={"properties": ",".join(ROI_PROPERTIES)})
        return resp.get("properties", {})
    except Exception:
        return {}


def _fmt_dollar(val: str | None) -> str:
    """Format a string number as $X,XXX."""
    if not val:
        return "—"
    try:
        return f"${int(float(val)):,}"
    except (ValueError, TypeError):
        return val


def _fmt_num(val: str | None) -> str:
    """Format a string number with commas."""
    if not val:
        return "—"
    try:
        return f"{int(float(val)):,}"
    except (ValueError, TypeError):
        return val


# Webhook URLs by source pipeline
WEBHOOK_BY_SOURCE = {
    "roi_calculator": "SLACK_ROI_WEBHOOK_URL",  # #roi-calculator
}


def notify_slack(result: PipelineResult, source: str = "") -> bool:
    """Post a scored lead notification to the appropriate Slack channel.

    Routes to source-specific webhook if configured,
    falls back to default SLACK_WEBHOOK_URL (#outreach-intelligence).

    Args:
        result: Pipeline result with all scoring data.
        source: Pipeline source for webhook routing.

    Returns:
        True if message posted successfully, False otherwise.
    """
    # Pick webhook: source-specific if available, otherwise default
    s = get_settings()
    if source == "roi_calculator" and s.slack_roi_webhook_url:
        webhook_url = s.slack_roi_webhook_url
    else:
        webhook_url = s.slack_webhook_url

    if not webhook_url:
        return False

    tech_matches = []
    if result.decision and result.decision.tech_matches:
        for category, matches in result.decision.tech_matches.items():
            if matches:
                tech_matches.append(f"{category}: {', '.join(matches)}")

    enrichment_line = ""
    if result.enrichment:
        parts = []
        if result.enrichment.company_name:
            parts.append(result.enrichment.company_name)
        if result.enrichment.employee_count:
            parts.append(f"{result.enrichment.employee_count:,} employees")
        if result.enrichment.industry:
            parts.append(result.enrichment.industry)
        if parts:
            enrichment_line = " | ".join(parts)

    tier_emoji = {"hot": "🔥", "warm": "🟡", "cold": "🔵"}.get(result.final_tier, "⚪")

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{tier_emoji} Scout Score: {result.final_score:.0f} — {result.final_tier.upper()}",
            },
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Contact:*\n<https://app.hubspot.com/contacts/{s.hubspot_portal_id}/contact/{result.contact_id}|{result.contact_name or result.contact_id}>"},
                {"type": "mrkdwn", "text": f"*Company:*\n{result.company_name or 'Unknown'}"},
                {"type": "mrkdwn", "text": f"*Routing:*\n{result.final_routing}"},
                {"type": "mrkdwn", "text": f"*Confidence:*\n{result.confidence}"},
            ],
        },
    ]

    # Add ROI calculator data if this is an ROI lead
    if source == "roi_calculator":
        roi_data = _fetch_roi_data(result.contact_id)
        if roi_data:
            blocks.append({"type": "divider"})
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": "*📊 ROI Calculator Inputs*"},
            })
            blocks.append({
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Funded Loans:*\n{_fmt_num(roi_data.get('roi_funded_loans'))}/yr"},
                    {"type": "mrkdwn", "text": f"*Current Cost:*\n{_fmt_dollar(roi_data.get('roi_current_cost'))}"},
                    {"type": "mrkdwn", "text": f"*Truv Cost:*\n{_fmt_dollar(roi_data.get('roi_truv_cost'))}"},
                    {"type": "mrkdwn", "text": f"*Annual Savings:*\n{_fmt_dollar(roi_data.get('roi_annual_savings'))}"},
                ],
            })
            pdf_downloaded = roi_data.get('roi_pdf_downloaded', 'false')
            pdf_icon = "✅" if pdf_downloaded == "true" else "❌"
            blocks.append({
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Savings/Loan:*\n{_fmt_dollar(roi_data.get('roi_savings_per_loan'))}"},
                    {"type": "mrkdwn", "text": f"*TWN Reduction:*\n{roi_data.get('roi_manual_reduction_pct', '—')}%"},
                    {"type": "mrkdwn", "text": f"*LOS:*\n{roi_data.get('roi_los_system', '—')}"},
                    {"type": "mrkdwn", "text": f"*PDF Downloaded:*\n{pdf_icon} {pdf_downloaded}"},
                ],
            })
            blocks.append({"type": "divider"})

    blocks.append({
        "type": "section",
        "text": {"type": "mrkdwn", "text": f"*Score Breakdown:*\nForm: {result.form_fit_score:.0f} | Eng: {result.engagement_score:.0f} | Time: {result.timing_score:.0f} | Deal: {result.deal_context_score:.0f} | Ext: {result.external_trigger_score:.0f}"},
    })

    if enrichment_line:
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Enrichment:* {enrichment_line}"},
        })

    if tech_matches:
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Tech Stack Matches:*\n{chr(10).join(tech_matches)}"},
        })

    if result.reasoning:
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Reasoning:*\n{result.reasoning}"},
        })

    if result.recommended_action:
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Recommended Action:*\n{result.recommended_action}"},
        })

    try:
        resp = requests.post(webhook_url, json={"blocks": blocks}, timeout=10)
        return resp.status_code == 200
    except Exception:
        logger.exception(f"[slack] Failed to post notification for {result.contact_id}")
        return False


def post_closed_lost_digest(results: list[PipelineResult]) -> bool:
    """Post a closed-lost re-engagement digest to #outreach-intelligence.

    Only includes hot and warm contacts. Each entry links directly to the
    HubSpot contact record for easy cherry-picking.

    Args:
        results: All scored PipelineResult objects from the batch run.

    Returns:
        True if message posted successfully, False otherwise.
    """
    s = get_settings()
    webhook_url = s.slack_webhook_url
    if not webhook_url:
        return False

    # Filter to hot/warm only, sorted by score descending
    actionable = sorted(
        [r for r in results if r.final_tier in ("hot", "warm")],
        key=lambda r: r.final_score,
        reverse=True,
    )

    today = datetime.now().strftime("%a %b %-d")
    total_scored = len(results)

    header_text = f"🔍 Closed-Lost Re-engagement Digest — {today}"
    if not actionable:
        body_text = f"Scored {total_scored} contacts. None met hot/warm threshold."
    else:
        body_text = f"Scored {total_scored} contacts. *{len(actionable)} worth a look:*"

    blocks = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": header_text},
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": body_text},
        },
    ]

    tier_emoji = {"hot": "🔥", "warm": "♨️"}

    for i, result in enumerate(actionable[:20], 1):
        emoji = tier_emoji.get(result.final_tier, "⚪")
        hubspot_url = f"https://app.hubspot.com/contacts/{s.hubspot_portal_id}/contact/{result.contact_id}"

        tech = ""
        if result.decision and result.decision.tech_matches:
            all_matches = []
            for matches in result.decision.tech_matches.values():
                all_matches.extend(matches)
            if all_matches:
                tech = f" — {'/'.join(all_matches[:3])}"

        company = result.enrichment.company_name if result.enrichment and result.enrichment.company_name else "Unknown Co."

        line = (
            f"{i}. {emoji} *{company}* — Score: {result.final_score:.0f}"
            f" — {result.final_routing.title()}{tech}\n"
            f"   <{hubspot_url}|View in HubSpot>"
        )

        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": line},
        })

    blocks.append({
        "type": "context",
        "elements": [
            {
                "type": "mrkdwn",
                "text": "To enroll: `python -m truv_scout.cli score-closed-lost --dry-run` → then enroll via Smartlead CLI",
            }
        ],
    })

    try:
        resp = requests.post(webhook_url, json={"blocks": blocks}, timeout=10)
        return resp.status_code == 200
    except Exception:
        logger.exception("[slack] Failed to post closed-lost digest")
        return False
