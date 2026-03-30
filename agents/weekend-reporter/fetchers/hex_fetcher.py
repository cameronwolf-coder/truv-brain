"""
Hex data fetcher for Weekend Reporter.

Approach:
  1. Trigger a fresh run via Hex API (ensures up-to-date data)
  2. Poll until COMPLETED
  3. Use dev-browser -s=hex to navigate to the runUrl and extract rendered metrics
  4. Write results to cache/hex_{dashboard}.json

Hex Project IDs:
  Contact Sales Analytics: 019b9e63-3265-7003-a59f-23e445edda93
  LinkedIn Ad Dashboard:   019c0fec-5fda-7003-97bb-329a80197cdb
"""

import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

# Load .env from project root so HEX_API_TOKEN is available when run as a script
try:
    from dotenv import load_dotenv
    _root = Path(__file__).parent.parent.parent.parent
    load_dotenv(_root / ".env")
except ImportError:
    pass

CACHE_DIR = Path(__file__).parent.parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)

HEX_API_BASE = "https://app.hex.tech/api/v1"
HEX_TOKEN = os.environ.get("HEX_API_TOKEN", "")

DASHBOARDS = {
    "hex_contact_sales": {
        "project_id": "019b9e63-3265-7003-a59f-23e445edda93",
        "title": "Contact Sales Analytics",
        "url": "https://app.hex.tech/a67b2221-7645-4a6f-8c58-6549b7264039/app/Contact-Sales-Analytics-0326pswe7Y7DlKEnOGFcwd/latest",
    },
    "hex_linkedin_ads": {
        "project_id": "019c0fec-5fda-7003-97bb-329a80197cdb",
        "title": "LinkedIn Ad Dashboard",
        "url": "https://app.hex.tech/a67b2221-7645-4a6f-8c58-6549b7264039/app/Linkedin-Ad-Dashboard-032JOzDRspp46uJSyMqy8x/latest",
    },
}


def trigger_hex_run(project_id: str) -> str | None:
    """Trigger a Hex project run. Returns runId or None on failure."""
    if not HEX_TOKEN:
        print(f"[hex_fetcher] No HEX_API_TOKEN — skipping API trigger")
        return None
    try:
        r = requests.post(
            f"{HEX_API_BASE}/project/{project_id}/run",
            headers={"Authorization": f"Bearer {HEX_TOKEN}"},
            json={},
            timeout=30,
        )
        r.raise_for_status()
        run_id = r.json().get("runId")
        print(f"[hex_fetcher] Triggered run {run_id} for project {project_id}")
        return run_id
    except Exception as e:
        print(f"[hex_fetcher] API trigger failed: {e}")
        return None


def poll_hex_run(project_id: str, run_id: str, max_wait: int = 180) -> dict | None:
    """Poll until the run completes. Returns run metadata or None."""
    deadline = time.time() + max_wait
    while time.time() < deadline:
        try:
            r = requests.get(
                f"{HEX_API_BASE}/projects/{project_id}/runs/{run_id}",
                headers={"Authorization": f"Bearer {HEX_TOKEN}"},
                timeout=30,
            )
            r.raise_for_status()
            data = r.json()
            status = data.get("status")
            print(f"[hex_fetcher] Run {run_id} status: {status}")
            if status == "COMPLETED":
                return data
            if status in ("FAILED", "KILLED", "ERRORED"):
                print(f"[hex_fetcher] Run ended with status: {status}")
                return None
        except Exception as e:
            print(f"[hex_fetcher] Poll error: {e}")
        time.sleep(5)
    print(f"[hex_fetcher] Timed out waiting for run {run_id}")
    return None


def extract_via_playwright(run_url: str, dashboard_name: str) -> dict:
    """
    Extract rendered metric values from a Hex run URL.
    Tries dev-browser -s=hex first, then agent-browser -s=hex as fallback.
    Returns a dict of extracted text content.
    """
    print(f"[hex_fetcher] Extracting data via dev-browser for {dashboard_name}...")

    results = {}

    # --- Attempt 1: dev-browser -s=hex ---
    try:
        subprocess.run(
            ["dev-browser", "-s=hex", "goto", run_url],
            capture_output=True, text=True, timeout=60
        )
        r = subprocess.run(
            ["dev-browser", "-s=hex", "eval", "document.body.innerText"],
            capture_output=True, text=True, timeout=30
        )
        if r.stdout and "is not open" not in r.stdout:
            results["page_text"] = r.stdout
            print(f"[hex_fetcher] dev-browser succeeded for {dashboard_name}")
            return results
    except Exception as e:
        print(f"[hex_fetcher] dev-browser error: {e}")

    # --- Attempt 2: agent-browser --session-name hex ---
    print(f"[hex_fetcher] dev-browser unavailable, trying agent-browser for {dashboard_name}...")
    try:
        subprocess.run(
            ["agent-browser", "--session-name", "hex", "open", run_url],
            capture_output=True, text=True, timeout=30
        )
        time.sleep(5)
        r = subprocess.run(
            ["agent-browser", "--session-name", "hex", "eval", "document.body.innerText"],
            capture_output=True, text=True, timeout=30
        )
        if r.stdout and "Log in" not in r.stdout[:50]:
            # agent-browser eval returns a JSON-encoded string — decode it
            raw = r.stdout.strip()
            try:
                decoded = json.loads(raw)
                if isinstance(decoded, str):
                    raw = decoded
            except (json.JSONDecodeError, ValueError):
                pass
            results["page_text"] = raw
            print(f"[hex_fetcher] agent-browser succeeded for {dashboard_name}")
        else:
            print(f"[hex_fetcher] agent-browser: not authenticated for {dashboard_name}")
    except Exception as e:
        print(f"[hex_fetcher] agent-browser error: {e}")

    return results


def fetch_dashboard(cache_key: str, config: dict) -> dict:
    """Fetch a single Hex dashboard and write to cache."""
    project_id = config["project_id"]
    title = config["title"]
    fallback_url = config["url"]

    cache_file = CACHE_DIR / f"{cache_key}.json"

    # Step 1: Trigger API run
    run_id = trigger_hex_run(project_id)
    run_url = fallback_url

    # Step 2: Poll for completion
    if run_id:
        run_data = poll_hex_run(project_id, run_id)
        if run_data:
            run_url = run_data.get("runUrl", fallback_url)
            print(f"[hex_fetcher] Run completed. URL: {run_url}")

    # Step 3: Extract data via dev-browser
    extracted = extract_via_playwright(run_url, title)

    result = {
        "dashboard": title,
        "cache_key": cache_key,
        "run_id": run_id,
        "run_url": run_url,
        "fetched_at": datetime.utcnow().isoformat(),
        "raw": extracted,
        "error": None if extracted else "No data extracted",
    }

    cache_file.write_text(json.dumps(result, indent=2))
    print(f"[hex_fetcher] Wrote {cache_key} to {cache_file}")
    return result


def main():
    """Fetch all Hex dashboards in sequence (called in parallel by AGENTS.md)."""
    if not HEX_TOKEN:
        print("[hex_fetcher] WARNING: HEX_API_TOKEN not set. API trigger disabled.")

    for cache_key, config in DASHBOARDS.items():
        fetch_dashboard(cache_key, config)

    print("[hex_fetcher] Done.")


if __name__ == "__main__":
    main()
