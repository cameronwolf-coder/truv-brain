"""Re-export Firecrawl-based web search tools from outreach_intel."""

from outreach_intel.signal_tools import search_company_news, check_job_changes

__all__ = ["search_company_news", "check_job_changes"]
