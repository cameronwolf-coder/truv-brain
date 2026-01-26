const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

export interface FirecrawlSearchResult {
  url: string;
  title: string;
  description: string;
}

export interface FirecrawlScrapeResult {
  markdown: string;
  html: string;
  url: string;
}

export async function searchWeb(query: string, apiKey: string, limit: number = 5): Promise<FirecrawlSearchResult[]> {
  const response = await fetch(`${FIRECRAWL_API_URL}/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit,
    }),
  });

  if (!response.ok) {
    throw new Error(`Firecrawl search failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.results || [];
}

export async function scrapePage(url: string, apiKey: string): Promise<FirecrawlScrapeResult> {
  const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'html'],
    }),
  });

  if (!response.ok) {
    throw new Error(`Firecrawl scrape failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    markdown: data.markdown || '',
    html: data.html || '',
    url,
  };
}
