"""FastAPI application for LOS/POS Bot.

Endpoints:
  GET  /health       — App Runner health check
  POST /webhook      — HubSpot company.creation webhook (HMAC validated)
  POST /run-batch    — Triggered by EventBridge Scheduler for nightly backfill
  POST /scan         — Ad-hoc single-domain scan (no HubSpot write)
"""

import hashlib
import hmac
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from los_pos_bot import pipeline, writer
from los_pos_bot.hubspot_companies import HubSpotCompanyClient
from los_pos_bot.settings import get_settings

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": "%(message)s"}',
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Truv LOS/POS Bot", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://truv-brain.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Scout-Token"],
)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "service": "los-pos-bot"}


# ---------------------------------------------------------------------------
# Webhook — HubSpot company.creation
# ---------------------------------------------------------------------------

def _verify_hubspot_hmac(
    raw_body: bytes,
    timestamp_str: str,
    received_sig: str,
    method: str,
    uri: str,
) -> bool:
    """Validate HubSpot Signature V3.

    HubSpot signs: METHOD + full_URI + raw_body_string + timestamp_string
    using HMAC-SHA256 with the app's client secret.
    """
    if not settings.webhook_secret:
        logger.warning("LOSPOS_WEBHOOK_SECRET not set — skipping HMAC validation")
        return True

    payload = f"{method}{uri}{raw_body.decode('utf-8', errors='replace')}{timestamp_str}"
    expected = hmac.HMAC(
        settings.webhook_secret.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, received_sig)


@app.post("/webhook")
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hubspot_request_timestamp: Optional[str] = Header(None),
    x_hubspot_signature_v3: Optional[str] = Header(None),
):
    """Receive HubSpot company.creation webhook.

    Security checks (in order):
    1. Body size limit (prevent DoS)
    2. Timestamp replay window (5-minute max)
    3. HMAC-SHA256 signature (V3)

    Processing is async — returns 200 immediately, runs pipeline in background.
    """
    # 1. Read raw bytes BEFORE any JSON parsing (critical for HMAC correctness)
    raw_body = await request.body()

    # 2. Body size guard
    if len(raw_body) > 512_000:
        raise HTTPException(status_code=413, detail="Payload too large")

    # 3. Timestamp replay prevention (reject if > 5 minutes old)
    timestamp_str = x_hubspot_request_timestamp or ""
    if timestamp_str:
        try:
            ts_ms = int(timestamp_str)
            if abs(time.time() * 1000 - ts_ms) > 300_000:
                logger.warning(f"Webhook replay attempt: timestamp={timestamp_str}")
                raise HTTPException(status_code=400, detail="Timestamp too old")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid timestamp header")

    # 4. HMAC validation
    sig = x_hubspot_signature_v3 or ""
    if not _verify_hubspot_hmac(
        raw_body=raw_body,
        timestamp_str=timestamp_str,
        received_sig=sig,
        method="POST",
        uri=str(request.url),
    ):
        logger.warning(f"Invalid HMAC signature from {request.client.host if request.client else 'unknown'}")
        raise HTTPException(status_code=401, detail="Invalid signature")

    # 5. Parse payload and enqueue
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # HubSpot sends an array of subscription events
    events = payload if isinstance(payload, list) else [payload]
    for event in events:
        company_id = str(event.get("objectId") or event.get("companyId") or "")
        if company_id:
            background_tasks.add_task(_process_single_company_by_id, company_id)

    return {"status": "accepted", "events": len(events)}


# ---------------------------------------------------------------------------
# Batch trigger — called by EventBridge Scheduler
# ---------------------------------------------------------------------------

class BatchRequest(BaseModel):
    limit: int = 500
    token: Optional[str] = None


@app.post("/run-batch")
async def run_batch(
    req: BatchRequest,
    background_tasks: BackgroundTasks,
    x_scout_token: Optional[str] = Header(None),
):
    """Trigger nightly backfill of unenriched company records.

    Protected by the same shared token used across Truv services.
    EventBridge Scheduler calls this nightly at 2am CST.
    """
    token = req.token or x_scout_token or ""
    if settings.webhook_secret and not hmac.compare_digest(token, settings.webhook_secret):
        raise HTTPException(status_code=401, detail="Unauthorized")

    limit = min(req.limit, settings.batch_limit_per_run)
    background_tasks.add_task(_run_batch_background, limit)
    return {"status": "started", "limit": limit}


# ---------------------------------------------------------------------------
# List-based batch — scan all companies in a HubSpot list
# ---------------------------------------------------------------------------

class ListBatchRequest(BaseModel):
    list_id: str
    force: bool = False
    token: Optional[str] = None


@app.post("/run-list")
async def run_list_batch(
    req: ListBatchRequest,
    background_tasks: BackgroundTasks,
    x_scout_token: Optional[str] = Header(None),
):
    """Trigger a batch scan for all companies in a HubSpot list.

    Use this to scan a curated list like "Top 250 Lenders".
    Set force=true to re-scan companies that already have LOS/POS data.
    """
    token = req.token or x_scout_token or ""
    if settings.webhook_secret and not hmac.compare_digest(token, settings.webhook_secret):
        raise HTTPException(status_code=401, detail="Unauthorized")

    background_tasks.add_task(_run_list_background, req.list_id, req.force)
    return {"status": "started", "list_id": req.list_id, "force": req.force}


# ---------------------------------------------------------------------------
# Ad-hoc scan — used by the dashboard frontend
# ---------------------------------------------------------------------------

class ScanRequest(BaseModel):
    domain: str
    use_browser: bool = False


@app.post("/scan")
def scan_domain(
    req: ScanRequest,
    x_scout_token: Optional[str] = Header(None),
):
    """Scan a single domain for LOS/POS — no HubSpot write, returns result directly."""
    token = x_scout_token or ""
    if settings.webhook_secret and not hmac.compare_digest(token, settings.webhook_secret):
        raise HTTPException(status_code=401, detail="Unauthorized")
    domain = req.domain.strip()
    if not domain:
        raise HTTPException(status_code=400, detail="domain is required")

    try:
        result = pipeline.run(company_id="adhoc", raw_domain=domain, use_browser=req.use_browser)
    except Exception as e:
        logger.error(f"Scan error for {domain}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "domain": result.domain,
        "los": result.los_platform,
        "pos": result.pos_platform,
        "los_confidence": result.los_confidence,
        "pos_confidence": result.pos_confidence,
        "method": result.detection_method,
        "evidence": result.evidence_lines,
        "errors": result.errors,
        "browser_log": result.browser_log,
    }


# ---------------------------------------------------------------------------
# Background workers
# ---------------------------------------------------------------------------

def _get_client() -> HubSpotCompanyClient:
    return HubSpotCompanyClient(api_token=settings.hubspot_api_token)


def _process_single_company_by_id(company_id: str) -> None:
    """Fetch a single company by ID and run the detection pipeline."""
    client = _get_client()
    try:
        company = client.get_company(
            company_id,
            properties=["name", "domain", "website", "los_pos_manually_corrected"],
        )
    except Exception as e:
        logger.error(f"[{company_id}] Failed to fetch company: {e}")
        return

    _process_company(client, company)


def _process_company(client: HubSpotCompanyClient, company: dict) -> None:
    """Run pipeline + write for one company dict."""
    company_id = company.get("id", "")
    if not company_id:
        return

    # Skip if a rep has manually corrected this record
    if client.is_manually_corrected(company):
        logger.info(f"[{company_id}] Skipping — manually corrected")
        return

    raw_domain = client.get_domain_from_company(company)
    if not raw_domain:
        logger.warning(f"[{company_id}] No domain — skipping")
        return

    result = pipeline.run(company_id=company_id, raw_domain=raw_domain)

    writer.write_result(
        client=client,
        result=result,
        review_list_id=settings.hubspot_review_list_id,
    )


def _run_batch_background(limit: int) -> None:
    """Fetch unenriched companies and process them with bounded concurrency."""
    client = _get_client()
    companies = list(client.get_unenriched_companies(limit=limit))
    logger.info(f"Batch run: {len(companies)} companies to process")

    max_workers = settings.max_concurrent_domains
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(_process_company, client, co): co.get("id", "?")
            for co in companies
        }
        completed = 0
        for future in as_completed(futures):
            cid = futures[future]
            try:
                future.result()
            except Exception as e:
                logger.error(f"[{cid}] Unhandled error in batch: {e}")
            completed += 1
            if completed % 25 == 0:
                logger.info(f"Batch progress: {completed}/{len(companies)}")

    logger.info(f"Batch run complete: {len(companies)} companies processed")


def _run_list_background(list_id: str, force: bool = False) -> None:
    """Fetch all companies in a HubSpot list and run the detection pipeline."""
    client = _get_client()
    from los_pos_bot.hubspot_companies import COMPANY_PROPERTIES

    # Fetch list memberships
    company_ids: list[str] = []
    after = None
    while True:
        params: dict = {"limit": 100}
        if after:
            params["after"] = after
        try:
            resp = client.get(f"/crm/v3/lists/{list_id}/memberships", params=params)
        except Exception as e:
            logger.error(f"Failed to fetch list {list_id} memberships: {e}")
            return
        results = resp.get("results", [])
        for r in results:
            rid = str(r) if isinstance(r, (str, int)) else str(r.get("recordId", r.get("vid", "")))
            if rid:
                company_ids.append(rid)
        after = resp.get("paging", {}).get("next", {}).get("after")
        if not after or not results:
            break

    logger.info(f"List {list_id}: {len(company_ids)} companies to process (force={force})")

    found = unknown = skipped = 0
    for i, cid in enumerate(company_ids, 1):
        try:
            company = client.get_company(cid, properties=COMPANY_PROPERTIES)
        except Exception as e:
            logger.error(f"[{cid}] Failed to fetch company: {e}")
            skipped += 1
            continue

        if client.is_manually_corrected(company):
            skipped += 1
            continue

        props = company.get("properties", {})
        if not force and props.get("los_platform") and props["los_platform"] != "Unknown":
            skipped += 1
            continue

        raw_domain = client.get_domain_from_company(company)
        if not raw_domain:
            skipped += 1
            continue

        result = pipeline.run(company_id=cid, raw_domain=raw_domain)
        if result.found:
            found += 1
        else:
            unknown += 1

        writer.write_result(
            client=client,
            result=result,
            review_list_id=settings.hubspot_review_list_id,
        )

        if i % 25 == 0:
            logger.info(f"List {list_id} progress: {i}/{len(company_ids)}")

    logger.info(
        f"List {list_id} complete: {found} found | {unknown} unknown | "
        f"{skipped} skipped | {len(company_ids)} total"
    )
