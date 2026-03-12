"""
Ad Data Exporter — Hybrid API + Browser CSV export from ad platforms.

API-first: Uses platform API tokens from .env when available.
Browser fallback: Opens playwright-cli for manual auth when API tokens missing.

Usage:
    python -m outreach_intel.ad_exporter meta --days 30
    python -m outreach_intel.ad_exporter google --days 30
    python -m outreach_intel.ad_exporter linkedin --days 30
    python -m outreach_intel.ad_exporter all --days 30
"""

import csv
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

EXPORTS_DIR = Path(__file__).parent.parent / "exports"
EXPORTS_DIR.mkdir(exist_ok=True)

# Browser profile directory (shared with Playwright MCP)
BROWSER_PROFILE_DIR = Path.home() / ".playwright-mcp-data"


def _today():
    return datetime.now().strftime("%Y-%m-%d")


def _date_range(days: int):
    end = datetime.now()
    start = end - timedelta(days=days)
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# Meta Ads — API Export
# ---------------------------------------------------------------------------

def export_meta_api(days: int = 30) -> str | None:
    """Export Meta Ads data via Marketing API. Returns CSV path or None."""
    token = os.getenv("META_ACCESS_TOKEN")
    account_id = os.getenv("META_AD_ACCOUNT_ID")
    if not token or not account_id:
        return None

    start, end = _date_range(days)
    fields = "campaign_name,adset_name,ad_name,impressions,clicks,ctr,cpc,spend,actions,cost_per_action_type"
    time_range = json.dumps({"since": start, "until": end})
    params = urlencode({
        "fields": fields,
        "time_range": time_range,
        "level": "ad",
        "limit": "500",
        "access_token": token,
    })
    url = f"https://graph.facebook.com/v21.0/{account_id}/insights?{params}"

    try:
        req = Request(url)
        with urlopen(req) as resp:
            data = json.loads(resp.read().decode())
    except HTTPError as e:
        print(f"Meta API error: {e.code} — {e.read().decode()[:200]}")
        return None

    rows = data.get("data", [])
    if not rows:
        print("Meta API: No data returned.")
        return None

    # Flatten actions to get conversions
    csv_rows = []
    for row in rows:
        conversions = 0
        cost_per_result = 0
        actions = row.get("actions", [])
        for action in actions:
            if action.get("action_type") in ("lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped"):
                conversions = int(action.get("value", 0))
                break
        cost_actions = row.get("cost_per_action_type", [])
        for ca in cost_actions:
            if ca.get("action_type") in ("lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped"):
                cost_per_result = float(ca.get("value", 0))
                break

        csv_rows.append({
            "Campaign name": row.get("campaign_name", ""),
            "Ad set name": row.get("adset_name", ""),
            "Ad name": row.get("ad_name", ""),
            "Impressions": row.get("impressions", 0),
            "Link clicks": row.get("clicks", 0),
            "CTR (link click-through rate)": row.get("ctr", "0"),
            "CPC (cost per link click)": row.get("cpc", "0"),
            "Results": conversions,
            "Cost per result": cost_per_result,
            "Amount spent": row.get("spend", "0"),
        })

    # Write CSV
    latest = EXPORTS_DIR / "meta-ads-export.csv"
    dated = EXPORTS_DIR / f"meta-ads-{_today()}.csv"
    fieldnames = list(csv_rows[0].keys())

    for path in [latest, dated]:
        with open(path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(csv_rows)

    print(f"Meta: Exported {len(csv_rows)} ads → {latest}")
    return str(latest)


# ---------------------------------------------------------------------------
# Google Ads — API Export
# ---------------------------------------------------------------------------

def export_google_api(days: int = 30) -> str | None:
    """Export Google Ads data via REST API. Returns CSV path or None."""
    dev_token = os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN")
    refresh_token = os.getenv("GOOGLE_ADS_REFRESH_TOKEN")
    client_id = os.getenv("GOOGLE_ADS_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_ADS_CLIENT_SECRET")
    customer_id = os.getenv("GOOGLE_ADS_CUSTOMER_ID", "").replace("-", "")

    if not all([dev_token, refresh_token, client_id, client_secret, customer_id]):
        return None

    # Get fresh access token
    token_url = "https://oauth2.googleapis.com/token"
    token_data = (
        f"client_id={client_id}&client_secret={client_secret}"
        f"&refresh_token={refresh_token}&grant_type=refresh_token"
    ).encode()
    try:
        req = Request(token_url, data=token_data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        with urlopen(req) as resp:
            access_token = json.loads(resp.read().decode())["access_token"]
    except HTTPError as e:
        print(f"Google OAuth error: {e.code}")
        return None

    # GAQL query
    start, end = _date_range(days)
    start_fmt = start.replace("-", "")
    end_fmt = end.replace("-", "")
    query = f"""
        SELECT
            campaign.name,
            ad_group.name,
            ad_group_ad.ad.responsive_search_ad.headlines,
            ad_group_ad.ad.responsive_search_ad.descriptions,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.conversions,
            metrics.cost_micros
        FROM ad_group_ad
        WHERE segments.date BETWEEN '{start_fmt}' AND '{end_fmt}'
            AND ad_group_ad.status != 'REMOVED'
        ORDER BY metrics.impressions DESC
        LIMIT 500
    """

    url = f"https://googleads.googleapis.com/v18/customers/{customer_id}/googleAds:searchStream"
    body = json.dumps({"query": query}).encode()

    try:
        req = Request(url, data=body, method="POST")
        req.add_header("Authorization", f"Bearer {access_token}")
        req.add_header("developer-token", dev_token)
        req.add_header("Content-Type", "application/json")
        with urlopen(req) as resp:
            results = json.loads(resp.read().decode())
    except HTTPError as e:
        print(f"Google Ads API error: {e.code} — {e.read().decode()[:200]}")
        return None

    csv_rows = []
    for batch in results:
        for row in batch.get("results", []):
            campaign = row.get("campaign", {}).get("name", "")
            ad_group = row.get("adGroup", {}).get("name", "")
            ad = row.get("adGroupAd", {}).get("ad", {})
            rsa = ad.get("responsiveSearchAd", {})
            headlines = [h.get("text", "") for h in rsa.get("headlines", [])[:3]]
            descriptions = [d.get("text", "") for d in rsa.get("descriptions", [])[:2]]
            metrics = row.get("metrics", {})
            cost_micros = int(metrics.get("costMicros", 0))

            csv_rows.append({
                "Campaign": campaign,
                "Ad group": ad_group,
                "Headline 1": headlines[0] if headlines else "",
                "Headline 2": headlines[1] if len(headlines) > 1 else "",
                "Headline 3": headlines[2] if len(headlines) > 2 else "",
                "Description 1": descriptions[0] if descriptions else "",
                "Description 2": descriptions[1] if len(descriptions) > 1 else "",
                "Impressions": metrics.get("impressions", 0),
                "Clicks": metrics.get("clicks", 0),
                "CTR": metrics.get("ctr", 0),
                "Avg. CPC": metrics.get("averageCpc", 0),
                "Conversions": metrics.get("conversions", 0),
                "Cost": f"{cost_micros / 1_000_000:.2f}",
            })

    if not csv_rows:
        print("Google Ads API: No data returned.")
        return None

    latest = EXPORTS_DIR / "google-ads-export.csv"
    dated = EXPORTS_DIR / f"google-ads-{_today()}.csv"
    fieldnames = list(csv_rows[0].keys())

    for path in [latest, dated]:
        with open(path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(csv_rows)

    print(f"Google: Exported {len(csv_rows)} ads → {latest}")
    return str(latest)


# ---------------------------------------------------------------------------
# LinkedIn Ads — API Export
# ---------------------------------------------------------------------------

def export_linkedin_api(days: int = 30) -> str | None:
    """Export LinkedIn Ads data via Marketing API. Returns CSV path or None."""
    token = os.getenv("LINKEDIN_ADS_ACCESS_TOKEN")
    account_id = os.getenv("LINKEDIN_ADS_ACCOUNT_ID")

    if not token or not account_id:
        return None

    start, end = _date_range(days)

    # Get campaigns first
    campaigns_url = (
        f"https://api.linkedin.com/rest/adAccounts/{account_id}/adCampaigns"
        f"?q=search&search=(status:(values:List(ACTIVE,PAUSED)))"
    )
    try:
        req = Request(campaigns_url)
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("LinkedIn-Version", "202401")
        req.add_header("X-Restli-Protocol-Version", "2.0.0")
        with urlopen(req) as resp:
            campaigns_data = json.loads(resp.read().decode())
    except HTTPError as e:
        print(f"LinkedIn API error: {e.code} — {e.read().decode()[:200]}")
        return None

    campaigns = campaigns_data.get("elements", [])
    if not campaigns:
        print("LinkedIn API: No campaigns found.")
        return None

    # Get analytics for each campaign
    campaign_ids = [str(c["id"]) for c in campaigns]
    campaign_names = {str(c["id"]): c.get("name", "") for c in campaigns}

    # Analytics endpoint
    start_parts = start.split("-")
    end_parts = end.split("-")
    analytics_url = (
        f"https://api.linkedin.com/rest/adAnalytics"
        f"?q=analytics"
        f"&dateRange=(start:(year:{start_parts[0]},month:{start_parts[1]},day:{start_parts[2]}),"
        f"end:(year:{end_parts[0]},month:{end_parts[1]},day:{end_parts[2]}))"
        f"&timeGranularity=ALL"
        f"&campaigns=List({','.join(f'urn:li:sponsoredCampaign:{cid}' for cid in campaign_ids)})"
        f"&pivot=CAMPAIGN"
        f"&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions"
    )

    try:
        req = Request(analytics_url)
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("LinkedIn-Version", "202401")
        req.add_header("X-Restli-Protocol-Version", "2.0.0")
        with urlopen(req) as resp:
            analytics_data = json.loads(resp.read().decode())
    except HTTPError as e:
        print(f"LinkedIn Analytics API error: {e.code} — {e.read().decode()[:200]}")
        return None

    csv_rows = []
    for elem in analytics_data.get("elements", []):
        campaign_urn = elem.get("pivot", "")
        campaign_id = campaign_urn.split(":")[-1] if ":" in campaign_urn else ""
        impressions = int(elem.get("impressions", 0))
        clicks = int(elem.get("clicks", 0))
        spend = float(elem.get("costInLocalCurrency", 0))
        conversions = int(elem.get("externalWebsiteConversions", 0))

        ctr = f"{(clicks / impressions * 100):.2f}%" if impressions > 0 else "0%"
        cpc = f"{(spend / clicks):.2f}" if clicks > 0 else "0"

        csv_rows.append({
            "Campaign Name": campaign_names.get(campaign_id, campaign_id),
            "Impressions": impressions,
            "Clicks": clicks,
            "CTR": ctr,
            "Average CPC": cpc,
            "Conversions": conversions,
            "Total Spent": f"{spend:.2f}",
        })

    if not csv_rows:
        print("LinkedIn API: No analytics data returned.")
        return None

    latest = EXPORTS_DIR / "linkedin-ads-export.csv"
    dated = EXPORTS_DIR / f"linkedin-ads-{_today()}.csv"
    fieldnames = list(csv_rows[0].keys())

    for path in [latest, dated]:
        with open(path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(csv_rows)

    print(f"LinkedIn: Exported {len(csv_rows)} campaigns → {latest}")
    return str(latest)


# ---------------------------------------------------------------------------
# Browser Fallback
# ---------------------------------------------------------------------------

BROWSER_URLS = {
    "meta": "https://www.facebook.com/adsmanager/manage/",
    "google": "https://ads.google.com/aw/campaigns",
    "linkedin": "https://www.linkedin.com/campaignmanager/",
}

PROFILE_DIRS = {
    "meta": BROWSER_PROFILE_DIR / "meta-ads",
    "google": BROWSER_PROFILE_DIR / "google-ads",
    "linkedin": BROWSER_PROFILE_DIR / "linkedin-ads",
}


def _run_pw(session: str, *args) -> str:
    """Run a playwright-cli command and return output."""
    cmd = ["playwright-cli", f"-s={session}"] + list(args)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return result.stdout + result.stderr


def browser_login(platform: str):
    """Open a headed browser for the user to log in, then save the profile."""
    session = f"{platform}-ads"
    url = BROWSER_URLS[platform]
    profile_dir = PROFILE_DIRS[platform]
    profile_dir.mkdir(parents=True, exist_ok=True)

    print(f"\nOpening {platform.title()} in a browser window...")
    print(f"Please log in manually. I'll save your session when you're done.\n")

    # Open headed browser with persistent profile
    _run_pw(session, "open", url, "--headed", f"--profile={profile_dir}")

    print(f"\nPress Enter once you're logged into {platform.title()} and see the dashboard...")
    input()

    # Save state
    auth_file = f"{platform}-ads-auth.json"
    _run_pw(session, "state-save", auth_file)
    print(f"Session saved to {auth_file}")

    return auth_file


def browser_export(platform: str, days: int = 30) -> str:
    """Open browser and guide user to export CSV. Returns CSV path."""
    session = f"{platform}-ads"
    url = BROWSER_URLS[platform]
    profile_dir = PROFILE_DIRS[platform]

    # Try loading existing profile
    if profile_dir.exists():
        print(f"Loading saved {platform.title()} session...")
        _run_pw(session, "open", url, f"--profile={profile_dir}")
    else:
        print(f"No saved session for {platform.title()}. Starting login flow...")
        browser_login(platform)
        _run_pw(session, "goto", url)

    print(f"\nBrowser is open at {url}")
    print(f"Please navigate to the report view, set date range to last {days} days,")
    print(f"and click Export/Download. The CSV will be saved automatically.\n")

    # Attempt to catch the download
    export_path = EXPORTS_DIR / f"{platform}-ads-export.csv"
    _run_pw(session, "run-code", f"""async page => {{
        const [download] = await Promise.all([
            page.waitForEvent('download', {{ timeout: 120000 }}),
        ]);
        await download.saveAs('{export_path}');
        return 'Downloaded to {export_path}';
    }}""")

    # Also save a dated copy
    dated = EXPORTS_DIR / f"{platform}-ads-{_today()}.csv"
    if export_path.exists():
        import shutil
        shutil.copy2(export_path, dated)

    _run_pw(session, "close")
    print(f"\n{platform.title()}: Export saved to {export_path}")
    return str(export_path)


# ---------------------------------------------------------------------------
# Main Dispatcher
# ---------------------------------------------------------------------------

API_EXPORTERS = {
    "meta": export_meta_api,
    "google": export_google_api,
    "linkedin": export_linkedin_api,
}


def export_platform(platform: str, days: int = 30) -> str | None:
    """Export from a single platform. Tries API first, falls back to browser."""
    print(f"\n{'='*50}")
    print(f"Exporting {platform.upper()} Ads (last {days} days)")
    print(f"{'='*50}")

    # Try API first
    api_fn = API_EXPORTERS.get(platform)
    if api_fn:
        result = api_fn(days)
        if result:
            return result
        print(f"{platform.title()} API: No token or API failed. Falling back to browser...")

    # Browser fallback
    return browser_export(platform, days)


def export_all(days: int = 30) -> dict[str, str | None]:
    """Export from all platforms. Returns {platform: csv_path}."""
    results = {}
    for platform in ["meta", "google", "linkedin"]:
        try:
            results[platform] = export_platform(platform, days)
        except Exception as e:
            print(f"{platform.title()} export failed: {e}")
            results[platform] = None
    return results


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Export ad performance data from ad platforms")
    parser.add_argument("platform", choices=["meta", "google", "linkedin", "all"],
                        help="Which platform to export from")
    parser.add_argument("--days", type=int, default=30, help="Number of days to look back (default: 30)")
    parser.add_argument("--login", action="store_true", help="Force browser login (save session)")
    args = parser.parse_args()

    if args.login:
        if args.platform == "all":
            for p in ["meta", "google", "linkedin"]:
                browser_login(p)
        else:
            browser_login(args.platform)
        return

    if args.platform == "all":
        results = export_all(args.days)
        print(f"\n{'='*50}")
        print("EXPORT SUMMARY")
        print(f"{'='*50}")
        for platform, path in results.items():
            status = f"✓ {path}" if path else "✗ Failed"
            print(f"  {platform.title():12s} {status}")
    else:
        export_platform(args.platform, args.days)


if __name__ == "__main__":
    main()
