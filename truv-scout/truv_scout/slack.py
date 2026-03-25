"""Slack notification for scored leads."""

import os
from datetime import datetime

import requests
from dotenv import load_dotenv

from truv_scout.models import PipelineResult

load_dotenv()


def notify_slack(result: PipelineResult) -> bool:
    """Post a scored lead notification to #outreach-intelligence.

    Args:
        result: Pipeline result with all scoring data.

    Returns:
        True if message posted successfully, False otherwise.
    """
    webhook_url = os.getenv("SLACK_WEBHOOK_URL", "")
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
                {"type": "mrkdwn", "text": f"*Contact:*\n<https://app.hubspot.com/contacts/19933594/contact/{result.contact_id}|{result.contact_name or result.contact_id}>"},
                {"type": "mrkdwn", "text": f"*Company:*\n{result.company_name or 'Unknown'}"},
                {"type": "mrkdwn", "text": f"*Routing:*\n{result.final_routing}"},
                {"type": "mrkdwn", "text": f"*Confidence:*\n{result.confidence}"},
            ],
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Score Breakdown:*\nForm: {result.form_fit_score:.0f} | Eng: {result.engagement_score:.0f} | Time: {result.timing_score:.0f} | Deal: {result.deal_context_score:.0f} | Ext: {result.external_trigger_score:.0f}"},
        },
    ]

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

    payload = {"blocks": blocks}

    try:
        resp = requests.post(webhook_url, json=payload, timeout=10)
        return resp.status_code == 200
    except Exception:
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
    webhook_url = os.getenv("SLACK_WEBHOOK_URL", "")
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
        hubspot_url = f"https://app.hubspot.com/contacts/19933594/contact/{result.contact_id}"

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
        return False
