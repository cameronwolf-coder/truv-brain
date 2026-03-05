"""
Autonomous Meta Ads media buyer.

Pulls ad-level performance for a given Ad Set, calculates CPM/CPC,
and pauses any ad whose CPM exceeds the ad set average by 20%+.

Usage:
    python -m meta_ads.media_buyer <AD_SET_ID> [--dry-run] [--threshold 1.2]

Cron example (every 6 hours):
    0 */6 * * * cd /Users/cameronwolf/Downloads/Projects/truv-brain && /usr/bin/env python -m meta_ads.media_buyer 12345678 >> logs/media_buyer.log 2>&1
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API_VERSION = "v21.0"
BASE_URL = f"https://graph.facebook.com/{API_VERSION}"


def log(msg: str):
    print(f"[{datetime.now().isoformat()}] {msg}", flush=True)


def get_token() -> str:
    token = os.environ.get("META_ACCESS_TOKEN")
    if not token or token.startswith("your-"):
        log("ERROR: META_ACCESS_TOKEN not set in .env")
        sys.exit(1)
    return token


def api_get(path: str, params: dict, token: str) -> dict:
    params["access_token"] = token
    url = f"{BASE_URL}/{path}?{urlencode(params)}"
    try:
        with urlopen(Request(url)) as resp:
            return json.loads(resp.read())
    except HTTPError as e:
        body = e.read().decode()
        log(f"API error {e.code}: {body}")
        sys.exit(1)


def api_post(path: str, data: dict, token: str) -> dict:
    data["access_token"] = token
    payload = urlencode(data).encode()
    req = Request(f"{BASE_URL}/{path}", data=payload, method="POST")
    try:
        with urlopen(req) as resp:
            return json.loads(resp.read())
    except HTTPError as e:
        body = e.read().decode()
        log(f"API error {e.code}: {body}")
        sys.exit(1)


def fetch_ad_insights(ad_set_id: str, token: str) -> list[dict]:
    """Fetch ad-level insights for the last 3 days."""
    since = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")
    until = datetime.now().strftime("%Y-%m-%d")

    data = api_get(
        f"{ad_set_id}/insights",
        {
            "level": "ad",
            "fields": "ad_id,ad_name,impressions,clicks,spend,cpm,cpc",
            "time_range": json.dumps({"since": since, "until": until}),
            "filtering": json.dumps([
                {"field": "ad.effective_status", "operator": "IN", "value": ["ACTIVE"]}
            ]),
            "limit": "500",
        },
        token,
    )
    return data.get("data", [])


def analyze_and_pause(ads: list[dict], threshold: float, token: str, dry_run: bool):
    """Calculate average CPM, flag outliers, pause them."""
    if not ads:
        log("No active ads with impressions found. Nothing to do.")
        return

    # Parse metrics
    for ad in ads:
        ad["_impressions"] = int(ad.get("impressions", 0))
        ad["_spend"] = float(ad.get("spend", 0))
        ad["_clicks"] = int(ad.get("clicks", 0))
        ad["_cpm"] = float(ad.get("cpm", 0))
        ad["_cpc"] = float(ad.get("cpc", 0)) if ad.get("cpc") else None

    # Filter to ads with actual delivery
    delivered = [a for a in ads if a["_impressions"] > 0]
    if not delivered:
        log("No ads with impressions in the last 3 days.")
        return

    avg_cpm = sum(a["_cpm"] for a in delivered) / len(delivered)
    cpm_cutoff = avg_cpm * threshold

    log(f"Ads analyzed: {len(delivered)}")
    log(f"Avg CPM: ${avg_cpm:.2f} | Pause threshold ({threshold}x): ${cpm_cutoff:.2f}")
    log("-" * 70)

    to_pause = []
    for ad in delivered:
        flag = " ** OVER" if ad["_cpm"] > cpm_cutoff else ""
        cpc_str = f"${ad['_cpc']:.2f}" if ad["_cpc"] else "N/A"
        log(
            f"  {ad['ad_name'][:40]:<40} "
            f"CPM=${ad['_cpm']:.2f}  CPC={cpc_str}  "
            f"Spend=${ad['_spend']:.2f}  Impr={ad['_impressions']}{flag}"
        )
        if ad["_cpm"] > cpm_cutoff:
            to_pause.append(ad)

    log("-" * 70)

    if not to_pause:
        log("All ads within threshold. No action taken.")
        return

    log(f"{len(to_pause)} ad(s) flagged for pausing.")

    for ad in to_pause:
        ad_id = ad["ad_id"]
        if dry_run:
            log(f"  [DRY RUN] Would pause ad {ad_id} ({ad['ad_name']})")
        else:
            api_post(ad_id, {"status": "PAUSED"}, token)
            log(f"  PAUSED ad {ad_id} ({ad['ad_name']})")

    if dry_run:
        log("Dry run complete. No ads were paused.")


def main():
    parser = argparse.ArgumentParser(description="Autonomous Meta Ads media buyer")
    parser.add_argument("ad_set_id", help="Meta Ad Set ID to analyze")
    parser.add_argument("--dry-run", action="store_true", help="Log actions without pausing")
    parser.add_argument(
        "--threshold",
        type=float,
        default=1.2,
        help="CPM multiplier to trigger pause (default: 1.2 = 20%% above avg)",
    )
    args = parser.parse_args()

    log(f"Starting media buyer for Ad Set {args.ad_set_id}")
    token = get_token()

    ads = fetch_ad_insights(args.ad_set_id, token)
    analyze_and_pause(ads, args.threshold, token, args.dry_run)

    log("Done.")


if __name__ == "__main__":
    main()
