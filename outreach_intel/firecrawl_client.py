"""Firecrawl API client for web data extraction.

Wraps Firecrawl's scrape, crawl, map, and search endpoints
into a clean Python interface for use by Scout and outreach tools.
"""

import logging
import os
import time
from dataclasses import dataclass, field

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"


@dataclass
class ScrapeResult:
    """Result from a single page scrape."""

    url: str = ""
    markdown: str = ""
    raw_html: str = ""
    title: str = ""
    description: str = ""
    status_code: int = 0
    error: str = ""
    links: list[str] = field(default_factory=list)


@dataclass
class CrawlResult:
    """Result from a multi-page crawl."""

    pages: list[ScrapeResult] = field(default_factory=list)
    total: int = 0
    credits_used: int = 0
    error: str = ""


@dataclass
class MapResult:
    """Result from a domain URL map."""

    urls: list[str] = field(default_factory=list)
    total: int = 0
    error: str = ""


@dataclass
class SearchResult:
    """Result from a web search."""

    title: str = ""
    url: str = ""
    description: str = ""
    markdown: str = ""


class FirecrawlClient:
    """Client for the Firecrawl web data API."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("FIRECRAWL_API_KEY", "")
        self.base_url = FIRECRAWL_BASE_URL

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def scrape(
        self,
        url: str,
        formats: list[str] | None = None,
        only_main_content: bool = True,
        timeout: int = 30,
        wait_for: int | None = None,
    ) -> ScrapeResult:
        """Scrape a single URL and return content.

        Args:
            url: The URL to scrape.
            formats: Output formats (default: ["markdown"]).
                     Supports "markdown", "html", "rawHtml", "links".
            only_main_content: Strip nav/footer/sidebar.
            timeout: Request timeout in seconds.
            wait_for: Milliseconds to wait for JS rendering before scraping.

        Returns:
            ScrapeResult with content in the requested format(s).
        """
        if not self.available:
            return ScrapeResult(url=url, error="No Firecrawl API key configured")

        body: dict = {
            "url": url,
            "formats": formats or ["markdown"],
            "onlyMainContent": only_main_content,
        }
        if wait_for is not None:
            body["waitFor"] = wait_for

        try:
            resp = requests.post(
                f"{self.base_url}/scrape",
                headers=self._headers(),
                json=body,
                timeout=timeout,
            )
            if not resp.ok:
                return ScrapeResult(url=url, error=f"HTTP {resp.status_code}: {resp.text[:200]}")

            data = resp.json().get("data", {})
            return ScrapeResult(
                url=data.get("url", url),
                markdown=data.get("markdown", "") or data.get("rawHtml", "") or data.get("html", ""),
                title=data.get("metadata", {}).get("title", ""),
                description=data.get("metadata", {}).get("description", ""),
                status_code=data.get("metadata", {}).get("statusCode", 200),
                links=data.get("links", []),
                raw_html=data.get("rawHtml", ""),
            )
        except requests.exceptions.Timeout:
            return ScrapeResult(url=url, error="Request timed out")
        except Exception as e:
            return ScrapeResult(url=url, error=str(e))

    def crawl(
        self,
        url: str,
        max_pages: int = 10,
        include_paths: list[str] | None = None,
        exclude_paths: list[str] | None = None,
        poll_interval: int = 5,
        max_wait: int = 120,
    ) -> CrawlResult:
        """Crawl a website starting from a URL.

        Submits an async crawl job and polls until complete.

        Args:
            url: Starting URL.
            max_pages: Maximum pages to crawl.
            include_paths: Glob patterns to include (e.g. ["/about/*", "/team/*"]).
            exclude_paths: Glob patterns to exclude.
            poll_interval: Seconds between status checks.
            max_wait: Maximum seconds to wait for completion.

        Returns:
            CrawlResult with list of scraped pages.
        """
        if not self.available:
            return CrawlResult(error="No Firecrawl API key configured")

        body: dict = {
            "url": url,
            "limit": max_pages,
            "scrapeOptions": {"formats": ["markdown"], "onlyMainContent": True},
        }
        if include_paths:
            body["includePaths"] = include_paths
        if exclude_paths:
            body["excludePaths"] = exclude_paths

        try:
            resp = requests.post(
                f"{self.base_url}/crawl",
                headers=self._headers(),
                json=body,
                timeout=30,
            )
            if not resp.ok:
                return CrawlResult(error=f"HTTP {resp.status_code}: {resp.text[:200]}")

            job = resp.json()
            job_id = job.get("id")
            if not job_id:
                return CrawlResult(error="No job ID returned")

            # Poll for completion
            elapsed = 0
            while elapsed < max_wait:
                time.sleep(poll_interval)
                elapsed += poll_interval

                status_resp = requests.get(
                    f"{self.base_url}/crawl/{job_id}",
                    headers=self._headers(),
                    timeout=15,
                )
                if not status_resp.ok:
                    continue

                status_data = status_resp.json()
                if status_data.get("status") == "completed":
                    pages = []
                    for item in status_data.get("data", []):
                        pages.append(ScrapeResult(
                            url=item.get("metadata", {}).get("sourceURL", ""),
                            markdown=item.get("markdown", ""),
                            title=item.get("metadata", {}).get("title", ""),
                            description=item.get("metadata", {}).get("description", ""),
                            status_code=item.get("metadata", {}).get("statusCode", 200),
                        ))
                    return CrawlResult(
                        pages=pages,
                        total=status_data.get("total", len(pages)),
                        credits_used=status_data.get("creditsUsed", len(pages)),
                    )
                elif status_data.get("status") == "failed":
                    return CrawlResult(error=f"Crawl failed: {status_data.get('error', 'unknown')}")

            return CrawlResult(error=f"Crawl timed out after {max_wait}s")

        except Exception as e:
            return CrawlResult(error=str(e))

    def map(self, url: str, limit: int = 100, search: str | None = None) -> MapResult:
        """Discover all URLs on a domain, optionally filtered by search query.

        Args:
            url: Domain URL to map.
            limit: Maximum URLs to return.
            search: Optional search query to filter discovered URLs.

        Returns:
            MapResult with list of discovered URLs.
        """
        if not self.available:
            return MapResult(error="No Firecrawl API key configured")

        body: dict = {"url": url, "limit": limit}
        if search:
            body["search"] = search

        try:
            resp = requests.post(
                f"{self.base_url}/map",
                headers=self._headers(),
                json=body,
                timeout=30,
            )
            if not resp.ok:
                return MapResult(error=f"HTTP {resp.status_code}: {resp.text[:200]}")

            data = resp.json()
            urls = data.get("links", [])
            return MapResult(urls=urls, total=len(urls))

        except Exception as e:
            return MapResult(error=str(e))

    def search(self, query: str, limit: int = 5) -> list[SearchResult]:
        """Search the web and return results with content.

        Args:
            query: Search query.
            limit: Max results.

        Returns:
            List of SearchResult objects.
        """
        if not self.available:
            return []

        try:
            resp = requests.post(
                f"{self.base_url}/search",
                headers=self._headers(),
                json={"query": query, "limit": limit},
                timeout=15,
            )
            if not resp.ok:
                return []

            results = []
            for item in resp.json().get("data", []):
                results.append(SearchResult(
                    title=item.get("title", ""),
                    url=item.get("url", ""),
                    description=item.get("description", ""),
                    markdown=item.get("markdown", ""),
                ))
            return results

        except Exception as e:
            logger.warning(f"Firecrawl search failed: {e}")
            return []
