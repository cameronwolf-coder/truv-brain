import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

const ALLOWED_ORIGINS = [
  'https://truv-brain.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

async function hubspotSearch(body: object) {
  const resp = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/companies/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`HubSpot search failed: ${resp.status}`);
  return resp.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!HUBSPOT_API_TOKEN) return res.status(500).json({ error: 'Not configured' });

  try {
    const props = ['name', 'domain', 'los_platform', 'pos_platform', 'los_pos_detected_at', 'los_pos_detection_method'];

    // Recent enrichments — companies with los_platform set, sorted by detection date desc
    const recentData = await hubspotSearch({
      filterGroups: [{
        filters: [{ propertyName: 'los_platform', operator: 'HAS_PROPERTY' }],
      }],
      properties: props,
      sorts: [{ propertyName: 'los_pos_detected_at', direction: 'DESCENDING' }],
      limit: 50,
    });

    // Stats: total enriched
    const totalData = await hubspotSearch({
      filterGroups: [{
        filters: [{ propertyName: 'los_platform', operator: 'HAS_PROPERTY' }],
      }],
      properties: ['los_platform', 'pos_platform'],
      limit: 100,
    });

    // Tally vendor counts
    const losCounts: Record<string, number> = {};
    const posCounts: Record<string, number> = {};
    let detectedCount = 0;
    let unknownCount = 0;

    for (const co of totalData.results || []) {
      const los = co.properties?.los_platform;
      const pos = co.properties?.pos_platform;
      if (los && los !== 'Unknown') { losCounts[los] = (losCounts[los] || 0) + 1; detectedCount++; }
      else unknownCount++;
      if (pos && pos !== 'Unknown') { posCounts[pos] = (posCounts[pos] || 0) + 1; }
    }

    const topLos = Object.entries(losCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topPos = Object.entries(posCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const recent = (recentData.results || []).map((co: any) => ({
      id: co.id,
      name: co.properties?.name || co.properties?.domain || co.id,
      domain: co.properties?.domain || '',
      los: co.properties?.los_platform || null,
      pos: co.properties?.pos_platform || null,
      detectedAt: co.properties?.los_pos_detected_at || null,
      method: co.properties?.los_pos_detection_method || null,
    }));

    return res.status(200).json({
      totalEnriched: totalData.total || totalData.results?.length || 0,
      detectedCount,
      unknownCount,
      topLos,
      topPos,
      recent,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
