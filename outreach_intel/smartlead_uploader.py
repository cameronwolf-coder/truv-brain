"""Push HubSpot contacts to Smartlead campaigns and sync outreach_status back.

Usage:
    python -m outreach_intel.smartlead_uploader push <hubspot_list_id> <campaign_id> [--clay-csv PATH] [--dry-run]
    python -m outreach_intel.smartlead_uploader status <campaign_id>

How it works:
    push:   Pulls contacts from HubSpot list (or Clay CSV) -> adds as Smartlead leads
            -> marks outreach_status = "active" on HubSpot contacts
    status: Shows campaign info and lead count from Smartlead
"""

import argparse
import csv
import math
import os
import time
from typing import Any

import requests
from dotenv import load_dotenv

from .hubspot_client import HubSpotClient
from .knock_audience import fetch_hubspot_list_contacts

load_dotenv()

SMARTLEAD_API_URL = "https://server.smartlead.ai/api/v1"


class SmartleadClient:
    """Client for managing Smartlead campaigns and leads."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("SMARTLEAD_API_KEY")
        if not self.api_key:
            raise ValueError(
                "Smartlead API key required. Set SMARTLEAD_API_KEY env var."
            )

    def _request(self, method: str, path: str, json_data: dict | None = None) -> Any:
        url = f"{SMARTLEAD_API_URL}{path}"
        params = {"api_key": self.api_key}
        resp = requests.request(method, url, params=params, json=json_data)
        resp.raise_for_status()
        if resp.status_code == 204 or not resp.content:
            return {}
        return resp.json()

    def add_leads(self, campaign_id: str, leads: list[dict]) -> Any:
        """Add leads to a campaign.

        Each lead: {"email": ..., "first_name": ..., "last_name": ...,
                    "company": ..., "title": ..., "custom_fields": {...}}
        """
        return self._request(
            "POST",
            f"/campaigns/{campaign_id}/leads",
            {"lead_list": leads},
        )

    def get_campaign(self, campaign_id: str) -> dict:
        """Get campaign details."""
        return self._request("GET", f"/campaigns/{campaign_id}")

    def list_leads(self, campaign_id: str, offset: int = 0, limit: int = 100) -> Any:
        """List leads in a campaign (paginated)."""
        url = f"{SMARTLEAD_API_URL}/campaigns/{campaign_id}/leads"
        params = {"api_key": self.api_key, "offset": offset, "limit": limit}
        resp = requests.get(url, params=params)
        resp.raise_for_status()
        if resp.status_code == 204 or not resp.content:
            return {}
        return resp.json()


def mark_outreach_status(contact_ids: list[str], status: str) -> int:
    """Set outreach_status on HubSpot contacts.

    Updates in batches of 100. Returns count of updated contacts.
    """
    hs = HubSpotClient()
    updated = 0

    for i in range(0, len(contact_ids), 100):
        batch = contact_ids[i:i + 100]
        inputs = [
            {"id": cid, "properties": {"outreach_status": status}}
            for cid in batch
        ]
        hs.batch_update_contacts(inputs)
        updated += len(batch)
        if (i + 100) % 500 == 0:
            print(f"  Updated {updated} contacts...", flush=True)
        time.sleep(0.1)

    print(f"  Marked {updated} contacts as '{status}' in HubSpot", flush=True)
    return updated


def push_to_smartlead(
    hubspot_list_id: str,
    campaign_id: str,
    clay_csv_path: str | None = None,
    dry_run: bool = False,
) -> dict:
    """Push contacts to a Smartlead campaign.

    Source is either a Clay CSV or a HubSpot list.
    After upload, marks outreach_status = "active" on HubSpot contacts.

    Returns dict with campaign_id and lead_count.
    """
    sl = SmartleadClient()
    leads = []
    contact_ids = []

    if clay_csv_path:
        # Read leads from Clay CSV
        print(f"Reading leads from Clay CSV: {clay_csv_path}", flush=True)
        with open(clay_csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                email = row.get("email", "").strip()
                if not email:
                    continue
                lead: dict[str, Any] = {
                    "email": email,
                    "first_name": row.get("first_name", ""),
                    "last_name": row.get("last_name", ""),
                    "company": row.get("company", ""),
                }
                custom_message = row.get("custom_message", "").strip()
                if custom_message:
                    lead["custom_fields"] = {"custom_message": custom_message}
                leads.append(lead)
        print(f"  Found {len(leads)} leads in CSV", flush=True)
    else:
        # Pull contacts from HubSpot list
        contacts = fetch_hubspot_list_contacts(hubspot_list_id)
        if not contacts:
            print("No contacts found in list.")
            return {"campaign_id": campaign_id, "lead_count": 0}

        for c in contacts:
            props = c.get("properties", {})
            email = props.get("email", "").strip()
            if not email:
                continue
            leads.append({
                "email": email,
                "first_name": props.get("firstname", ""),
                "last_name": props.get("lastname", ""),
                "company_name": props.get("company", ""),
            })
            contact_ids.append(c["id"])
        print(f"\nPrepared {len(leads)} leads from HubSpot", flush=True)

    if not leads:
        print("No valid leads to upload.")
        return {"campaign_id": campaign_id, "lead_count": 0}

    if dry_run:
        print(f"\n[DRY RUN] Would upload {len(leads)} leads to campaign {campaign_id}")
        print(f"  Sample lead: {leads[0]}")
        return {"campaign_id": campaign_id, "lead_count": len(leads)}

    # Upload in batches of 100
    total_batches = math.ceil(len(leads) / 100)
    print(f"Uploading to campaign {campaign_id} ({total_batches} batches)...", flush=True)

    uploaded = 0
    for i in range(0, len(leads), 100):
        batch = leads[i:i + 100]
        sl.add_leads(campaign_id, batch)
        uploaded += len(batch)
        if (i // 100 + 1) % 5 == 0 or uploaded == len(leads):
            print(f"  Uploaded {uploaded}/{len(leads)}", flush=True)
        time.sleep(0.1)

    # Mark outreach_status on HubSpot contacts
    if contact_ids:
        print(f"\nUpdating outreach_status in HubSpot...", flush=True)
        mark_outreach_status(contact_ids, "active")

    print(f"\n{'='*70}")
    print(f"DONE! Leads pushed to Smartlead.")
    print(f"  Campaign ID:   {campaign_id}")
    print(f"  Leads added:   {uploaded}")
    print(f"  Source:         {'Clay CSV' if clay_csv_path else f'HubSpot list {hubspot_list_id}'}")
    print(f"{'='*70}")

    return {"campaign_id": campaign_id, "lead_count": uploaded}


def main():
    parser = argparse.ArgumentParser(description="Push HubSpot contacts to Smartlead campaigns")
    sub = parser.add_subparsers(dest="command", required=True)

    # push
    push_cmd = sub.add_parser("push", help="Push contacts to a Smartlead campaign")
    push_cmd.add_argument("hubspot_list_id", help="HubSpot static list ID")
    push_cmd.add_argument("campaign_id", help="Smartlead campaign ID")
    push_cmd.add_argument("--clay-csv", dest="clay_csv", help="Path to Clay CSV (overrides HubSpot as source)")
    push_cmd.add_argument("--dry-run", action="store_true", help="Show plan without uploading")

    # status
    status_cmd = sub.add_parser("status", help="Show campaign info and lead count")
    status_cmd.add_argument("campaign_id", help="Smartlead campaign ID")

    args = parser.parse_args()
    sl = SmartleadClient()

    if args.command == "push":
        push_to_smartlead(
            hubspot_list_id=args.hubspot_list_id,
            campaign_id=args.campaign_id,
            clay_csv_path=args.clay_csv,
            dry_run=args.dry_run,
        )

    elif args.command == "status":
        campaign = sl.get_campaign(args.campaign_id)
        print(f"Campaign: {campaign.get('name', '—')}")
        print(f"  ID:     {args.campaign_id}")
        print(f"  Status: {campaign.get('status', '—')}")

        leads = sl.list_leads(args.campaign_id, offset=0, limit=1)
        if isinstance(leads, dict):
            total = leads.get("total_count", "—")
        else:
            total = len(leads) if leads else 0
        print(f"  Leads:  {total}")


if __name__ == "__main__":
    main()
