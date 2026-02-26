"""Push a HubSpot static list to Knock as an Audience.

Usage:
    python -m outreach_intel.knock_audience push <hubspot_list_id> [--audience-key KEY]
    python -m outreach_intel.knock_audience info <audience_key>

How it works:
    1. Pulls all contacts from the HubSpot static list
    2. Adds them as members to a Knock Audience (auto-creates if needed)
    3. Audience key defaults to a slug of the HubSpot list name

The Knock Audiences API inline-identifies users when adding members,
so no separate bulk identify step is needed.
"""

import argparse
import math
import os
import re
import time
from typing import Any

import requests
from dotenv import load_dotenv

from .hubspot_client import HubSpotClient

load_dotenv()

KNOCK_API_URL = "https://api.knock.app/v1"


class KnockAudienceClient:
    """Client for managing Knock Audiences."""

    def __init__(self, token: str | None = None):
        self.token = token or os.getenv("KNOCK_SERVICE_TOKEN")
        if not self.token:
            raise ValueError(
                "Knock service token required. Set KNOCK_SERVICE_TOKEN env var."
            )
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def _request(self, method: str, path: str, json_data: dict | None = None) -> Any:
        url = f"{KNOCK_API_URL}{path}"
        resp = requests.request(method, url, headers=self.headers, json=json_data)
        resp.raise_for_status()
        if resp.status_code == 204 or not resp.content:
            return {}
        return resp.json()

    def add_members(self, audience_key: str, members: list[dict]) -> None:
        """Add members to an audience. Each member is {"user": {"id", "email", "name", ...}}.

        Auto-creates the audience if it doesn't exist.
        Auto-identifies users inline.
        """
        self._request(
            "POST",
            f"/audiences/{audience_key}/members",
            {"members": members},
        )

    def remove_members(self, audience_key: str, members: list[dict]) -> None:
        """Remove members from an audience."""
        self._request(
            "DELETE",
            f"/audiences/{audience_key}/members",
            {"members": members},
        )

    def get_members(self, audience_key: str, limit: int = 25, after: str | None = None) -> dict:
        """Get audience members (paginated)."""
        path = f"/audiences/{audience_key}/members?limit={limit}"
        if after:
            path += f"&after={after}"
        return self._request("GET", path)

    def get_all_members(self, audience_key: str) -> list[dict]:
        """Get all audience members (handles pagination)."""
        entries = []
        after = None
        while True:
            resp = self.get_members(audience_key, limit=25, after=after)
            entries.extend(resp.get("entries", []))
            after = resp.get("page_info", {}).get("after")
            if not after:
                break
        return entries


def fetch_hubspot_list_contacts(list_id: str) -> list[dict]:
    """Pull all contacts from a HubSpot static list."""
    hs = HubSpotClient()
    properties = [
        "firstname", "lastname", "email", "jobtitle", "company",
        "lifecyclestage", "industry", "sales_vertical",
    ]

    # Step 1: Get member record IDs from list membership endpoint
    print(f"Fetching member IDs from HubSpot list {list_id}...", flush=True)
    member_ids: list[str] = []
    after = None
    while True:
        params: dict[str, Any] = {"limit": 100}
        if after:
            params["after"] = after
        resp = hs.get(f"/crm/v3/lists/{list_id}/memberships/join-order", params=params)
        records = resp.get("results", [])
        for r in records:
            rid = r.get("recordId") if isinstance(r, dict) else str(r)
            member_ids.append(str(rid))
        after = resp.get("paging", {}).get("next", {}).get("after")
        if len(member_ids) % 500 == 0 and member_ids:
            print(f"  {len(member_ids)} member IDs...", flush=True)
        if not after or not records:
            break

    print(f"  Found {len(member_ids)} members", flush=True)

    # Step 2: Batch read full contact records
    print(f"  Batch reading contact details...", flush=True)
    all_contacts: list[dict] = []
    for i in range(0, len(member_ids), 100):
        batch = member_ids[i:i+100]
        contacts = hs.batch_get_contacts(batch, properties=properties)
        all_contacts.extend(contacts)
        if (i + 100) % 500 == 0:
            print(f"  Read {len(all_contacts)} contacts...", flush=True)
        time.sleep(0.1)

    print(f"  Total: {len(all_contacts)} contacts with properties", flush=True)
    return all_contacts


def get_hubspot_list_name(list_id: str) -> str:
    """Get the name of a HubSpot list by ID."""
    hs = HubSpotClient()
    try:
        list_info = hs.get(f"/crm/v3/lists/{list_id}")
        return list_info.get("list", {}).get("name", f"HubSpot List {list_id}")
    except Exception:
        return f"HubSpot List {list_id}"


def slugify(name: str) -> str:
    """Convert a name to a URL-safe slug."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def push_to_knock(
    hubspot_list_id: str,
    audience_key: str | None = None,
) -> dict:
    """Push a HubSpot list to Knock as an audience.

    Returns dict with audience_key and user_count.
    """
    knock = KnockAudienceClient()

    # 1. Get list name and derive audience key
    list_name = get_hubspot_list_name(hubspot_list_id)
    key = audience_key or slugify(list_name)
    print(f"Audience key: {key}", flush=True)
    print(f"Source: {list_name} (HubSpot list {hubspot_list_id})", flush=True)

    # 2. Fetch contacts from HubSpot
    contacts = fetch_hubspot_list_contacts(hubspot_list_id)
    if not contacts:
        print("No contacts found in list.")
        return {"audience_key": key, "user_count": 0}

    # 3. Prepare Knock audience members (inline identification)
    members = []
    for c in contacts:
        props = c.get("properties", {})
        email = props.get("email")
        if not email:
            continue

        first = props.get("firstname") or ""
        last = props.get("lastname") or ""
        name = f"{first} {last}".strip()

        members.append({
            "user": {
                "id": email,
                "email": email,
                "name": name or None,
                "company": props.get("company"),
                "title": props.get("jobtitle"),
                "hubspot_contact_id": c["id"],
            }
        })

    print(f"\nPrepared {len(members)} members", flush=True)

    # 4. Add members in batches of 100
    total_batches = math.ceil(len(members) / 100)
    print(f"Adding to audience '{key}' ({total_batches} batches)...", flush=True)

    added = 0
    for i in range(0, len(members), 100):
        batch = members[i:i+100]
        knock.add_members(key, batch)
        added += len(batch)
        if (i // 100 + 1) % 5 == 0 or added == len(members):
            print(f"  Added {added}/{len(members)}", flush=True)
        time.sleep(0.3)

    print(f"\n{'='*70}")
    print(f"DONE! Audience synced to Knock.")
    print(f"  Audience key:  {key}")
    print(f"  Users added:   {added}")
    print(f"  Source list:   {list_name} (ID: {hubspot_list_id})")
    print(f"{'='*70}")

    return {"audience_key": key, "user_count": added}


def main():
    parser = argparse.ArgumentParser(description="Manage Knock audiences from HubSpot lists")
    sub = parser.add_subparsers(dest="command", required=True)

    # push
    push_cmd = sub.add_parser("push", help="Push a HubSpot list to Knock as an audience")
    push_cmd.add_argument("list_id", help="HubSpot static list ID")
    push_cmd.add_argument("--audience-key", help="Custom audience key (default: slug of list name)")

    # info
    info_cmd = sub.add_parser("info", help="Show audience details and member count")
    info_cmd.add_argument("audience_key", help="Audience key")

    args = parser.parse_args()
    knock = KnockAudienceClient()

    if args.command == "push":
        push_to_knock(args.list_id, args.audience_key)

    elif args.command == "info":
        resp = knock.get_members(args.audience_key, limit=25)
        total = resp.get("page_info", {}).get("total_count", 0)
        entries = resp.get("entries", [])
        print(f"Audience: {args.audience_key}")
        print(f"  Total members: {total}")
        if entries:
            print(f"\n  Sample members:")
            for m in entries[:10]:
                u = m.get("user", {})
                print(f"    {u.get('name', '—')} <{u.get('email', '—')}>")


if __name__ == "__main__":
    main()
