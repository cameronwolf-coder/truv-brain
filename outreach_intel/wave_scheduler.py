"""45-day wave cycling engine for full TAM coverage.

Tracks which contacts were in which wave, when they were last contacted,
and when they're eligible for the next cycle. Each wave gets a different
angle/hook so the same contacts never receive the same pitch twice.

Usage:
    python -m outreach_intel.cli wave-build --size 2500 --angle "encompass-integration"
    python -m outreach_intel.cli wave-status
"""

import math
import time
from datetime import datetime, timedelta
from typing import Any, Optional

from .config import EXCLUDED_LIFECYCLE_STAGES
from .hubspot_client import HubSpotClient
from .tam_manager import (
    TAM_PROPERTIES,
    ALL_VERTICALS,
    BASE_FILTERS,
    _paginated_search,
    classify_persona,
)


# Minimum days between waves for the same contact
CYCLE_DAYS = 45

# Angles available for rotation
AVAILABLE_ANGLES = [
    "encompass-integration",
    "pre-closing-voe",
    "processor-capacity",
    "gse-compliance",
    "speed-to-close",
    "data-entry-cost",
]


def get_wave_eligible_contacts(
    client: Optional[HubSpotClient] = None,
    wave_size: int = 2500,
    angle: Optional[str] = None,
    verticals: Optional[list[str]] = None,
    personas: Optional[list[str]] = None,
    cycle_days: int = CYCLE_DAYS,
) -> list[dict[str, Any]]:
    """Pull contacts eligible for the next wave.

    Eligible means:
    - Not currently in a sequence (outreach_status != "active")
    - Not unsubscribed or customer
    - Last wave date >cycle_days ago OR never contacted
    - If angle specified, exclude contacts who received that angle last time

    Args:
        client: HubSpot client
        wave_size: Max contacts to include in this wave
        angle: Email angle to use (excludes contacts who got this angle last)
        verticals: Filter to specific verticals
        personas: Filter to specific personas
        cycle_days: Days since last wave before re-eligible

    Returns:
        List of eligible HubSpot contact records
    """
    hs = client or HubSpotClient()
    cutoff_date = (datetime.now() - timedelta(days=cycle_days)).strftime("%Y-%m-%d")

    # Exclude active, unsubscribed, customer
    status_exclusions = [
        {
            "propertyName": "outreach_status",
            "operator": "NOT_IN",
            "values": ["active", "unsubscribed", "customer"],
        },
    ]

    # Determine which verticals to query (segment to bypass 10K limit)
    target_verticals: list[dict] = []
    if verticals:
        for v in verticals:
            target_verticals.append(
                {"propertyName": "sales_vertical", "operator": "EQ", "value": v}
            )
    else:
        for v in ALL_VERTICALS:
            target_verticals.append(
                {"propertyName": "sales_vertical", "operator": "EQ", "value": v}
            )
        # Also include contacts with no vertical
        target_verticals.append(
            {"propertyName": "sales_vertical", "operator": "NOT_HAS_PROPERTY"}
        )

    all_eligible: list[dict[str, Any]] = []

    # Query 1: Never contacted (no wave date), segmented by vertical
    print("Finding wave-eligible contacts (never contacted)...", flush=True)
    for v_filter in target_verticals:
        if len(all_eligible) >= wave_size:
            break
        filters_never = BASE_FILTERS + status_exclusions + [
            v_filter,
            {"propertyName": "last_outreach_wave_date", "operator": "NOT_HAS_PROPERTY"},
        ]
        remaining = wave_size - len(all_eligible)
        segment = _paginated_search(hs, filters_never, TAM_PROPERTIES, max_results=remaining)
        all_eligible.extend(segment)

    print(f"  Never contacted: {len(all_eligible)}", flush=True)

    # Query 2: Contacted but >cycle_days ago (only if we need more)
    if len(all_eligible) < wave_size:
        print("Finding wave-eligible contacts (ready to recycle)...", flush=True)
        recycled_count = 0
        for v_filter in target_verticals:
            if len(all_eligible) >= wave_size:
                break
            filters_recycled = BASE_FILTERS + status_exclusions + [
                v_filter,
                {"propertyName": "last_outreach_wave_date", "operator": "LT", "value": cutoff_date},
            ]
            remaining = wave_size - len(all_eligible)
            segment = _paginated_search(hs, filters_recycled, TAM_PROPERTIES, max_results=remaining)

            # If angle specified, skip contacts who got this angle last time
            if angle:
                segment = [
                    c for c in segment
                    if c.get("properties", {}).get("outreach_wave_angle") != angle
                ]

            all_eligible.extend(segment)
            recycled_count += len(segment)

        print(f"  Recycled (>{cycle_days}d since last wave): {recycled_count}", flush=True)

    # Apply persona filter client-side (verticals already filtered server-side)
    if personas:
        all_eligible = [
            c for c in all_eligible
            if classify_persona(c.get("properties", {}).get("jobtitle", "")) in personas
        ]

    # Cap at wave_size
    return all_eligible[:wave_size]


def stamp_wave(
    contact_ids: list[str],
    angle: str,
    client: Optional[HubSpotClient] = None,
) -> int:
    """Stamp contacts with wave metadata after pushing to Smartlead.

    Sets:
    - last_outreach_wave_date = today
    - outreach_wave_count += 1
    - outreach_wave_angle = angle used
    - outreach_status = "active"

    Args:
        contact_ids: HubSpot contact IDs to stamp
        angle: The email angle used for this wave
        client: HubSpot client

    Returns:
        Number of contacts stamped
    """
    hs = client or HubSpotClient()
    today = datetime.now().strftime("%Y-%m-%d")
    stamped = 0

    for i in range(0, len(contact_ids), 100):
        batch = contact_ids[i:i + 100]

        # First, read current wave counts so we can increment
        current_contacts = hs.batch_get_contacts(
            batch, properties=["outreach_wave_count"]
        )
        count_map = {}
        for c in current_contacts:
            cid = c.get("id", "")
            current_count = c.get("properties", {}).get("outreach_wave_count")
            count_map[cid] = int(current_count or 0) + 1

        updates = [
            {
                "id": cid,
                "properties": {
                    "last_outreach_wave_date": today,
                    "outreach_wave_count": str(count_map.get(cid, 1)),
                    "outreach_wave_angle": angle,
                    "outreach_status": "active",
                },
            }
            for cid in batch
        ]
        hs.batch_update_contacts(updates)
        stamped += len(batch)

        if stamped % 500 == 0:
            print(f"  Stamped {stamped} contacts...", flush=True)
        time.sleep(0.1)

    return stamped


def build_wave(
    wave_size: int = 2500,
    angle: str = "encompass-integration",
    verticals: Optional[list[str]] = None,
    personas: Optional[list[str]] = None,
    list_name: Optional[str] = None,
    dry_run: bool = False,
    client: Optional[HubSpotClient] = None,
) -> dict[str, Any]:
    """Build a wave: find eligible contacts, create list, stamp metadata.

    This is the main entry point for the wave cycling engine.

    Args:
        wave_size: Max contacts in this wave
        angle: Email angle for this wave
        verticals: Filter to specific verticals
        personas: Filter to specific personas
        list_name: Name for HubSpot list (auto-generated if not provided)
        dry_run: Preview without creating list or stamping
        client: HubSpot client

    Returns:
        Dict with wave details: list_id, contact_count, angle, contacts
    """
    hs = client or HubSpotClient()

    if angle not in AVAILABLE_ANGLES:
        print(f"Warning: '{angle}' not in standard angles: {AVAILABLE_ANGLES}")

    # Find eligible contacts
    contacts = get_wave_eligible_contacts(
        client=hs,
        wave_size=wave_size,
        angle=angle,
        verticals=verticals,
        personas=personas,
    )

    if not contacts:
        print("No eligible contacts found for this wave.")
        return {"contact_count": 0, "angle": angle}

    contact_ids = [c.get("id", "") for c in contacts]
    today = datetime.now().strftime("%Y-%m-%d")

    if not list_name:
        list_name = f"Wave - {angle} - {today}"

    print(f"\nWave Summary:")
    print(f"  Angle: {angle}")
    print(f"  Contacts: {len(contacts)}")
    print(f"  List Name: {list_name}")

    if dry_run:
        print(f"\n[DRY RUN] Would create list and stamp {len(contacts)} contacts")
        # Show sample
        for c in contacts[:5]:
            props = c.get("properties", {})
            name = f"{props.get('firstname', '')} {props.get('lastname', '')}".strip()
            wave_count = props.get("outreach_wave_count") or "0"
            last_wave = props.get("last_outreach_wave_date") or "never"
            print(f"    {name} ({props.get('company', '?')}) - waves: {wave_count}, last: {last_wave}")
        if len(contacts) > 5:
            print(f"    ... and {len(contacts) - 5} more")
        return {
            "contact_count": len(contacts),
            "angle": angle,
            "dry_run": True,
        }

    # Create HubSpot list
    print(f"\nCreating HubSpot list '{list_name}'...", flush=True)
    new_list = hs.create_list(name=list_name)
    list_data = new_list.get("list", new_list)
    list_id = list_data.get("listId") or list_data.get("id")

    # Add contacts to list
    for i in range(0, len(contact_ids), 100):
        batch = contact_ids[i:i + 100]
        hs.add_contacts_to_list(list_id, batch)
        time.sleep(0.1)

    print(f"  Added {len(contact_ids)} contacts to list {list_id}", flush=True)

    # Stamp wave metadata
    print(f"\nStamping wave metadata...", flush=True)
    stamped = stamp_wave(contact_ids, angle, client=hs)

    print(f"\n{'='*60}")
    print(f"WAVE BUILT SUCCESSFULLY")
    print(f"  List ID:    {list_id}")
    print(f"  List Name:  {list_name}")
    print(f"  Contacts:   {stamped}")
    print(f"  Angle:      {angle}")
    print(f"{'='*60}")
    print(f"\nNext: push to Smartlead with:")
    print(f"  python -m outreach_intel.smartlead_uploader push {list_id} <campaign_id>")

    return {
        "list_id": list_id,
        "list_name": list_name,
        "contact_count": stamped,
        "angle": angle,
        "contacts": contacts,
    }


def get_wave_status(
    client: Optional[HubSpotClient] = None,
) -> dict[str, Any]:
    """Get current wave cycling status.

    Returns:
        Dict with active wave count, eligible count, and cycle health
    """
    hs = client or HubSpotClient()

    def _count(filters: list[dict]) -> int:
        """Get total count from a HubSpot search."""
        body: dict[str, Any] = {
            "limit": 1,
            "properties": ["email"],
            "filterGroups": [{"filters": filters}],
        }
        response = hs.post("/crm/v3/objects/contacts/search", json_data=body)
        return response.get("total", 0)

    # Count contacts by outreach_status
    statuses = {}
    for status_value in ["active", "exhausted", "engaged"]:
        statuses[status_value] = _count([
            {"propertyName": "outreach_status", "operator": "EQ", "value": status_value},
        ])

    # Get contacts eligible for next wave
    cutoff = (datetime.now() - timedelta(days=CYCLE_DAYS)).strftime("%Y-%m-%d")

    # These queries use last_outreach_wave_date which may not exist yet
    try:
        never_contacted = _count([
            {"propertyName": "last_outreach_wave_date", "operator": "NOT_HAS_PROPERTY"},
            {"propertyName": "email", "operator": "HAS_PROPERTY"},
            {"propertyName": "lifecyclestage", "operator": "NOT_IN", "values": EXCLUDED_LIFECYCLE_STAGES},
        ])
    except Exception:
        # Property doesn't exist yet — all contacts are "never contacted"
        never_contacted = _count([
            {"propertyName": "email", "operator": "HAS_PROPERTY"},
            {"propertyName": "lifecyclestage", "operator": "NOT_IN", "values": EXCLUDED_LIFECYCLE_STAGES},
        ])

    try:
        ready_to_recycle = _count([
            {"propertyName": "last_outreach_wave_date", "operator": "LT", "value": cutoff},
            {"propertyName": "outreach_status", "operator": "NOT_IN", "values": ["active", "unsubscribed", "customer"]},
            {"propertyName": "email", "operator": "HAS_PROPERTY"},
        ])
    except Exception:
        ready_to_recycle = 0

    return {
        "by_status": statuses,
        "never_contacted": never_contacted,
        "ready_to_recycle": ready_to_recycle,
        "cycle_days": CYCLE_DAYS,
        "available_angles": AVAILABLE_ANGLES,
    }
