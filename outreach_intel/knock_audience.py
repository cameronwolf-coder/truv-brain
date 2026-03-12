"""Push a HubSpot static list to Knock as an Audience and trigger staged sends.

Usage:
    python -m outreach_intel.knock_audience push <hubspot_list_id> [--audience-key KEY]
    python -m outreach_intel.knock_audience info <audience_key>
    python -m outreach_intel.knock_audience trigger <workflow_key> <audience_key> [--batch-size N] [--delay-seconds N] [--dry-run]

How it works:
    push:    Pulls contacts from HubSpot list → adds as Knock Audience members
    info:    Shows audience member count and sample members
    trigger: Fires a Knock workflow for audience members in staged batches
             with configurable pacing to protect email deliverability
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

    def trigger_workflow(
        self,
        workflow_key: str,
        recipient_ids: list[str],
        data: dict | None = None,
        cancellation_key: str | None = None,
    ) -> dict:
        """Trigger a workflow for a list of recipients (max 1,000 per call)."""
        body: dict[str, Any] = {"recipients": recipient_ids[:1000]}
        if data:
            body["data"] = data
        if cancellation_key:
            body["cancellation_key"] = cancellation_key
        return self._request("POST", f"/workflows/{workflow_key}/trigger", body)


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
    #    Filter out government contacts (domains + industry/vertical)
    GOV_DOMAINS = {".gov", ".mil", ".gc.ca", ".gov.uk", ".govt.nz", ".gov.au", ".state.us"}
    GOV_KEYWORDS = {"government", "public sector", "federal", "state government", "local government"}

    members = []
    gov_skipped = 0
    for c in contacts:
        props = c.get("properties", {})
        email = props.get("email")
        if not email:
            continue

        # Skip government email domains
        email_lower = email.lower()
        domain = email_lower.split("@")[-1] if "@" in email_lower else ""
        is_gov_domain = any(email_lower.endswith(d) for d in GOV_DOMAINS)
        is_state_domain = re.match(r".*\.state\.[a-z]{2}\.us$", domain)
        if is_gov_domain or is_state_domain:
            gov_skipped += 1
            continue

        # Skip government industry/vertical
        industry = (props.get("industry") or "").lower()
        vertical = (props.get("sales_vertical") or "").lower()
        if any(kw in industry or kw in vertical for kw in GOV_KEYWORDS):
            gov_skipped += 1
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

    if gov_skipped:
        print(f"\n  Filtered out {gov_skipped} government contacts", flush=True)
    print(f"Prepared {len(members)} members", flush=True)

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


FORCE_ALLOWED_AUDIENCES = {"cameron-test-audience"}


def staged_trigger(
    workflow_key: str,
    audience_key: str,
    batch_size: int = 500,
    delay_seconds: int = 60,
    data: dict | None = None,
    dry_run: bool = False,
    force: bool = False,
) -> dict:
    """Trigger a Knock workflow for audience members in staged batches.

    Paces sends to protect email deliverability for large audiences.
    Default: 500 recipients per batch, 60s between batches (~30k/hour).

    Args:
        workflow_key: Knock workflow to trigger
        audience_key: Knock audience to pull recipients from
        batch_size: Recipients per batch (max 1,000)
        delay_seconds: Seconds to wait between batches
        data: Optional workflow trigger data
        dry_run: If True, show plan without triggering
        force: If True, skip cancellation key to allow re-sends
                (only allowed for audiences in FORCE_ALLOWED_AUDIENCES)

    Returns:
        dict with total_triggered and batch_count
    """
    if force and audience_key not in FORCE_ALLOWED_AUDIENCES:
        print(f"ERROR: --force is only allowed for test audiences: {FORCE_ALLOWED_AUDIENCES}")
        print(f"  Audience '{audience_key}' is not in the allow list.")
        return {"total_triggered": 0, "batch_count": 0}

    knock = KnockAudienceClient()
    batch_size = min(batch_size, 1000)

    # 1. Get all audience members
    print(f"Fetching audience members for '{audience_key}'...", flush=True)
    members = knock.get_all_members(audience_key)
    recipient_ids = [m["user_id"] for m in members]
    total = len(recipient_ids)

    if not recipient_ids:
        print("No members found in audience.")
        return {"total_triggered": 0, "batch_count": 0}

    total_batches = math.ceil(total / batch_size)
    est_minutes = (total_batches - 1) * delay_seconds / 60

    print(f"\nStaged send plan:")
    print(f"  Workflow:      {workflow_key}")
    print(f"  Audience:      {audience_key}")
    print(f"  Recipients:    {total}")
    print(f"  Batch size:    {batch_size}")
    print(f"  Batches:       {total_batches}")
    print(f"  Delay:         {delay_seconds}s between batches")
    print(f"  Est. duration: {est_minutes:.0f} minutes")
    if data:
        print(f"  Trigger data:  {data}")

    if force:
        print(f"  FORCE MODE: cancellation keys disabled (re-send allowed)")

    if dry_run:
        print(f"\n[DRY RUN] No workflows triggered.")
        return {"total_triggered": 0, "batch_count": 0}

    # 2. Trigger in batches
    triggered = 0
    for i in range(0, total, batch_size):
        batch_num = i // batch_size + 1
        batch = recipient_ids[i:i + batch_size]

        print(f"\n  Batch {batch_num}/{total_batches}: triggering {len(batch)} recipients...", flush=True)
        try:
            cancel_key = None if force else f"{workflow_key}:{audience_key}:batch-{batch_num}"
            result = knock.trigger_workflow(workflow_key, batch, data=data, cancellation_key=cancel_key)
            triggered += len(batch)
            run_id = result.get("workflow_run_id", "—")
            print(f"    OK (run: {run_id})", flush=True)
        except requests.HTTPError as e:
            print(f"    ERROR: {e}", flush=True)
            print(f"    Stopping staged send to prevent partial delivery.", flush=True)
            break

        # Wait between batches (skip delay after last batch)
        if batch_num < total_batches:
            print(f"    Waiting {delay_seconds}s before next batch...", flush=True)
            time.sleep(delay_seconds)

    print(f"\n{'='*70}")
    print(f"Staged send complete.")
    print(f"  Triggered: {triggered}/{total} recipients")
    print(f"  Batches:   {math.ceil(triggered / batch_size)}/{total_batches}")
    print(f"{'='*70}")

    return {"total_triggered": triggered, "batch_count": math.ceil(triggered / batch_size)}


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

    # trigger
    trigger_cmd = sub.add_parser("trigger", help="Trigger a workflow for audience members with staged pacing")
    trigger_cmd.add_argument("workflow_key", help="Knock workflow key to trigger")
    trigger_cmd.add_argument("audience_key", help="Knock audience key")
    trigger_cmd.add_argument("--batch-size", type=int, default=500, help="Recipients per batch (default: 500, max: 1000)")
    trigger_cmd.add_argument("--delay-seconds", type=int, default=60, help="Seconds between batches (default: 60)")
    trigger_cmd.add_argument("--data-file", help="JSON file with workflow trigger data")
    trigger_cmd.add_argument("--dry-run", action="store_true", help="Show plan without triggering")
    trigger_cmd.add_argument("--force", action="store_true", help="Skip cancellation key to allow re-sends (test audiences only)")

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

    elif args.command == "trigger":
        trigger_data = None
        if args.data_file:
            import json as _json
            with open(args.data_file) as f:
                trigger_data = _json.load(f)
        staged_trigger(
            workflow_key=args.workflow_key,
            audience_key=args.audience_key,
            batch_size=args.batch_size,
            delay_seconds=args.delay_seconds,
            data=trigger_data,
            dry_run=args.dry_run,
            force=args.force,
        )


if __name__ == "__main__":
    main()
