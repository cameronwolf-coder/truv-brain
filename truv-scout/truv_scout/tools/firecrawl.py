"""Re-export Firecrawl-based web search and scraping tools from outreach_intel."""

from outreach_intel.signal_tools import (
    check_job_changes,
    crawl_company_site,
    extract_article_content,
    map_company_urls,
    scrape_company_website,
    search_company_news,
)

__all__ = [
    "search_company_news",
    "check_job_changes",
    "scrape_company_website",
    "crawl_company_site",
    "map_company_urls",
    "extract_article_content",
]
