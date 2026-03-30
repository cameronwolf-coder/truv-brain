import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;

function corsHeaders(res: VercelResponse): void {}

interface HubSpotListItem {
  id: string;
  name: string;
  type: string;
  size: number;
  updatedAt: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!HUBSPOT_API_TOKEN) throw new Error('HubSpot API token not configured');

    const query = (req.query.q as string || '').toLowerCase();
    const listId = req.query.listId as string || '';

    // Direct lookup by list ID
    if (listId) {
      const response = await fetch(`https://api.hubapi.com/contacts/v1/lists/${listId}`, {
        headers: { Authorization: `Bearer ${HUBSPOT_API_TOKEN}` },
      });

      if (!response.ok) {
        // Try v3 API for ILS lists
        const v3Res = await fetch(`https://api.hubapi.com/crm/v3/lists/${listId}`, {
          headers: { Authorization: `Bearer ${HUBSPOT_API_TOKEN}` },
        });
        if (v3Res.ok) {
          const v3Data = await v3Res.json();
          return res.status(200).json({
            list: {
              id: String(v3Data.listId || v3Data.id),
              name: v3Data.name,
              type: v3Data.processingType || 'UNKNOWN',
              size: v3Data.additionalProperties?.hs_list_size || 0,
              updatedAt: v3Data.updatedAt || null,
            },
          });
        }
        return res.status(404).json({ error: `List ${listId} not found` });
      }

      const data = await response.json();
      return res.status(200).json({
        list: {
          id: String(data.listId),
          name: data.name,
          type: data.listType,
          size: data.metaData?.size || 0,
          updatedAt: data.metaData?.lastSizeChangeAt ? new Date(data.metaData.lastSizeChangeAt).toISOString() : null,
        },
      });
    }

    // Fetch all lists — paginate through v1 API
    const allLists: HubSpotListItem[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && allLists.length < 1000) {
      const response = await fetch(`https://api.hubapi.com/contacts/v1/lists?count=250&offset=${offset}`, {
        headers: { Authorization: `Bearer ${HUBSPOT_API_TOKEN}` },
      });

      if (!response.ok) break;

      const data = await response.json();
      for (const l of data.lists || []) {
        allLists.push({
          id: String(l.listId),
          name: l.name,
          type: l.listType,
          size: l.metaData?.size || 0,
          updatedAt: l.metaData?.lastSizeChangeAt ? new Date(l.metaData.lastSizeChangeAt).toISOString() : null,
        });
      }

      hasMore = data['has-more'] === true;
      offset = data.offset || (offset + 250);
    }

    // Filter by query
    let filtered = allLists;
    if (query) {
      filtered = allLists.filter((l) =>
        l.name.toLowerCase().includes(query) || l.id.includes(query)
      );
    }

    // Sort by most recently updated
    filtered.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    return res.status(200).json({ lists: filtered.slice(0, 50), total: allLists.length });
  } catch (error) {
    console.error('HubSpot lists error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
