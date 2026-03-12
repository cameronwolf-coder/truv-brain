"""CLI for Clay Table API operations.

Usage:
    python -m outreach_intel.clay_cli list-tables
    python -m outreach_intel.clay_cli get-table t_abc123
    python -m outreach_intel.clay_cli schema t_abc123
    python -m outreach_intel.clay_cli export t_abc123
    python -m outreach_intel.clay_cli export t_abc123 --output data.csv
    python -m outreach_intel.clay_cli get-record t_abc123 r_xyz789
    python -m outreach_intel.clay_cli create t_abc123 '{"f_field1": "hello"}'
    # Note: enrichment triggers require browser automation (clay-enrichment skill)
"""

import argparse
import json
import sys

from outreach_intel.clay_client import ClayClient


def cmd_list_tables(client: ClayClient, args: argparse.Namespace) -> None:
    tables = client.list_tables()
    for t in tables:
        name = t.get("name", "Untitled")
        tid = t.get("id", "?")
        print(f"  {tid}  {name}")


def cmd_get_table(client: ClayClient, args: argparse.Namespace) -> None:
    table = client.get_table(args.table_id)
    print(json.dumps(table, indent=2))


def cmd_schema(client: ClayClient, args: argparse.Namespace) -> None:
    fields = client.get_table_schema(args.table_id)
    for f in fields:
        fid = f.get("id", "?")
        name = f.get("name", "Untitled")
        ftype = f.get("type", "?")
        print(f"  {fid}  {name}  ({ftype})")


def cmd_export(client: ClayClient, args: argparse.Namespace) -> None:
    print("Exporting...", file=sys.stderr)
    if args.output:
        url = client.export_table(args.table_id)
        import requests
        resp = requests.get(url)
        resp.raise_for_status()
        with open(args.output, "w") as f:
            f.write(resp.text)
        print(f"Saved to {args.output}", file=sys.stderr)
    else:
        records = client.export_records(args.table_id)
        print(json.dumps(records, indent=2))
        print(f"\n{len(records)} records", file=sys.stderr)


def cmd_get_record(client: ClayClient, args: argparse.Namespace) -> None:
    record = client.get_record(args.table_id, args.record_id)
    print(json.dumps(record, indent=2))


def cmd_create(client: ClayClient, args: argparse.Namespace) -> None:
    cells = json.loads(args.cells_json)
    result = client.create_records(args.table_id, [{"cells": cells}])
    print(json.dumps(result, indent=2))


def cmd_update(client: ClayClient, args: argparse.Namespace) -> None:
    cells = json.loads(args.cells_json)
    result = client.update_record(args.table_id, args.record_id, cells)
    print(json.dumps(result, indent=2))


def cmd_delete(client: ClayClient, args: argparse.Namespace) -> None:
    client.delete_record(args.table_id, args.record_id)
    print(f"Deleted {args.record_id}")



def main() -> None:
    parser = argparse.ArgumentParser(description="Clay Table API CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list-tables", help="List all tables")

    p = sub.add_parser("get-table", help="Get table details")
    p.add_argument("table_id")

    p = sub.add_parser("schema", help="Show table columns")
    p.add_argument("table_id")

    p = sub.add_parser("export", help="Export all records as JSON or CSV")
    p.add_argument("table_id")
    p.add_argument("--output", "-o", help="Save as CSV file instead of JSON stdout")

    p = sub.add_parser("get-record", help="Get a single record")
    p.add_argument("table_id")
    p.add_argument("record_id")

    p = sub.add_parser("create", help="Create a record")
    p.add_argument("table_id")
    p.add_argument("cells_json", help='JSON: {"f_id": "value", ...}')

    p = sub.add_parser("update", help="Update a record")
    p.add_argument("table_id")
    p.add_argument("record_id")
    p.add_argument("cells_json", help='JSON: {"f_id": "value", ...}')

    p = sub.add_parser("delete", help="Delete a record")
    p.add_argument("table_id")
    p.add_argument("record_id")

    args = parser.parse_args()
    client = ClayClient()

    commands = {
        "list-tables": cmd_list_tables,
        "get-table": cmd_get_table,
        "schema": cmd_schema,
        "export": cmd_export,
        "get-record": cmd_get_record,
        "create": cmd_create,
        "update": cmd_update,
        "delete": cmd_delete,
    }

    try:
        commands[args.command](client, args)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
