"""Clay Table API client — direct HTTP access to Clay's internal v3 API.

Clay has no official public API. This client hits Clay's internal endpoints
using a session cookie for authentication. The cookie expires every few days;
refresh it from browser DevTools → Application → Cookies → claysession,
or re-save playwright state: `playwright-cli -s=clay state-save clay-auth.json`

Cookie resolution order:
1. Explicit session_cookie argument
2. CLAY_SESSION_COOKIE environment variable
3. Auto-extracted from clay-auth.json (playwright state file in project root)

Usage:
    from outreach_intel.clay_client import ClayClient

    client = ClayClient()
    tables = client.list_tables()
    schema = client.get_table_schema("t_abc123")
    records = client.export_records("t_abc123")
    client.create_records("t_abc123", [{"cells": {"f_field1": "val"}}])
    # Note: enrichment triggers require browser automation (clay-enrichment skill)
"""

import csv
import io
import json
import os
import time
from pathlib import Path
from typing import Any, Optional

import requests
from dotenv import load_dotenv

load_dotenv()

_DEFAULT_AUTH_FILE = Path(__file__).resolve().parent.parent / "clay-auth.json"


def _extract_cookie_from_auth_file(
    auth_file: Path = _DEFAULT_AUTH_FILE,
) -> Optional[str]:
    """Extract claysession cookie from playwright auth state JSON."""
    if not auth_file.exists():
        return None
    try:
        data = json.loads(auth_file.read_text())
        for cookie in data.get("cookies", []):
            if cookie.get("name") == "claysession":
                return cookie["value"]
    except (json.JSONDecodeError, KeyError):
        pass
    return None


class ClayClient:
    """Client for Clay's internal table API.

    Discovered endpoints (api.clay.com/v3):
    - GET  /workspaces/{id}/tables          → list tables
    - GET  /tables/{id}                     → get table (fields, views, settings)
    - POST /tables/{id}/records             → create records  {"records": [{...}]}
    - GET  /tables/{id}/records/{record_id} → get single record
    - PATCH /tables/{id}/records/{record_id} → update record
    - DELETE /tables/{id}/records/{record_id} → delete record
    - POST /tables/{id}/export              → start CSV export job
    - GET  /exports/{export_id}             → poll export job status + download URL
    - Enrichment trigger: NOT available via REST — use browser automation
    """

    BASE_URL = "https://api.clay.com/v3"

    def __init__(
        self,
        session_cookie: Optional[str] = None,
        workspace_id: int = 276559,
    ):
        self.session_cookie = (
            session_cookie
            or os.getenv("CLAY_SESSION_COOKIE")
            or _extract_cookie_from_auth_file()
        )
        if not self.session_cookie:
            raise ValueError(
                "Session cookie required. Options:\n"
                "  1. Set CLAY_SESSION_COOKIE in .env\n"
                "  2. Save playwright state: playwright-cli -s=clay state-save clay-auth.json\n"
                "  3. Pass session_cookie= directly"
            )
        self.workspace_id = workspace_id

    def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[dict] = None,
        json_data: Optional[Any] = None,
    ) -> Any:
        """Make authenticated request to Clay API."""
        url = f"{self.BASE_URL}{endpoint}"
        headers = {
            "Content-Type": "application/json",
            "Cookie": f"claysession={self.session_cookie}",
        }

        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            params=params,
            json=json_data,
        )
        response.raise_for_status()

        if response.status_code == 204 or not response.text:
            return {}
        return response.json()

    # ── Table operations ──────────────────────────────────────────────

    def list_tables(self) -> list[dict]:
        """List all tables in the workspace."""
        resp = self._request("GET", f"/workspaces/{self.workspace_id}/tables")
        if isinstance(resp, dict) and "results" in resp:
            return resp["results"]
        return resp

    def get_table(self, table_id: str) -> dict:
        """Get table details including fields (schema) and views."""
        resp = self._request("GET", f"/tables/{table_id}")
        if isinstance(resp, dict) and "table" in resp:
            return resp["table"]
        return resp

    def get_table_schema(self, table_id: str) -> list[dict]:
        """Get column definitions for a table."""
        table = self.get_table(table_id)
        return table.get("fields", [])

    def find_table_by_name(self, name: str) -> Optional[dict]:
        """Find a table by name (case-insensitive partial match)."""
        for table in self.list_tables():
            if name.lower() in table.get("name", "").lower():
                return table
        return None

    # ── Single record operations ──────────────────────────────────────

    def get_record(self, table_id: str, record_id: str) -> dict:
        """Get a single record by ID (record IDs are r_xxxxx format)."""
        return self._request("GET", f"/tables/{table_id}/records/{record_id}")

    def create_records(
        self,
        table_id: str,
        records: list[dict[str, Any]],
    ) -> list[dict]:
        """Create one or more records.

        Args:
            table_id: Table ID.
            records: List of record dicts, each with a 'cells' key.
                Example: [{"cells": {"f_abc": "hello", "f_def": "world"}}]

        Returns:
            List of created records with their assigned r_xxxxx IDs.
        """
        resp = self._request(
            "POST",
            f"/tables/{table_id}/records",
            json_data={"records": records},
        )
        if isinstance(resp, dict) and "records" in resp:
            return resp["records"]
        return resp

    def update_record(
        self,
        table_id: str,
        record_id: str,
        cells: dict[str, Any],
    ) -> dict:
        """Update a record's cells.

        Args:
            table_id: Table ID.
            record_id: Record ID (r_xxxxx).
            cells: Field values. Example: {"f_abc": "new value"}
        """
        return self._request(
            "PATCH",
            f"/tables/{table_id}/records/{record_id}",
            json_data={"cells": cells},
        )

    def delete_record(self, table_id: str, record_id: str) -> dict:
        """Delete a single record."""
        return self._request("DELETE", f"/tables/{table_id}/records/{record_id}")

    # ── Bulk read via export ──────────────────────────────────────────

    def export_table(self, table_id: str, poll_interval: float = 1.0) -> str:
        """Export a table as CSV and return the download URL.

        Clay has no bulk GET endpoint for records. To read all rows,
        trigger a CSV export and poll until it's ready.

        Args:
            table_id: Table ID.
            poll_interval: Seconds between status checks (default 1s).

        Returns:
            Presigned S3 download URL for the CSV (expires in ~24h).
        """
        job = self._request("POST", f"/tables/{table_id}/export")
        export_id = job["id"]

        while True:
            status = self._request("GET", f"/exports/{export_id}")
            if status.get("status") == "FINISHED":
                return status["downloadUrl"]
            if status.get("status") == "FAILED":
                raise RuntimeError(f"Export failed: {status}")
            time.sleep(poll_interval)

    def export_records(self, table_id: str) -> list[dict]:
        """Export all records as a list of dicts (column name → value).

        Convenience wrapper around export_table that downloads and parses
        the CSV into Python dicts.
        """
        url = self.export_table(table_id)
        resp = requests.get(url)
        resp.raise_for_status()
        reader = csv.DictReader(io.StringIO(resp.text))
        return list(reader)

    # ── Enrichment ────────────────────────────────────────────────────
    # NOTE: Clay's v3 REST API does not expose a trigger-enrichment endpoint.
    # Enrichment columns must be triggered via the Clay UI or browser automation
    # (playwright-cli). The clay-enrichment skill handles this via the UI.
    # If Clay adds this endpoint in the future, uncomment and adjust below.
    #
    # def trigger_enrichment(self, table_id, field_ids, record_ids):
    #     return self._request("POST", f"/tables/{table_id}/trigger-enrichment",
    #         json_data={"fieldIds": field_ids, "recordIds": record_ids})

    # ── Convenience helpers ───────────────────────────────────────────

    def build_field_map(self, table_id: str) -> dict[str, str]:
        """Build a {column_name: field_id} mapping for a table."""
        fields = self.get_table_schema(table_id)
        return {f.get("name", ""): f["id"] for f in fields if "id" in f}

    def create_records_simple(
        self,
        table_id: str,
        rows: list[dict[str, str]],
        field_map: Optional[dict[str, str]] = None,
    ) -> list[dict]:
        """Create records using column names instead of field IDs.

        Args:
            table_id: Table ID.
            rows: List of {column_name: value} dicts.
            field_map: Optional pre-built {name: field_id} map.
                If omitted, fetched automatically from the table schema.
        """
        if field_map is None:
            field_map = self.build_field_map(table_id)

        records = []
        for row in rows:
            cells = {}
            for col_name, value in row.items():
                field_id = field_map.get(col_name)
                if field_id:
                    cells[field_id] = value
            records.append({"cells": cells})
        return self.create_records(table_id, records)
