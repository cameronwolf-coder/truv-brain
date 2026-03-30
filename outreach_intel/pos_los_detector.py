"""POS/LOS Tech Stack Detector for Mortgage Lenders.

Detects which Point-of-Sale (POS) and Loan Origination System (LOS)
a mortgage lender uses by analyzing their website, DNS records, and
borrower portal redirects.

Detection layers:
  1. DNS CNAME analysis on apply/portal subdomains
  2. HTTP redirect chain following on application URLs
  3. HTML content scanning on main site and portal pages
  4. SSL certificate inspection
  5. Firecrawl: map → rawHtml scrape + regex → web search fallback
"""

import csv
import dns.resolver
import io
import json
import logging
import os
import re
import socket
import ssl
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field, asdict
from typing import Optional
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Vendor fingerprint database
# ---------------------------------------------------------------------------

@dataclass
class VendorFingerprint:
    name: str
    category: str  # "pos", "los", or "both"
    # DNS CNAME patterns (regex matched against CNAME targets)
    cname_patterns: list[str] = field(default_factory=list)
    # URL redirect patterns (regex matched against final redirect URL)
    redirect_patterns: list[str] = field(default_factory=list)
    # HTML patterns (regex matched against page source)
    html_patterns: list[str] = field(default_factory=list)
    # SSL CN patterns (regex matched against certificate CN)
    ssl_patterns: list[str] = field(default_factory=list)


VENDOR_FINGERPRINTS = [
    VendorFingerprint(
        name="Blend",
        category="pos",
        cname_patterns=[r"blend\.com", r"blendlabs\.com"],
        redirect_patterns=[r"blend\.com", r"app\.blend\.com"],
        html_patterns=[
            r"blend\.com/borrower",
            r"blend-sdk",
            r"blendlabs\.com",
            r'src="[^"]*blend[^"]*\.js"',
            r"Powered by Blend",
        ],
    ),
    VendorFingerprint(
        name="Floify",
        category="pos",
        cname_patterns=[r"floify\.com"],
        redirect_patterns=[r"floify\.com"],
        html_patterns=[
            r"floify\.com/s/",
            r"floify\.com",
            r'iframe[^>]*floify',
            r"Floify",
        ],
    ),
    VendorFingerprint(
        name="Encompass Consumer Connect",
        category="pos",
        cname_patterns=[
            r"icemortgagetechnology\.com",
            r"elliemae\.com",
            r"encompass",
        ],
        redirect_patterns=[
            r"icemortgagetechnology\.com",
            r"elliemae\.com",
            r"encompass",
        ],
        html_patterns=[
            r"encompass\.icemortgagetechnology\.com",
            r"elliemae\.com",
            r"Encompass Consumer Connect",
            r"ICE Mortgage Technology",
            r"emortgage",
        ],
        ssl_patterns=[r"icemortgagetechnology\.com", r"elliemae\.com"],
    ),
    VendorFingerprint(
        name="Encompass",
        category="los",
        cname_patterns=[r"icemortgagetechnology\.com", r"elliemae\.com"],
        redirect_patterns=[],
        html_patterns=[
            r"Encompass",
            r"ICE Mortgage Technology",
            r"Ellie Mae",
        ],
    ),
    VendorFingerprint(
        name="SimpleNexus/nCino",
        category="pos",
        cname_patterns=[r"simplenexus\.com", r"ncino\.com", r"loanlauncher\.com"],
        redirect_patterns=[r"simplenexus\.com", r"ncino\.com", r"loanlauncher\.com"],
        html_patterns=[
            r"loanlauncher\.com",
            r"simplenexus\.com",
            r"nCino",
            r"SimpleNexus",
            r"simple-nexus",
        ],
    ),
    VendorFingerprint(
        name="MeridianLink",
        category="los",
        cname_patterns=[r"meridianlink\.com", r"openclose\.com"],
        redirect_patterns=[r"meridianlink\.com", r"openclose\.com"],
        html_patterns=[
            r"meridianlink\.com",
            r"openclose\.com",
            r"MeridianLink",
            r"OpenClose",
        ],
    ),
    VendorFingerprint(
        name="Calyx",
        category="los",
        cname_patterns=[r"calyxsoftware\.com", r"calyx\.com"],
        redirect_patterns=[r"calyxsoftware\.com", r"calyx\.com"],
        html_patterns=[
            r"calyxsoftware\.com",
            r"Calyx Point",
            r"Calyx Path",
            r"Calyx Software",
        ],
    ),
    VendorFingerprint(
        name="LendingPad",
        category="los",
        cname_patterns=[r"lendingpad\.com"],
        redirect_patterns=[r"lendingpad\.com"],
        html_patterns=[
            r"lendingpad\.com",
            r"LendingPad",
        ],
    ),
    VendorFingerprint(
        name="Byte Software",
        category="los",
        cname_patterns=[r"bytesoftware\.com"],
        redirect_patterns=[r"bytesoftware\.com"],
        html_patterns=[
            r"bytesoftware\.com",
            r"Byte Software",
            r"BytePro",
        ],
    ),
    VendorFingerprint(
        name="MortgageFlex",
        category="los",
        cname_patterns=[r"mortgageflex\.com"],
        redirect_patterns=[r"mortgageflex\.com"],
        html_patterns=[
            r"mortgageflex\.com",
            r"MortgageFlex",
        ],
    ),
    VendorFingerprint(
        name="Black Knight/LoanSphere",
        category="los",
        cname_patterns=[r"blackknightinc\.com", r"bkfs\.com"],
        redirect_patterns=[r"blackknightinc\.com", r"bkfs\.com"],
        html_patterns=[
            r"Black Knight",
            r"LoanSphere",
            r"Empower LOS",
            r"blackknightinc\.com",
        ],
    ),
    VendorFingerprint(
        name="Mortgage Cadence",
        category="los",
        cname_patterns=[r"mortgagecadence\.com", r"accenture\.com"],
        redirect_patterns=[r"mortgagecadence\.com"],
        html_patterns=[
            r"Mortgage Cadence",
            r"mortgagecadence\.com",
        ],
    ),
    VendorFingerprint(
        name="BeSmartee",
        category="pos",
        cname_patterns=[r"besmartee\.com"],
        redirect_patterns=[r"besmartee\.com"],
        html_patterns=[
            r"besmartee\.com",
            r"BeSmartee",
        ],
    ),
    VendorFingerprint(
        name="Maxwell",
        category="pos",
        cname_patterns=[r"himaxwell\.com"],
        redirect_patterns=[r"himaxwell\.com"],
        html_patterns=[
            r"himaxwell\.com",
            r"Maxwell Financial Labs",
            r"Maxwell",
        ],
    ),
    VendorFingerprint(
        name="Roostify",
        category="pos",
        cname_patterns=[r"roostify\.com"],
        redirect_patterns=[r"roostify\.com"],
        html_patterns=[
            r"roostify\.com",
            r"Roostify",
        ],
    ),
    VendorFingerprint(
        name="Total Expert",
        category="both",
        cname_patterns=[r"totalexpert\.com"],
        redirect_patterns=[r"totalexpert\.com"],
        html_patterns=[
            r"totalexpert\.com",
            r"Total Expert",
            r"total-expert",
        ],
    ),
    VendorFingerprint(
        name="Optimal Blue",
        category="los",
        cname_patterns=[r"optimalblue\.com"],
        redirect_patterns=[r"optimalblue\.com"],
        html_patterns=[
            r"optimalblue\.com",
            r"Optimal Blue",
        ],
    ),
    VendorFingerprint(
        name="LoanDepot/mello",
        category="pos",
        cname_patterns=[r"mello\.com", r"loandepot\.com"],
        redirect_patterns=[r"mello\.com"],
        html_patterns=[
            r"mello\.com",
            r"melloHome",
            r"mello smartloan",
        ],
    ),
    VendorFingerprint(
        name="Sagent",
        category="los",
        cname_patterns=[r"sagent\.com", r"loanserv\.com"],
        redirect_patterns=[r"sagent\.com"],
        html_patterns=[
            r"sagent\.com",
            r"Sagent Lending",
            r"LoanServ",
        ],
    ),
    VendorFingerprint(
        name="Finastra/Mortgagebot",
        category="pos",
        cname_patterns=[r"mortgagebot\.com", r"finastra\.com"],
        redirect_patterns=[r"mortgagebot\.com", r"finastra\.com"],
        html_patterns=[
            r"mortgagebot\.com",
            r"Mortgagebot",
            r"Finastra",
        ],
    ),
]


# Subdomains to probe for borrower portals
PORTAL_SUBDOMAINS = [
    "apply", "portal", "borrower", "app", "loan", "mortgage", "start",
    "lending", "home", "myloans", "loanapp", "secure", "digital",
    "homeloans", "pos", "myaccount", "online", "loans", "homeloan",
]

# ---------------------------------------------------------------------------
# Script src / CDN / copyright fingerprints for rawHtml detection
# ---------------------------------------------------------------------------

# Patterns matched against <script src>, <link href>, <iframe src> attributes
SCRIPT_SRC_FINGERPRINTS: dict[str, list[str]] = {
    "Blend": [
        r"cdn\.(?:prod\.)?blend\.com",
        r"pixel\..*\.blend\.com",
        r"ai-assistant\.blend\.com",
        r"static\.blend\.com",
    ],
    "Floify": [
        r"(?:cdn|static|app)\.floify\.com",
    ],
    "Encompass Consumer Connect": [
        r"(?:cdn|static)\.icemortgagetechnology\.com",
        r"elliemae\.com/static",
        r"encompass\.icemortgagetechnology\.com",
    ],
    "SimpleNexus/nCino": [
        r"(?:cdn|static|app)\.simplenexus\.com",
        r"(?:cdn|static)\.ncino\.com",
        r"loanlauncher\.com/static",
    ],
    "BeSmartee": [
        r"(?:cdn|static|app)\.besmartee\.com",
    ],
    "Total Expert": [
        r"(?:cdn|static|app)\.totalexpert\.com",
    ],
    "Roostify": [
        r"(?:cdn|static|app)\.roostify\.com",
    ],
    "Maxwell": [
        r"(?:cdn|static|app)\.himaxwell\.com",
    ],
    "MeridianLink": [
        r"(?:cdn|static|app)\.meridianlink\.com",
        r"(?:cdn|static)\.openclose\.com",
    ],
    "Finastra/Mortgagebot": [
        r"(?:cdn|static|app)\.mortgagebot\.com",
        r"(?:cdn|static)\.finastra\.com",
    ],
    "LoanDepot/mello": [
        r"(?:cdn|static|app)\.mello\.com",
    ],
    "Calyx": [
        r"(?:cdn|static)\.calyxsoftware\.com",
        r"(?:cdn|static)\.calyx\.com",
    ],
    "Black Knight/LoanSphere": [
        r"(?:cdn|static)\.blackknightinc\.com",
        r"(?:cdn|static)\.bkfs\.com",
    ],
}

# Patterns matched against HTML comments, inline <script> blocks, and legal text
COPYRIGHT_PATTERNS: dict[str, list[str]] = {
    "Blend": [
        r"Blend Labs,?\s*Inc",
        r"Blend Confidential",
        r"Powered by Blend",
    ],
    "Encompass Consumer Connect": [
        r"ICE Mortgage Technology.*All rights reserved",
        r"Ellie Mae.*All rights reserved",
    ],
    "Floify": [r"Floify.*All rights reserved"],
    "SimpleNexus/nCino": [r"SimpleNexus.*All rights reserved", r"nCino.*All rights reserved"],
    "Roostify": [r"Roostify.*All rights reserved"],
    "BeSmartee": [r"BeSmartee.*All rights reserved"],
    "Maxwell": [r"Maxwell Financial Labs"],
    "Total Expert": [r"Total Expert.*All rights reserved"],
}

# Config / inline-script patterns (JSON config blobs, feature flags, etc.)
CONFIG_PATTERNS: dict[str, list[str]] = {
    "Blend": [
        r"CDN_URL.*blend\.com",
        r"PIXEL_HOST.*blend\.com",
        r"blend\.com/borrower",
        r'"blendConfig"',
    ],
    "Encompass Consumer Connect": [
        r"encompass\.icemortgagetechnology\.com",
        r"icemortgagetechnology\.com/prequal",
    ],
    "Floify": [r"floify\.com/s/"],
    "SimpleNexus/nCino": [r"loanlauncher\.com/apply"],
}

# False-positive filter patterns — matches that look like a vendor name but aren't
FALSE_POSITIVE_PATTERNS: dict[str, list[re.Pattern]] = {
    "blend": [
        re.compile(r"(?:mix-)?blend-mode", re.IGNORECASE),
        re.compile(r"background-blend", re.IGNORECASE),
        re.compile(r"blending_mode", re.IGNORECASE),
        re.compile(r"/blended?-(?:rate|learning|family)", re.IGNORECASE),
    ],
    "maxwell": [
        re.compile(r"maxwell\s+house", re.IGNORECASE),
    ],
}


def _is_false_positive(vendor_name: str, match_context: str) -> bool:
    """Check if a regex match is a known false positive."""
    key = vendor_name.lower().split("/")[0].split("(")[0].strip()
    for fp_pattern in FALSE_POSITIVE_PATTERNS.get(key, []):
        if fp_pattern.search(match_context):
            return True
    return False

# ---------------------------------------------------------------------------
# Detection result
# ---------------------------------------------------------------------------

@dataclass
class Detection:
    vendor: str
    category: str  # pos, los, both
    confidence: str  # high, medium, low
    method: str  # dns, redirect, html, ssl
    evidence: str


@dataclass
class DomainResult:
    domain: str
    pos_detected: list[str] = field(default_factory=list)
    los_detected: list[str] = field(default_factory=list)
    detections: list[Detection] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    browser_log: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "domain": self.domain,
            "pos": list(set(self.pos_detected)),
            "los": list(set(self.los_detected)),
            "detections": [asdict(d) for d in self.detections],
            "errors": self.errors,
            "browser_log": self.browser_log,
        }


# ---------------------------------------------------------------------------
# Layer 1: DNS CNAME analysis
# ---------------------------------------------------------------------------

def check_dns_cnames(domain: str) -> list[Detection]:
    """Check CNAME records on portal subdomains for vendor fingerprints."""
    detections = []
    resolver = dns.resolver.Resolver()
    resolver.timeout = 5
    resolver.lifetime = 5

    for sub in PORTAL_SUBDOMAINS:
        fqdn = f"{sub}.{domain}"
        try:
            answers = resolver.resolve(fqdn, "CNAME")
            for rdata in answers:
                cname_target = str(rdata.target).rstrip(".")
                for fp in VENDOR_FINGERPRINTS:
                    for pattern in fp.cname_patterns:
                        if re.search(pattern, cname_target, re.IGNORECASE):
                            detections.append(Detection(
                                vendor=fp.name,
                                category=fp.category,
                                confidence="high",
                                method="dns",
                                evidence=f"{fqdn} CNAME -> {cname_target}",
                            ))
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer,
                dns.resolver.NoNameservers, dns.resolver.LifetimeTimeout,
                dns.exception.DNSException):
            continue
    return detections


# ---------------------------------------------------------------------------
# Layer 2: HTTP redirect chain analysis
# ---------------------------------------------------------------------------

def check_redirect_chains(domain: str) -> list[Detection]:
    """Follow redirect chains on portal subdomains to detect vendor hosting."""
    detections = []
    session = requests.Session()
    session.headers["User-Agent"] = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )

    for sub in PORTAL_SUBDOMAINS:
        for scheme in ["https", "http"]:
            url = f"{scheme}://{sub}.{domain}"
            try:
                resp = session.get(url, timeout=10, allow_redirects=True)
                final_url = resp.url
                # Check all URLs in the redirect chain
                chain_urls = [r.url for r in resp.history] + [final_url]

                for chain_url in chain_urls:
                    for fp in VENDOR_FINGERPRINTS:
                        for pattern in fp.redirect_patterns:
                            if re.search(pattern, chain_url, re.IGNORECASE):
                                detections.append(Detection(
                                    vendor=fp.name,
                                    category=fp.category,
                                    confidence="high",
                                    method="redirect",
                                    evidence=f"{url} -> {final_url}",
                                ))
                break  # https worked, skip http
            except (requests.RequestException, ConnectionError):
                continue
    return detections


# ---------------------------------------------------------------------------
# Layer 3: HTML content scanning
# ---------------------------------------------------------------------------

def check_html_content(domain: str) -> list[Detection]:
    """Scan main site and portal pages for vendor-specific patterns."""
    detections = []
    session = requests.Session()
    session.headers["User-Agent"] = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )

    urls_to_check = [f"https://{domain}"]
    for sub in PORTAL_SUBDOMAINS:
        urls_to_check.append(f"https://{sub}.{domain}")
    # Also check common apply paths on the main domain
    for path in ["/apply", "/borrower", "/start-application", "/get-started",
                  "/apply-now", "/mortgage-application", "/home-loans",
                  "/start-your-loan", "/prequalify", "/get-prequalified"]:
        urls_to_check.append(f"https://{domain}{path}")

    seen_vendors = set()
    for url in urls_to_check:
        try:
            resp = session.get(url, timeout=10, allow_redirects=True)
            if resp.status_code != 200:
                continue
            html = resp.text[:200_000]  # Cap to avoid huge pages

            for fp in VENDOR_FINGERPRINTS:
                if fp.name in seen_vendors:
                    continue
                for pattern in fp.html_patterns:
                    match = re.search(pattern, html, re.IGNORECASE)
                    if match:
                        # HTML matches are lower confidence — vendor name
                        # in marketing copy doesn't mean they use it
                        confidence = "medium"
                        # But specific script/iframe patterns are higher
                        if any(kw in pattern for kw in ["src=", "iframe", r"\.", "sdk"]):
                            confidence = "high"
                        detections.append(Detection(
                            vendor=fp.name,
                            category=fp.category,
                            confidence=confidence,
                            method="html",
                            evidence=f"Pattern '{pattern}' matched in {url}",
                        ))
                        seen_vendors.add(fp.name)
                        break
        except (requests.RequestException, ConnectionError):
            continue
    return detections


# ---------------------------------------------------------------------------
# Layer 4: SSL certificate inspection
# ---------------------------------------------------------------------------

def check_ssl_certs(domain: str) -> list[Detection]:
    """Check SSL certificate CN on portal subdomains for vendor domains."""
    detections = []
    for sub in PORTAL_SUBDOMAINS:
        hostname = f"{sub}.{domain}"
        try:
            ctx = ssl.create_default_context()
            with ctx.wrap_socket(socket.socket(), server_hostname=hostname) as s:
                s.settimeout(5)
                s.connect((hostname, 443))
                cert = s.getpeercert()
                subject = dict(x[0] for x in cert.get("subject", ()))
                cn = subject.get("commonName", "")
                # Also check SAN
                san_list = []
                for entry_type, entry_value in cert.get("subjectAltName", ()):
                    if entry_type == "DNS":
                        san_list.append(entry_value)

                all_names = [cn] + san_list
                for name in all_names:
                    for fp in VENDOR_FINGERPRINTS:
                        for pattern in fp.ssl_patterns:
                            if re.search(pattern, name, re.IGNORECASE):
                                detections.append(Detection(
                                    vendor=fp.name,
                                    category=fp.category,
                                    confidence="high",
                                    method="ssl",
                                    evidence=f"{hostname} cert CN/SAN includes '{name}'",
                                ))
        except (socket.timeout, socket.gaierror, ssl.SSLError,
                ConnectionRefusedError, OSError):
            continue
    return detections


# ---------------------------------------------------------------------------
# Layer 5: Firecrawl rawHtml scrape + regex detection (no LLM)
# ---------------------------------------------------------------------------

# Build a vendor→category lookup from fingerprints
_VENDOR_CATEGORY: dict[str, str] = {fp.name: fp.category for fp in VENDOR_FINGERPRINTS}


def _match_raw_html(html: str, url: str) -> list[Detection]:
    """Match vendor fingerprints against raw HTML content.

    Scans script src, link href, iframe src, copyright comments, config
    blobs, and inline scripts for vendor-specific patterns. Filters out
    known false positives (CSS blend-mode, URL path coincidences, etc.).
    """
    detections: list[Detection] = []
    seen_vendors: set[str] = set()

    # --- Pass 1: script src / link href / iframe src attributes ---
    attr_matches = re.findall(
        r'(?:src|href)\s*=\s*["\']([^"\']+)["\']', html, re.IGNORECASE
    )
    for vendor, patterns in SCRIPT_SRC_FINGERPRINTS.items():
        if vendor in seen_vendors:
            continue
        for attr_val in attr_matches:
            for pattern in patterns:
                if re.search(pattern, attr_val, re.IGNORECASE):
                    # Grab context around the match for false-positive check
                    if not _is_false_positive(vendor, attr_val):
                        detections.append(Detection(
                            vendor=vendor,
                            category=_VENDOR_CATEGORY.get(vendor, "pos"),
                            confidence="high",
                            method="firecrawl_html",
                            evidence=f"[rawHtml] Script/link src '{attr_val}' on {url}",
                        ))
                        seen_vendors.add(vendor)
                        break
            if vendor in seen_vendors:
                break

    # --- Pass 2: copyright / legal text in HTML comments and body ---
    for vendor, patterns in COPYRIGHT_PATTERNS.items():
        if vendor in seen_vendors:
            continue
        for pattern in patterns:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                context = html[max(0, match.start() - 30):match.end() + 30]
                if not _is_false_positive(vendor, context):
                    detections.append(Detection(
                        vendor=vendor,
                        category=_VENDOR_CATEGORY.get(vendor, "pos"),
                        confidence="high",
                        method="firecrawl_html",
                        evidence=f"[rawHtml] Copyright/legal: '{match.group()}' on {url}",
                    ))
                    seen_vendors.add(vendor)
                    break

    # --- Pass 3: config / inline-script patterns ---
    for vendor, patterns in CONFIG_PATTERNS.items():
        if vendor in seen_vendors:
            continue
        for pattern in patterns:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                context = html[max(0, match.start() - 30):match.end() + 30]
                if not _is_false_positive(vendor, context):
                    detections.append(Detection(
                        vendor=vendor,
                        category=_VENDOR_CATEGORY.get(vendor, "pos"),
                        confidence="high",
                        method="firecrawl_html",
                        evidence=f"[rawHtml] Config pattern: '{match.group()}' on {url}",
                    ))
                    seen_vendors.add(vendor)
                    break

    return detections


def _match_links(links: list[str], domain: str) -> list[Detection]:
    """Match vendor domains in discovered page links."""
    detections: list[Detection] = []
    seen_vendors: set[str] = set()
    for link in links:
        for fp in VENDOR_FINGERPRINTS:
            if fp.name in seen_vendors:
                continue
            for pattern in fp.redirect_patterns:
                if re.search(pattern, link, re.IGNORECASE):
                    # Skip links that are on the lender's own domain
                    if domain in link:
                        continue
                    if not _is_false_positive(fp.name, link):
                        detections.append(Detection(
                            vendor=fp.name,
                            category=fp.category,
                            confidence="medium",
                            method="firecrawl_link",
                            evidence=f"[Links] Vendor URL '{link}' found on {domain}",
                        ))
                        seen_vendors.add(fp.name)
                        break
    return detections


def _search_fallback(domain: str, company_name: str | None = None) -> list[Detection]:
    """Web search fallback for white-labeled portals invisible to HTML scanning."""
    from outreach_intel.firecrawl_client import FirecrawlClient

    client = FirecrawlClient()
    if not client.available:
        return []

    name = company_name or domain.split(".")[0].replace("-", " ").title()
    query = f'"{name}" mortgage "loan origination system" OR "POS" OR "point of sale" vendor technology'
    results = client.search(query, limit=5)

    detections: list[Detection] = []
    seen_vendors: set[str] = set()
    for result in results:
        text = f"{result.title} {result.description} {result.markdown[:3000]}"
        for fp in VENDOR_FINGERPRINTS:
            if fp.name in seen_vendors:
                continue
            # Look for strong signals: "[lender] uses [vendor]", "[lender] partners with [vendor]"
            usage_patterns = [
                rf"(?:uses?|using|powered by|built on|deployed|implemented|selected|chose|partners? with)\s+{re.escape(fp.name)}",
                rf"{re.escape(fp.name)}\s+(?:customer|client|partner|user|deployment|implementation)",
            ]
            for pattern in usage_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    detections.append(Detection(
                        vendor=fp.name,
                        category=fp.category,
                        confidence="medium",
                        method="firecrawl_search",
                        evidence=f"[Search] '{result.title}' ({result.url})",
                    ))
                    seen_vendors.add(fp.name)
                    break
    return detections


def detect_firecrawl(domain: str) -> list[Detection]:
    """Detect POS/LOS vendors via Firecrawl: map → rawHtml scrape → search fallback.

    Three-step pipeline that replaces the old LLM-based approach:
      1. Map the domain to discover portal/apply URLs
      2. Scrape apply URLs with rawHtml and regex-match vendor fingerprints
      3. Fall back to web search for white-labeled portals
    """
    from outreach_intel.firecrawl_client import FirecrawlClient

    client = FirecrawlClient()
    if not client.available:
        logger.warning("No FIRECRAWL_API_KEY set — skipping Firecrawl layer")
        return []

    all_detections: list[Detection] = []

    # --- Step 1: Discover portal URLs via map ---
    portal_urls: list[str] = []
    try:
        map_result = client.map(
            f"https://{domain}",
            search="apply portal borrower login mortgage application",
            limit=20,
        )
        for url in map_result.urls:
            lower = url.lower()
            if any(kw in lower for kw in ["apply", "portal", "borrower", "login", "app", "mortgage"]):
                portal_urls.append(url)
    except Exception as e:
        logger.warning(f"Firecrawl map failed for {domain}: {e}")

    # Also try well-known subdomains (may not appear in sitemap)
    for sub in PORTAL_SUBDOMAINS[:5]:
        candidate = f"https://{sub}.{domain}"
        if candidate not in portal_urls:
            portal_urls.append(candidate)

    # Always include homepage
    homepage = f"https://{domain}"
    if homepage not in portal_urls:
        portal_urls.insert(0, homepage)

    # --- Step 2: rawHtml scrape + regex matching ---
    pages_scraped = 0
    max_pages = 4  # homepage + up to 3 portal pages

    for url in portal_urls:
        if pages_scraped >= max_pages:
            break

        result = client.scrape(
            url,
            formats=["rawHtml", "links"],
            only_main_content=False,
            timeout=20,
            wait_for=5000,
        )

        if result.error:
            logger.debug(f"Firecrawl scrape failed for {url}: {result.error}")
            continue

        pages_scraped += 1

        # Match vendor fingerprints in rawHtml
        if result.raw_html:
            html_detections = _match_raw_html(result.raw_html, url)
            all_detections.extend(html_detections)

        # Match vendor domains in links
        if result.links:
            link_detections = _match_links(result.links, domain)
            all_detections.extend(link_detections)

        # Early exit if we already found vendors
        if all_detections:
            logger.info(f"Firecrawl found {len(all_detections)} vendor(s) for {domain} after {pages_scraped} page(s)")
            return all_detections

    # --- Step 3: Web search fallback ---
    if not all_detections:
        logger.info(f"No vendors found in HTML for {domain}, trying web search fallback")
        search_detections = _search_fallback(domain)
        all_detections.extend(search_detections)

    if all_detections:
        logger.info(f"Firecrawl detected {len(all_detections)} vendor(s) for {domain}")
    else:
        logger.info(f"Firecrawl found no vendors for {domain}")

    return all_detections


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def detect_tech_stack(domain: str, use_browser: bool = False) -> DomainResult:
    """Run all detection layers against a single domain.

    Args:
        domain: The lender's root domain (e.g., "flagstar.com")
        use_browser: Ignored (kept for backward compatibility).

    Returns:
        DomainResult with all detections, deduplicated by vendor.
    """
    domain = domain.strip().lower()
    # Strip protocol if provided
    if "://" in domain:
        domain = urlparse(domain).netloc or domain
    # Strip www
    if domain.startswith("www."):
        domain = domain[4:]

    result = DomainResult(domain=domain)
    all_detections: list[Detection] = []

    # Run layers in order: fast/free first, then Firecrawl rawHtml + search
    layers = [
        ("dns", check_dns_cnames),
        ("redirect", check_redirect_chains),
        ("html", check_html_content),
        ("ssl", check_ssl_certs),
        ("firecrawl", detect_firecrawl),
    ]

    for layer_name, layer_fn in layers:
        try:
            detections = layer_fn(domain)
            all_detections.extend(detections)
        except Exception as e:
            result.errors.append(f"{layer_name}: {e}")
            logger.warning(f"Layer {layer_name} failed for {domain}: {e}")

    # Deduplicate: keep highest confidence per vendor
    best_by_vendor: dict[str, Detection] = {}
    confidence_rank = {"high": 3, "medium": 2, "low": 1}
    for det in all_detections:
        existing = best_by_vendor.get(det.vendor)
        if not existing or confidence_rank.get(det.confidence, 0) > confidence_rank.get(existing.confidence, 0):
            best_by_vendor[det.vendor] = det

    result.detections = list(best_by_vendor.values())

    for det in result.detections:
        if det.category in ("pos", "both"):
            result.pos_detected.append(det.vendor)
        if det.category in ("los", "both"):
            result.los_detected.append(det.vendor)

    # Deduplicate lists
    result.pos_detected = list(set(result.pos_detected))
    result.los_detected = list(set(result.los_detected))

    return result


def detect_batch(
    domains: list[str],
    max_workers: int = 5,
    progress_callback: Optional[callable] = None,
) -> list[DomainResult]:
    """Run detection across multiple domains in parallel.

    Args:
        domains: List of root domains to scan.
        max_workers: Concurrency limit.
        progress_callback: Optional fn(completed, total, domain, result) called per domain.

    Returns:
        List of DomainResult objects.
    """
    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_domain = {
            executor.submit(detect_tech_stack, d): d for d in domains
        }
        for i, future in enumerate(as_completed(future_to_domain)):
            domain = future_to_domain[future]
            try:
                result = future.result()
            except Exception as e:
                result = DomainResult(domain=domain, errors=[str(e)])
            results.append(result)
            if progress_callback:
                progress_callback(i + 1, len(domains), domain, result)
    return results


def results_to_csv(results: list[DomainResult]) -> str:
    """Convert results to CSV string for export."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["domain", "pos_detected", "los_detected", "confidence", "methods", "evidence"])
    for r in results:
        pos = "; ".join(r.pos_detected) if r.pos_detected else ""
        los = "; ".join(r.los_detected) if r.los_detected else ""
        confidences = "; ".join(d.confidence for d in r.detections) if r.detections else ""
        methods = "; ".join(set(d.method for d in r.detections)) if r.detections else ""
        evidence = " | ".join(d.evidence for d in r.detections) if r.detections else ""
        writer.writerow([r.domain, pos, los, confidences, methods, evidence])
    return output.getvalue()


# ---------------------------------------------------------------------------
# CLI entry point (also wired into outreach_intel/cli.py)
# ---------------------------------------------------------------------------

def main():
    """Standalone CLI: python -m outreach_intel.pos_los_detector domain1.com domain2.com"""
    import argparse

    parser = argparse.ArgumentParser(description="Detect POS/LOS tech stack for mortgage lenders")
    parser.add_argument("domains", nargs="*", help="Domains to scan")
    parser.add_argument("--file", "-f", help="File with one domain per line")
    parser.add_argument("--output", "-o", choices=["json", "csv", "table"], default="table")
    parser.add_argument("--workers", "-w", type=int, default=5, help="Parallel workers")
    args = parser.parse_args()

    domains = list(args.domains) if args.domains else []
    if args.file:
        with open(args.file) as f:
            domains.extend(line.strip() for line in f if line.strip())

    if not domains:
        parser.error("Provide domains as arguments or via --file")

    def on_progress(completed, total, domain, result):
        pos = ", ".join(result.pos_detected) or "none"
        los = ", ".join(result.los_detected) or "none"
        print(f"[{completed}/{total}] {domain}: POS={pos} LOS={los}")

    results = detect_batch(domains, max_workers=args.workers, progress_callback=on_progress)

    if args.output == "json":
        print(json.dumps([r.to_dict() for r in results], indent=2))
    elif args.output == "csv":
        print(results_to_csv(results))
    else:
        # Table output
        print(f"\n{'Domain':<30} {'POS':<30} {'LOS':<30} {'Methods':<20}")
        print("-" * 110)
        for r in results:
            pos = ", ".join(r.pos_detected) or "-"
            los = ", ".join(r.los_detected) or "-"
            methods = ", ".join(set(d.method for d in r.detections)) or "-"
            print(f"{r.domain:<30} {pos:<30} {los:<30} {methods:<20}")
        print(f"\nScanned {len(results)} domains. "
              f"{sum(1 for r in results if r.pos_detected or r.los_detected)} with detections.")


if __name__ == "__main__":
    main()
