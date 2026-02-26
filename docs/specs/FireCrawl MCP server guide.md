# Firecrawl MCP Server Guide

A comprehensive guide to all Firecrawl MCP tools for web scraping, crawling, searching, and data extraction.

---

## Table of Contents

1. [Overview](#overview)
2. [Tool Selection Guide](#tool-selection-guide)
3. [Tools Reference](#tools-reference)
   - [firecrawl_scrape](#firecrawl_scrape)
   - [firecrawl_map](#firecrawl_map)
   - [firecrawl_search](#firecrawl_search)
   - [firecrawl_crawl](#firecrawl_crawl)
   - [firecrawl_check_crawl_status](#firecrawl_check_crawl_status)
   - [firecrawl_extract](#firecrawl_extract)
   - [firecrawl_agent](#firecrawl_agent)
   - [firecrawl_agent_status](#firecrawl_agent_status)
4. [Common Parameters](#common-parameters)
5. [Best Practices](#best-practices)

---

## Overview

Firecrawl MCP provides a suite of web scraping and data extraction tools. Each tool is optimized for specific use cases:

| Tool | Primary Use Case |
|------|------------------|
| `scrape` | Single page content extraction |
| `map` | URL discovery on a website |
| `search` | Web search with optional content extraction |
| `crawl` | Multi-page content extraction |
| `extract` | Structured data extraction with LLM |
| `agent` | Autonomous web research |

---

## Tool Selection Guide

```
Do you know the exact URL?
├── YES → Is it a single page?
│         ├── YES → Use firecrawl_scrape
│         └── NO  → Use firecrawl_crawl or firecrawl_map + batch scrape
└── NO  → Do you need to find URLs on a specific site?
          ├── YES → Use firecrawl_map
          └── NO  → Is it a complex research task?
                    ├── YES → Use firecrawl_agent
                    └── NO  → Use firecrawl_search
```

**For structured data extraction**: Use `firecrawl_extract` when you need specific fields from pages.

---

## Tools Reference

### firecrawl_scrape

Scrapes content from a single URL with advanced options. This is the most powerful, fastest, and most reliable scraper tool.

#### When to Use
- Single page content extraction
- When you know exactly which page contains the information
- Brand identity extraction (colors, fonts, typography)

#### When NOT to Use
- Multiple pages (use `batch_scrape` or `crawl`)
- Unknown page location (use `search`)
- Structured data needs (use `extract`)

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string (URI) | Yes | The URL to scrape |
| `formats` | array | No | Output formats (see below) |
| `onlyMainContent` | boolean | No | Extract only main content |
| `includeTags` | array | No | HTML tags to include |
| `excludeTags` | array | No | HTML tags to exclude |
| `waitFor` | number | No | Wait time in ms before scraping |
| `mobile` | boolean | No | Use mobile viewport |
| `actions` | array | No | Browser actions to perform |
| `maxAge` | number | No | Cache age in ms (500% faster with cache) |
| `proxy` | string | No | Proxy type: "basic", "stealth", "auto" |
| `location` | object | No | Geographic location settings |
| `skipTlsVerification` | boolean | No | Skip TLS certificate verification |
| `removeBase64Images` | boolean | No | Remove base64 encoded images |
| `parsers` | array | No | Special parsers (e.g., "pdf") |

#### Format Options

| Format | Description |
|--------|-------------|
| `markdown` | Page content as Markdown |
| `html` | Cleaned HTML |
| `rawHtml` | Raw HTML source |
| `screenshot` | Page screenshot |
| `links` | All links on the page |
| `summary` | AI-generated summary |
| `changeTracking` | Track page changes |
| `branding` | Extract brand identity (colors, fonts, UI components) |
| `json` | Structured JSON with schema |

#### Screenshot Options

```json
{
  "type": "screenshot",
  "fullPage": true,
  "quality": 80,
  "viewport": {
    "width": 1920,
    "height": 1080
  }
}
```

#### Browser Actions

Actions allow you to interact with the page before scraping:

| Action Type | Description | Parameters |
|-------------|-------------|------------|
| `wait` | Wait for element/time | `selector`, `milliseconds` |
| `click` | Click an element | `selector` |
| `write` | Type text | `selector`, `text` |
| `press` | Press a key | `key` |
| `scroll` | Scroll the page | `direction` ("up"/"down") |
| `screenshot` | Take screenshot | `fullPage` |
| `scrape` | Scrape current state | - |
| `executeJavascript` | Run JS code | `script` |
| `generatePDF` | Generate PDF | - |

#### Example

```json
{
  "url": "https://example.com",
  "formats": ["markdown", "links"],
  "onlyMainContent": true,
  "maxAge": 172800000
}
```

---

### firecrawl_map

Maps a website to discover all indexed URLs.

#### When to Use
- Discovering URLs before deciding what to scrape
- Finding specific sections of a website
- Building a sitemap

#### When NOT to Use
- When you already know the specific URL (use `scrape`)
- When you need page content (use `scrape` after mapping)

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string (URI) | Yes | The website URL to map |
| `search` | string | No | Filter URLs by search term |
| `limit` | number | No | Maximum URLs to return |
| `ignoreQueryParameters` | boolean | No | Ignore URL query parameters |
| `includeSubdomains` | boolean | No | Include subdomain URLs |
| `sitemap` | string | No | Sitemap handling: "include", "skip", "only" |

#### Example

```json
{
  "url": "https://example.com",
  "search": "blog",
  "limit": 100
}
```

#### Returns
Array of URLs found on the site.

---

### firecrawl_search

Searches the web and optionally extracts content from search results.

#### When to Use
- Finding information across multiple websites
- When you don't know which website has the information
- News, images, or general web search

#### When NOT to Use
- Filesystem searches (use local tools)
- When you know the exact website (use `scrape`)
- Comprehensive single-site coverage (use `map` or `crawl`)

#### Search Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `""` | Exact match | `"Firecrawl"` |
| `-` | Exclude keyword | `-bad` |
| `site:` | Limit to domain | `site:firecrawl.dev` |
| `inurl:` | Word in URL | `inurl:firecrawl` |
| `allinurl:` | Multiple words in URL | `allinurl:git firecrawl` |
| `intitle:` | Word in title | `intitle:Firecrawl` |
| `allintitle:` | Multiple words in title | `allintitle:firecrawl playground` |
| `related:` | Related domains | `related:firecrawl.dev` |
| `imagesize:` | Exact image dimensions | `imagesize:1920x1080` |
| `larger:` | Minimum image size | `larger:1920x1080` |

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query (min 2 chars) |
| `limit` | number | No | Max results to return |
| `sources` | array | No | Sources: "web", "images", "news" |
| `location` | string | No | Geographic location |
| `filter` | string | No | Additional filter |
| `tbs` | string | No | Time-based search parameter |
| `scrapeOptions` | object | No | Options for scraping results |

#### Example (without scraping)

```json
{
  "query": "top AI companies 2024",
  "limit": 5,
  "sources": [{"type": "web"}]
}
```

#### Example (with scraping)

```json
{
  "query": "latest AI research papers",
  "limit": 5,
  "scrapeOptions": {
    "formats": ["markdown"],
    "onlyMainContent": true
  }
}
```

#### Optimal Workflow
1. Search without `formats` first
2. Review results
3. Use `scrape` on relevant pages

---

### firecrawl_crawl

Starts a crawl job to extract content from multiple related pages.

#### When to Use
- Extracting content from multiple related pages
- Comprehensive coverage of a site section
- Blog posts, documentation, product listings

#### When NOT to Use
- Single page (use `scrape`)
- Token limits are a concern (use `map` + selective scraping)
- Need fast results (crawling can be slow)

#### Warning
Crawl responses can be very large and may exceed token limits. Always set reasonable `limit` and `maxDiscoveryDepth` values.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Starting URL |
| `limit` | number | No | Max pages to crawl |
| `maxDiscoveryDepth` | number | No | Max link depth to follow |
| `allowExternalLinks` | boolean | No | Follow external links |
| `allowSubdomains` | boolean | No | Include subdomains |
| `includePaths` | array | No | URL paths to include |
| `excludePaths` | array | No | URL paths to exclude |
| `ignoreQueryParameters` | boolean | No | Ignore query params |
| `deduplicateSimilarURLs` | boolean | No | Remove similar URLs |
| `sitemap` | string | No | "skip", "include", "only" |
| `delay` | number | No | Delay between requests (ms) |
| `maxConcurrency` | number | No | Max concurrent requests |
| `scrapeOptions` | object | No | Options for each page |
| `webhook` | string/object | No | Webhook for notifications |

#### Example

```json
{
  "url": "https://example.com/blog",
  "maxDiscoveryDepth": 2,
  "limit": 20,
  "allowExternalLinks": false,
  "deduplicateSimilarURLs": true,
  "scrapeOptions": {
    "formats": ["markdown"],
    "onlyMainContent": true
  }
}
```

#### Returns
Operation ID for status checking with `firecrawl_check_crawl_status`.

---

### firecrawl_check_crawl_status

Checks the status of a crawl job.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The crawl operation ID |

#### Example

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Returns
Status, progress, and results (if available).

---

### firecrawl_extract

Extracts structured information from web pages using LLM capabilities.

#### When to Use
- Extracting specific structured data (prices, names, details)
- Need data in a defined schema
- Processing multiple pages for the same data structure

#### When NOT to Use
- Need full page content (use `scrape`)
- Not looking for specific structured data

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `urls` | array | Yes | URLs to extract from |
| `prompt` | string | No | Custom extraction prompt |
| `schema` | object | No | JSON schema for output |
| `allowExternalLinks` | boolean | No | Allow external links |
| `enableWebSearch` | boolean | No | Enable web search context |
| `includeSubdomains` | boolean | No | Include subdomains |

#### Example

```json
{
  "urls": ["https://example.com/product1", "https://example.com/product2"],
  "prompt": "Extract product information including name, price, and description",
  "schema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "price": { "type": "number" },
      "description": { "type": "string" }
    },
    "required": ["name", "price"]
  }
}
```

---

### firecrawl_agent

Autonomous web data gathering agent. Describe what you want, and it finds and extracts it.

#### When to Use
- Complex data gathering without known URLs
- Research tasks requiring multiple sources
- Finding data in hard-to-reach places
- When you don't know where to look

#### When NOT to Use
- Simple single-page scraping (use `scrape`)
- Known exact URL (use `scrape` or `extract`)

#### Advantages Over Extract
- No URLs required - just describe what you need
- Autonomously searches and navigates
- Faster and more cost-effective for complex tasks
- Higher reliability for varied queries

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Description of data needed (max 10,000 chars) |
| `urls` | array | No | Optional URLs to focus on |
| `schema` | object | No | JSON schema for structured output |

#### Example (no URLs)

```json
{
  "prompt": "Find the top 5 AI startups founded in 2024 and their funding amounts",
  "schema": {
    "type": "object",
    "properties": {
      "startups": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "funding": { "type": "string" },
            "founded": { "type": "string" }
          }
        }
      }
    }
  }
}
```

#### Example (with URLs)

```json
{
  "urls": ["https://docs.firecrawl.dev", "https://firecrawl.dev/pricing"],
  "prompt": "Compare the features and pricing information from these pages"
}
```

---

### firecrawl_agent_status

Checks the status of an agent job.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The agent job ID |

#### Possible Statuses
- `processing`: Agent is still working
- `completed`: Extraction finished successfully
- `failed`: An error occurred

#### Example

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Common Parameters

### Scrape Options

These options are shared across tools that scrape content:

| Parameter | Type | Description |
|-----------|------|-------------|
| `formats` | array | Output formats |
| `onlyMainContent` | boolean | Extract main content only |
| `includeTags` | array | HTML tags to include |
| `excludeTags` | array | HTML tags to exclude |
| `waitFor` | number | Wait time before scraping (ms) |
| `mobile` | boolean | Use mobile viewport |
| `actions` | array | Browser actions |
| `maxAge` | number | Cache duration (ms) |
| `proxy` | string | Proxy type |
| `location` | object | Geographic settings |
| `removeBase64Images` | boolean | Remove base64 images |
| `parsers` | array | Special parsers |

### Location Object

```json
{
  "country": "us",
  "languages": ["en"]
}
```

### Proxy Types

| Type | Description |
|------|-------------|
| `basic` | Standard proxy |
| `stealth` | Anti-detection proxy |
| `auto` | Automatic selection |

---

## Best Practices

### Performance

1. **Use `maxAge` for caching**: Provides up to 500% faster scrapes for repeated requests
2. **Limit crawl depth**: Keep `maxDiscoveryDepth` low (2-3) to avoid token overflow
3. **Set reasonable limits**: Always set `limit` on crawls and searches
4. **Use `onlyMainContent`**: Reduces noise and token usage

### Reliability

1. **Prefer `scrape` for single pages**: Most reliable for known URLs
2. **Use `map` before `crawl`**: Better control over which pages to process
3. **Check status for async operations**: Always verify crawl/agent completion

### Cost Optimization

1. **Search without formats first**: Review results before scraping
2. **Use `agent` for complex research**: More efficient than multiple searches
3. **Deduplicate URLs**: Enable `deduplicateSimilarURLs` for crawls

### Data Quality

1. **Define schemas for `extract`**: Get consistent, structured output
2. **Use specific prompts**: Better prompts yield better extraction
3. **Filter with `includePaths`/`excludePaths`**: Target relevant content

---

## Quick Reference

| I want to... | Use this tool |
|--------------|---------------|
| Get content from one page | `firecrawl_scrape` |
| Find all URLs on a site | `firecrawl_map` |
| Search the web | `firecrawl_search` |
| Scrape multiple pages | `firecrawl_crawl` |
| Extract specific data fields | `firecrawl_extract` |
| Research a topic autonomously | `firecrawl_agent` |
| Check async job status | `firecrawl_check_crawl_status` / `firecrawl_agent_status` |
