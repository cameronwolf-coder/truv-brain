import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;

function corsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!HUBSPOT_API_TOKEN) throw new Error('HubSpot API token not configured');

    const query = (req.query.q as string || '').toLowerCase();

    // Fetch lists from HubSpot (v1 API for static lists, v3 for ILS)
    const response = await fetch('https://api.hubapi.com/contacts/v1/lists?count=250', {
      headers: { Authorization: `Bearer ${HUBSPOT_API_TOKEN}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HubSpot API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    let lists = (data.lists || []).map((l: { listId: number; name: string; listType: string; metaData: { size: number; lastSizeChangeAt: number } }) => ({
      id: String(l.listId),
      name: l.name,
      type: l.listType,
      size: l.metaData?.size || 0,
      updatedAt: l.metaData?.lastSizeChangeAt ? new Date(l.metaData.lastSizeChangeAt).toISOString() : null,
    }));

    // Filter by query if provided
    if (query) {
      lists = lists.filter((l: { name: string }) => l.name.toLowerCase().includes(query));
    }

    // Sort by most recently updated
    lists.sort((a: { updatedAt: string | null }, b: { updatedAt: string | null }) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || '')
    );

    return res.status(200).json({ lists: lists.slice(0, 50) });
  } catch (error) {
    console.error('HubSpot lists error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
