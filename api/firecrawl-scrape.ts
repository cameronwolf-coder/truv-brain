import type { VercelRequest, VercelResponse } from '@vercel/node';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!FIRECRAWL_API_KEY) {
    return res.status(500).json({ error: 'FIRECRAWL_API_KEY not configured' });
  }

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `Firecrawl error: ${response.status}`,
        detail: errorText.slice(0, 500),
      });
    }

    const result = await response.json();
    const data = result.data || {};

    return res.json({
      url: data.url || url,
      markdown: data.markdown || '',
      title: data.metadata?.title || '',
      description: data.metadata?.description || '',
      statusCode: data.metadata?.statusCode || 200,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Scrape failed' });
  }
}
