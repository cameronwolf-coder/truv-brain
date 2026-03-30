"""Handle SmartLead webhook events (reply, completion, bounce, unsubscribe).

Replaces the Pipedream smartlead-event-handler workflow.
"""

import logging

import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from truv_scout.settings import get_settings

logger = logging.getLogger(__name__)

SMARTLEAD_API_URL = "https://server.smartlead.ai/api/v1"

STATUS_MAP = {
    "REPLY": "engaged",
    "COMPLETED": "exhausted",
    "BOUNCE": "bounced",
    "UNSUBSCRIBE": "unsubscribed",
}


def handle_smartlead_event(event: dict) -> dict:
    """Process a SmartLead webhook event.

    Updates HubSpot outreach_status, pauses sequence on reply,
    and sends Slack notification.

    Returns summary dict for the API response.
    """
    event_type = (event.get("event_type") or "").upper()
    lead_email = event.get("lead_email") or event.get("email") or ""
    campaign_id = event.get("campaign_id") or ""
    campaign_name = event.get("campaign_name") or ""
    sequence_number = event.get("sequence_number") or 0
    reply_text = event.get("reply_text") or ""

    if not lead_email:
        return {"skipped": True, "reason": "no lead_email"}

    new_status = STATUS_MAP.get(event_type)
    if not new_status:
        return {"skipped": True, "reason": f"unhandled event type: {event_type}"}

    # Find HubSpot contact
    contact_id, contact_props = _find_hubspot_contact(lead_email)
    if not contact_id:
        return {"skipped": True, "reason": f"no HubSpot contact for {lead_email}"}

    # Update HubSpot outreach_status
    update_props = {"outreach_status": new_status}
    if event_type == "COMPLETED":
        update_props["content_track_stage"] = ""
    _update_hubspot_contact(contact_id, update_props)

    # Pause SmartLead sequence on reply
    sequence_paused = False
    if event_type == "REPLY" and campaign_id:
        sequence_paused = _pause_smartlead_sequence(campaign_id, lead_email)

    # Slack notification
    contact_name = f"{contact_props.get('firstname', '')} {contact_props.get('lastname', '')}".strip()
    _notify_slack(
        event_type=event_type,
        new_status=new_status,
        contact_id=contact_id,
        contact_name=contact_name,
        contact_email=lead_email,
        company_name=contact_props.get("company", ""),
        campaign_name=campaign_name,
        sequence_number=sequence_number,
        sequence_paused=sequence_paused,
        reply_text=reply_text,
    )

    return {
        "processed": True,
        "event_type": event_type,
        "new_status": new_status,
        "contact_id": contact_id,
        "sequence_paused": sequence_paused,
    }


def _find_hubspot_contact(email: str) -> tuple[str | None, dict]:
    """Search HubSpot for a contact by email. Returns (id, properties)."""
    token = get_settings().hubspot_api_token
    if not token:
        return None, {}

    try:
        resp = requests.post(
            "https://api.hubapi.com/crm/v3/objects/contacts/search",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                "filterGroups": [{"filters": [
                    {"propertyName": "email", "operator": "EQ", "value": email}
                ]}],
                "properties": [
                    "email", "firstname", "lastname", "company",
                    "outreach_status", "content_track", "lifecyclestage",
                ],
            },
            timeout=10,
        )
        data = resp.json()
        results = data.get("results", [])
        if results:
            return results[0]["id"], results[0].get("properties", {})
    except Exception as e:
        logger.error(f"HubSpot search failed for {email}: {e}")

    return None, {}


def _update_hubspot_contact(contact_id: str, properties: dict) -> None:
    """PATCH contact properties on HubSpot."""
    token = get_settings().hubspot_api_token
    if not token:
        return
    try:
        requests.patch(
            f"https://api.hubapi.com/crm/v3/objects/contacts/{contact_id}",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"properties": properties},
            timeout=10,
        )
    except Exception as e:
        logger.error(f"HubSpot update failed for {contact_id}: {e}")


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((requests.exceptions.ConnectionError, requests.exceptions.Timeout)),
    reraise=True,
)
def _pause_smartlead_sequence(campaign_id: str, email: str) -> bool:
    """Pause a lead's sequence in SmartLead. Retries on transient errors."""
    api_key = get_settings().smartlead_api_key
    if not api_key:
        logger.error("SMARTLEAD_API_KEY not set — cannot pause sequence")
        return False

    try:
        resp = requests.post(
            f"{SMARTLEAD_API_URL}/campaigns/{campaign_id}/leads",
            params={"api_key": api_key},
            json={"lead_list": [{"email": email, "status": "PAUSED"}]},
            timeout=10,
        )
        if resp.ok:
            logger.info(f"SmartLead sequence paused for {email} in campaign {campaign_id}")
            return True
        logger.error(f"SmartLead pause failed: {resp.status_code} {resp.text}")
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
        raise  # Let tenacity retry
    except Exception as e:
        logger.error(f"SmartLead pause error for {email}: {e}")
    return False


def _notify_slack(
    event_type: str,
    new_status: str,
    contact_id: str,
    contact_name: str,
    contact_email: str,
    company_name: str,
    campaign_name: str,
    sequence_number: int,
    sequence_paused: bool,
    reply_text: str,
) -> None:
    """Post event notification to Slack."""
    s = get_settings()
    webhook_url = s.slack_webhook_url
    if not webhook_url:
        return

    hubspot_url = f"https://app.hubspot.com/contacts/{s.hubspot_portal_id}/contact/{contact_id}"
    display_name = contact_name or contact_email

    if event_type == "REPLY":
        preview = f"\n> {reply_text[:200]}{'...' if len(reply_text) > 200 else ''}" if reply_text else ""
        pause_label = "paused" if sequence_paused else "pause failed"
        text = "\n".join(filter(None, [
            f"\U0001f4e9 *Reply received* from *{display_name}* ({company_name})",
            f"Campaign: {campaign_name} | Email #{sequence_number}",
            f"Status: outreach_status -> *engaged* (sequence {pause_label})",
            preview,
            f"<{hubspot_url}|View in HubSpot>",
        ]))
    elif event_type == "COMPLETED":
        text = "\n".join([
            f"\u2705 *Sequence complete* for *{display_name}* ({company_name})",
            f"Campaign: {campaign_name}",
            f"Status: outreach_status -> *exhausted* (graduated to marketing lane)",
            f"<{hubspot_url}|View in HubSpot>",
        ])
    elif event_type == "BOUNCE":
        text = "\n".join([
            f"\u26a0\ufe0f *Bounce* for {contact_email} ({company_name})",
            f"Campaign: {campaign_name}",
            f"Status: outreach_status -> *bounced*",
        ])
    elif event_type == "UNSUBSCRIBE":
        text = "\n".join([
            f"\U0001f6ab *Unsubscribe* from {display_name} ({company_name})",
            f"Campaign: {campaign_name}",
            f"Status: outreach_status -> *unsubscribed*",
        ])
    else:
        text = f"SmartLead event: {event_type} for {contact_email}"

    try:
        requests.post(webhook_url, json={"text": text}, timeout=5)
    except Exception as e:
        logger.error(f"Slack notification failed: {e}")
