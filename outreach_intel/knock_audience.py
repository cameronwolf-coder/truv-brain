"""Push a HubSpot static list to Knock as an Audience (Object + Subscriptions).

Usage:
    python -m outreach_intel.knock_audience push <hubspot_list_id> [--audience-key KEY]
    python -m outreach_intel.knock_audience list
    python -m outreach_intel.knock_audience info <audience_key>
    python -m outreach_intel.knock_audience delete <audience_key>

How it works:
    1. Pulls all contacts from the HubSpot static list
    2. Bulk identifies them as Knock users (email, name, company, title)
    3. Creates a Knock Object in the "audiences" collection
    4. Subscribes all users to that object

Once subscribed, you can trigger any Knock workflow for the audience object
and all subscribers will receive it:

    POST /v1/workflows/{workflow_key}/trigger
    { "recipients": [{"collection": "audiences", "id": "<audience_key>"}] }
"""

import argparse
import math
import os
import time
from typing import Any

import requests
from dotenv import load_dotenv

from .hubspot_client import HubSpotClient

load_dotenv()

KNOCK_API_URL = "https://api.knock.app/v1"
KNOCK_COLLECTION = "audiences"


class KnockAudienceClient:
    """Client for managing Knock audiences via Objects + Subscriptions."""

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

    # ── Users ─────────────────────────────────────────────────────────

    def bulk_identify_users(self, users: list[dict]) -> dict:
        """Identify up to 1,000 users in one call. Returns BulkOperation."""
        return self._request("POST", "/users/bulk/identify", {"users": users})

    def wait_for_bulk_op(self, op_id: str, timeout: int = 120) -> dict:
        """Poll a bulk operation until complete or timeout."""
        start = time.time()
        while time.time() - start < timeout:
            op = self._request("GET", f"/bulk_operations/{op_id}")
            status = op.get("status")
            if status == "completed":
                return op
            if status == "failed":
                raise RuntimeError(f"Bulk operation {op_id} failed: {op}")
            time.sleep(2)
        raise TimeoutError(f"Bulk operation {op_id} timed out after {timeout}s")

    # ── Audience Objects ──────────────────────────────────────────────

    def create_audience(self, key: str, name: str, metadata: dict | None = None) -> dict:
        """Create or update an audience object."""
        data = {"name": name, **(metadata or {})}
        return self._request("PUT", f"/objects/{KNOCK_COLLECTION}/{key}", data)

    def get_audience(self, key: str) -> dict:
        return self._request("GET", f"/objects/{KNOCK_COLLECTION}/{key}")

    def list_audiences(self) -> list[dict]:
        entries = []
        after = None
        while True:
            path = f"/objects/{KNOCK_COLLECTION}?page_size=50"
            if after:
                path += f"&after={after}"
            resp = self._request("GET", path)
            entries.extend(resp.get("entries", []))
            after = resp.get("page_info", {}).get("after")
            if not after:
                break
        return entries

    def delete_audience(self, key: str) -> None:
        self._request("DELETE", f"/objects/{KNOCK_COLLECTION}/{key}")

    # ── Subscriptions ─────────────────────────────────────────────────

    def add_subscribers(self, audience_key: str, user_ids: list[str]) -> list[dict]:
        """Subscribe users to an audience. Max ~100 per call for reliability."""
        return self._request(
            "POST",
            f"/objects/{KNOCK_COLLECTION}/{audience_key}/subscriptions",
            {"recipients": user_ids},
        )

    def get_subscribers(self, audience_key: str) -> list[dict]:
        entries = []
        after = None
        while True:
            path = f"/objects/{KNOCK_COLLECTION}/{audience_key}/subscriptions?page_size=50"
            if after:
                path += f"&after={after}"
            resp = self._request("GET", path)
            entries.extend(resp.get("entries", []))
            after = resp.get("page_info", {}).get("after")
            if not after:
                break
        return entries

    def remove_subscribers(self, audience_key: str, user_ids: list[str]) -> None:
        self._request(
            "DELETE",
            f"/objects/{KNOCK_COLLECTION}/{audience_key}/subscriptions",
            {"recipients": user_ids},
        )


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


def push_to_knock(
    hubspot_list_id: str,
    audience_key: str | None = None,
) -> dict:
    """Push a HubSpot list to Knock as an audience.

    Returns dict with audience_key, user_count, and audience URL info.
    """
    knock = KnockAudienceClient()

    # 1. Fetch contacts from HubSpot
    contacts = fetch_hubspot_list_contacts(hubspot_list_id)
    if not contacts:
        print("No contacts found in list.")
        return {"audience_key": None, "user_count": 0}

    # 2. Prepare Knock users
    knock_users = []
    for c in contacts:
        props = c.get("properties", {})
        email = props.get("email")
        if not email:
            continue

        first = props.get("firstname") or ""
        last = props.get("lastname") or ""
        name = f"{first} {last}".strip()

        knock_users.append({
            "id": f"hs-{c['id']}",
            "email": email,
            "name": name or None,
            "company": props.get("company"),
            "title": props.get("jobtitle"),
            "hubspot_contact_id": c["id"],
            "lifecycle_stage": props.get("lifecyclestage"),
            "industry": props.get("industry"),
        })

    print(f"\nPrepared {len(knock_users)} users for Knock", flush=True)

    # 3. Bulk identify users in batches of 1,000
    total_batches = math.ceil(len(knock_users) / 1000)
    print(f"Bulk identifying users ({total_batches} batches)...", flush=True)

    bulk_ops = []
    for i in range(0, len(knock_users), 1000):
        batch = knock_users[i:i+1000]
        op = knock.bulk_identify_users(batch)
        bulk_ops.append(op["id"])
        print(f"  Batch {i//1000 + 1}/{total_batches}: {len(batch)} users (op: {op['id'][:8]}...)", flush=True)
        time.sleep(0.5)

    # Wait for all bulk ops to complete
    print("Waiting for bulk identify to complete...", flush=True)
    for op_id in bulk_ops:
        result = knock.wait_for_bulk_op(op_id)
        print(f"  Op {op_id[:8]}...: {result['success_count']} ok, {result['error_count']} errors", flush=True)

    # 4. Create/update audience object — key and name mirror HubSpot list name
    hs = HubSpotClient()
    try:
        list_info = hs.get(f"/crm/v3/lists/{hubspot_list_id}")
        list_name = list_info.get("list", {}).get("name", f"HubSpot List {hubspot_list_id}")
    except Exception:
        list_name = f"HubSpot List {hubspot_list_id}"

    if audience_key:
        key = audience_key
    else:
        # Slugify the HubSpot list name to use as the Knock audience key
        import re
        key = re.sub(r"[^a-z0-9]+", "-", list_name.lower()).strip("-")

    print(f"\nCreating audience: {key} ({list_name})", flush=True)
    knock.create_audience(key, list_name, {
        "source": "hubspot",
        "hubspot_list_id": hubspot_list_id,
        "contact_count": len(knock_users),
        "synced_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })

    # 5. Subscribe users in batches of 100
    user_ids = [u["id"] for u in knock_users]
    total_sub_batches = math.ceil(len(user_ids) / 100)
    print(f"Subscribing {len(user_ids)} users ({total_sub_batches} batches)...", flush=True)

    subscribed = 0
    for i in range(0, len(user_ids), 100):
        batch = user_ids[i:i+100]
        knock.add_subscribers(key, batch)
        subscribed += len(batch)
        if (i // 100 + 1) % 5 == 0 or subscribed == len(user_ids):
            print(f"  Subscribed {subscribed}/{len(user_ids)}", flush=True)
        time.sleep(0.2)

    print(f"\n{'='*70}")
    print(f"DONE! Audience synced to Knock.")
    print(f"  Audience key:  {key}")
    print(f"  Collection:    {KNOCK_COLLECTION}")
    print(f"  Users synced:  {subscribed}")
    print(f"  Source list:   HubSpot list {hubspot_list_id}")
    print(f"")
    print(f"To trigger a workflow for this audience:")
    print(f'  POST /v1/workflows/{{workflow_key}}/trigger')
    print(f'  {{"recipients": [{{"collection": "audiences", "id": "{key}"}}]}}')
    print(f"{'='*70}")

    return {"audience_key": key, "user_count": subscribed}


def main():
    parser = argparse.ArgumentParser(description="Manage Knock audiences from HubSpot lists")
    sub = parser.add_subparsers(dest="command", required=True)

    # push
    push_cmd = sub.add_parser("push", help="Push a HubSpot list to Knock as an audience")
    push_cmd.add_argument("list_id", help="HubSpot static list ID")
    push_cmd.add_argument("--audience-key", help="Custom audience key (default: hubspot-list-{id})")

    # list
    sub.add_parser("list", help="List all Knock audiences")

    # info
    info_cmd = sub.add_parser("info", help="Show audience details and subscriber count")
    info_cmd.add_argument("audience_key", help="Audience key")

    # delete
    del_cmd = sub.add_parser("delete", help="Delete a Knock audience and its subscriptions")
    del_cmd.add_argument("audience_key", help="Audience key")

    args = parser.parse_args()
    knock = KnockAudienceClient()

    if args.command == "push":
        push_to_knock(args.list_id, args.audience_key)

    elif args.command == "list":
        audiences = knock.list_audiences()
        if not audiences:
            print("No audiences found.")
            return
        print(f"{'Key':<35} {'Name':<45} {'Synced':<22} {'Contacts'}")
        print("-" * 110)
        for a in audiences:
            props = a.get("properties", {})
            print(f"{a['id']:<35} {props.get('name', '—'):<45} {props.get('synced_at', '—'):<22} {props.get('contact_count', '—')}")

    elif args.command == "info":
        audience = knock.get_audience(args.audience_key)
        subs = knock.get_subscribers(args.audience_key)
        props = audience.get("properties", {})
        print(f"Audience: {args.audience_key}")
        print(f"  Name:     {props.get('name', '—')}")
        print(f"  Source:   {props.get('source', '—')}")
        print(f"  HubSpot:  List {props.get('hubspot_list_id', '—')}")
        print(f"  Synced:   {props.get('synced_at', '—')}")
        print(f"  Subscribers: {len(subs)}")
        if subs[:5]:
            print(f"\n  Sample subscribers:")
            for s in subs[:5]:
                r = s.get("recipient", {})
                print(f"    {r.get('name', '—')} <{r.get('email', '—')}>")

    elif args.command == "delete":
        subs = knock.get_subscribers(args.audience_key)
        if subs:
            user_ids = [s["recipient"]["id"] for s in subs]
            for i in range(0, len(user_ids), 100):
                knock.remove_subscribers(args.audience_key, user_ids[i:i+100])
            print(f"Removed {len(user_ids)} subscriptions")
        knock.delete_audience(args.audience_key)
        print(f"Deleted audience: {args.audience_key}")


if __name__ == "__main__":
    main()
