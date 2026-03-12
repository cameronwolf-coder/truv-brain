"""Clay enrichment pipeline — CSV in, enriched CSV out.

Push a CSV into a Clay table, wait for enrichment columns to auto-run,
then export the enriched results.

Requires a Clay table with auto-run enrichment columns already configured.
The table acts as a reusable template — push new records in, get enriched
data back.

Usage:
    # Push CSV into a Clay table and wait for enrichment
    python -m outreach_intel.clay_enrich input.csv --table t_xxx --output enriched.csv

    # Use a named template instead of a table ID
    python -m outreach_intel.clay_enrich input.csv --template email-finder --output enriched.csv

    # Just push, don't wait (useful if you want to check back later)
    python -m outreach_intel.clay_enrich input.csv --table t_xxx --no-wait

    # Check enrichment status on a table you already pushed to
    python -m outreach_intel.clay_enrich --status t_xxx

    # Export results from a previously enriched table
    python -m outreach_intel.clay_enrich --export t_xxx --output enriched.csv
"""

import argparse
import csv
import io
import json
import sys
import time
from pathlib import Path
from typing import Optional

from outreach_intel.clay_client import ClayClient

# ── Template registry ─────────────────────────────────────────────
# Map friendly names to table IDs. Add new templates as you create them.
# Each template is a Clay table with enrichment columns + auto-run enabled.

TEMPLATES: dict[str, dict] = {
    "email-finder": {
        "table_id": "t_0tbn9peT6hN4Kk5FuE5",
        "description": "Find work emails via waterfall (Findymail, Hunter, etc.)",
        "input_columns": ["First Name", "Last Name", "Company Name", "Title"],
        "output_column": "Work Email",
    },
    "full-enrichment": {
        "table_id": "t_0tab6viQeb9Y3KKRmRU",
        "description": "Full pipeline: email + Company URL + HubSpot sync",
        "input_columns": ["First name", "Last name", "Job title", "Company", "State"],
        "output_column": "Work Email",
    },
}


def _fuzzy_match_columns(
    csv_headers: list[str],
    target_columns: list[str],
) -> dict[str, str]:
    """Build a {target_column: csv_column} mapping using fuzzy matching.

    Handles common variations like "First Name" vs "first_name" vs "FirstName".
    """
    def normalize(s: str) -> str:
        return s.lower().replace("_", " ").replace("-", " ").strip()

    mapping = {}
    normalized_targets = {normalize(t): t for t in target_columns}

    for header in csv_headers:
        norm = normalize(header)
        if norm in normalized_targets:
            mapping[normalized_targets[norm]] = header
        else:
            # Partial match: "first" matches "first name"
            for norm_target, original in normalized_targets.items():
                if norm_target in norm or norm in norm_target:
                    if original not in mapping:
                        mapping[original] = header

    return mapping


def push_csv(
    client: ClayClient,
    csv_path: str,
    table_id: str,
    column_mapping: Optional[dict[str, str]] = None,
    batch_size: int = 50,
) -> int:
    """Push CSV rows into a Clay table as new records.

    Args:
        client: ClayClient instance.
        csv_path: Path to CSV file.
        table_id: Target Clay table ID.
        column_mapping: Optional {clay_column: csv_column} override.
        batch_size: Records per API call (default 50).

    Returns:
        Number of records created.
    """
    # Read CSV
    path = Path(csv_path)
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        csv_rows = list(reader)

    if not csv_rows:
        print("CSV is empty.", file=sys.stderr)
        return 0

    csv_headers = list(csv_rows[0].keys())

    # Build field map: clay_column_name → field_id
    field_map = client.build_field_map(table_id)

    # If no explicit column mapping, auto-match CSV headers to Clay columns
    if column_mapping is None:
        clay_columns = list(field_map.keys())
        column_mapping = _fuzzy_match_columns(csv_headers, clay_columns)

    print(f"Column mapping:", file=sys.stderr)
    for clay_col, csv_col in column_mapping.items():
        fid = field_map.get(clay_col, "???")
        print(f"  CSV '{csv_col}' → Clay '{clay_col}' ({fid})", file=sys.stderr)

    unmapped = [h for h in csv_headers if h not in column_mapping.values()]
    if unmapped:
        print(f"  Unmapped CSV columns: {unmapped}", file=sys.stderr)

    # Build records
    total_created = 0
    for i in range(0, len(csv_rows), batch_size):
        batch = csv_rows[i : i + batch_size]
        records = []
        for row in batch:
            cells = {}
            for clay_col, csv_col in column_mapping.items():
                field_id = field_map.get(clay_col)
                if field_id and row.get(csv_col):
                    cells[field_id] = row[csv_col]
            if cells:
                records.append({"cells": cells})

        if records:
            result = client.create_records(table_id, records)
            created = len(result) if isinstance(result, list) else 0
            total_created += created
            print(
                f"  Batch {i // batch_size + 1}: "
                f"created {created} records ({total_created}/{len(csv_rows)})",
                file=sys.stderr,
            )

    return total_created


def wait_for_enrichment(
    client: ClayClient,
    table_id: str,
    output_column: str = "Work Email",
    timeout: int = 600,
    poll_interval: int = 15,
) -> list[dict]:
    """Poll the table until enrichment columns finish running.

    Checks the export for the presence of the output column being populated.
    Returns the enriched records when done or timeout is reached.

    Args:
        client: ClayClient instance.
        table_id: Table ID to monitor.
        output_column: Column name that indicates enrichment is complete.
        timeout: Max seconds to wait (default 600 = 10 min).
        poll_interval: Seconds between checks (default 15).

    Returns:
        List of enriched record dicts.
    """
    start = time.time()
    last_progress = ""

    while True:
        elapsed = time.time() - start
        if elapsed > timeout:
            print(
                f"\nTimeout after {timeout}s. Exporting current state.",
                file=sys.stderr,
            )
            break

        records = client.export_records(table_id)
        if not records:
            print("  No records found.", file=sys.stderr)
            break

        total = len(records)
        filled = sum(1 for r in records if r.get(output_column))
        empty = total - filled

        progress = f"  {filled}/{total} enriched ({empty} pending)"
        if progress != last_progress:
            print(progress, file=sys.stderr)
            last_progress = progress

        if empty == 0:
            print("  Enrichment complete!", file=sys.stderr)
            return records

        time.sleep(poll_interval)

    return client.export_records(table_id)


def check_status(client: ClayClient, table_id: str) -> None:
    """Print enrichment status for a table."""
    schema = client.get_table_schema(table_id)
    action_fields = [f for f in schema if f.get("type") == "action"]
    formula_fields = [f for f in schema if f.get("type") == "formula"]
    text_fields = [f for f in schema if f.get("type") == "text"]

    print(f"Table: {table_id}")
    print(f"  Input columns ({len(text_fields)}):")
    for f in text_fields:
        print(f"    {f['name']}")
    print(f"  Enrichment columns ({len(action_fields)}):")
    for f in action_fields:
        print(f"    {f['name']} ({f.get('actionDefinition', {}).get('key', '?')})")
    print(f"  Formula columns ({len(formula_fields)}):")
    for f in formula_fields:
        print(f"    {f['name']}")

    # Export and check fill rates
    print("\nExporting to check fill rates...", file=sys.stderr)
    records = client.export_records(table_id)
    if records:
        print(f"\n  Total records: {len(records)}")
        for col in records[0].keys():
            filled = sum(1 for r in records if r.get(col))
            pct = (filled / len(records)) * 100
            print(f"    {col}: {filled}/{len(records)} ({pct:.0f}%)")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Clay enrichment pipeline — CSV in, enriched CSV out"
    )
    parser.add_argument("csv_path", nargs="?", help="Input CSV file path")
    parser.add_argument("--table", "-t", help="Clay table ID")
    parser.add_argument(
        "--template",
        choices=list(TEMPLATES.keys()),
        help="Use a named template instead of --table",
    )
    parser.add_argument("--output", "-o", help="Output file path (CSV)")
    parser.add_argument(
        "--no-wait",
        action="store_true",
        help="Push records and exit without waiting for enrichment",
    )
    parser.add_argument(
        "--status",
        metavar="TABLE_ID",
        help="Check enrichment status on a table",
    )
    parser.add_argument(
        "--export",
        metavar="TABLE_ID",
        help="Export results from a previously enriched table",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=600,
        help="Max seconds to wait for enrichment (default 600)",
    )
    parser.add_argument(
        "--list-templates",
        action="store_true",
        help="List available enrichment templates",
    )

    args = parser.parse_args()
    client = ClayClient()

    # ── List templates ────────────────────────────────────────────
    if args.list_templates:
        for name, tmpl in TEMPLATES.items():
            print(f"  {name}")
            print(f"    Table: {tmpl['table_id']}")
            print(f"    {tmpl['description']}")
            print(f"    Input: {', '.join(tmpl['input_columns'])}")
            print(f"    Output: {tmpl['output_column']}")
            print()
        return

    # ── Status check ──────────────────────────────────────────────
    if args.status:
        check_status(client, args.status)
        return

    # ── Export only ───────────────────────────────────────────────
    if args.export:
        records = client.export_records(args.export)
        if args.output:
            _write_csv(records, args.output)
            print(f"Exported {len(records)} records to {args.output}", file=sys.stderr)
        else:
            print(json.dumps(records, indent=2))
            print(f"\n{len(records)} records", file=sys.stderr)
        return

    # ── Full pipeline: push + wait + export ───────────────────────
    if not args.csv_path:
        parser.error("csv_path is required for enrichment")

    # Resolve table ID
    table_id = args.table
    template = None
    if args.template:
        template = TEMPLATES[args.template]
        table_id = template["table_id"]
    if not table_id:
        parser.error("--table or --template is required")

    output_column = template["output_column"] if template else "Work Email"

    # Push CSV
    print(f"Pushing CSV to Clay table {table_id}...", file=sys.stderr)
    count = push_csv(client, args.csv_path, table_id)
    print(f"Created {count} records.", file=sys.stderr)

    if args.no_wait:
        print("Exiting (--no-wait). Check status later with --status", file=sys.stderr)
        return

    # Wait for enrichment
    print(f"\nWaiting for enrichment (polling '{output_column}')...", file=sys.stderr)
    records = wait_for_enrichment(
        client, table_id, output_column=output_column, timeout=args.timeout
    )

    # Output
    if args.output:
        _write_csv(records, args.output)
        print(f"\nSaved {len(records)} records to {args.output}", file=sys.stderr)
    else:
        print(json.dumps(records, indent=2))
        print(f"\n{len(records)} records", file=sys.stderr)


def _write_csv(records: list[dict], path: str) -> None:
    """Write records to a CSV file."""
    if not records:
        return
    fieldnames = list(records[0].keys())
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)


if __name__ == "__main__":
    main()
