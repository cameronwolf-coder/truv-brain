import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

const ALLOWED_ORIGINS = [
  'https://truv-brain.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

// In-memory cache: stats change slowly, no need to hammer HubSpot on every page load
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let statsCache: { data: any; expiry: number } | null = null;
let vendorCache: Map<string, { data: any; expiry: number }> = new Map();

async function hubspotSearchWithRetry(url: string, options: RequestInit): Promise<Response> {
  const resp = await fetch(url, options);
  if (resp.status === 429) {
    const retryAfter = parseInt(resp.headers.get('retry-after') || '2', 10);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return fetch(url, options);
  }
  return resp;
}

async function hubspotSearch(body: object) {
  const resp = await hubspotSearchWithRetry(`${HUBSPOT_BASE_URL}/crm/v3/objects/companies/search`, {
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

async function hubspotSearchAll(body: object): Promise<any[]> {
  const results: any[] = [];
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const payload: any = { ...body, limit: 100 };
    if (after) payload.after = after;
    const resp = await hubspotSearchWithRetry(`${HUBSPOT_BASE_URL}/crm/v3/objects/companies/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HUBSPOT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(`HubSpot search failed: ${resp.status}`);
    const data = await resp.json();
    results.push(...(data.results || []));
    after = data.paging?.next?.after;
    if (!after) break;
  }
  return results;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!HUBSPOT_API_TOKEN) return res.status(500).json({ error: 'Not configured' });

  try {
    const props = ['name', 'domain', 'los_platform', 'pos_platform', 'los_pos_detected_at', 'los_pos_detection_method'];

    // Vendor filter mode: ?vendor=Encompass&type=los
    const vendorFilter = req.query.vendor as string | undefined;
    const vendorType = (req.query.type as string) || 'los'; // 'los' or 'pos'
    if (vendorFilter && vendorFilter.length > 100) {
      return res.status(400).json({ error: 'vendor filter too long' });
    }
    if (vendorFilter) {
      const cacheKey = `${vendorFilter}:${vendorType}`;
      const cached = vendorCache.get(cacheKey);
      if (cached && Date.now() < cached.expiry) {
        return res.status(200).json(cached.data);
      }
      const propertyName = vendorType === 'pos' ? 'pos_platform' : 'los_platform';
      const companies = await hubspotSearchAll({
        filterGroups: [{
          filters: [{ propertyName, operator: 'EQ', value: vendorFilter }],
        }],
        properties: props,
      });
      const rows = companies.map((co: any) => ({
        id: co.id,
        name: co.properties?.name || co.properties?.domain || co.id,
        domain: co.properties?.domain || '',
        los: co.properties?.los_platform || null,
        pos: co.properties?.pos_platform || null,
        detectedAt: co.properties?.los_pos_detected_at || null,
        method: co.properties?.los_pos_detection_method || null,
      }));
      const result = { vendor: vendorFilter, type: vendorType, count: rows.length, companies: rows };
      vendorCache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL_MS });
      return res.status(200).json(result);
    }

    // Return cached stats if fresh
    if (statsCache && Date.now() < statsCache.expiry) {
      return res.status(200).json(statsCache.data);
    }

    // Recent enrichments — companies with los_platform set, sorted by detection date desc
    const recentData = await hubspotSearch({
      filterGroups: [{
        filters: [{ propertyName: 'los_platform', operator: 'HAS_PROPERTY' }],
      }],
      properties: props,
      sorts: [{ propertyName: 'los_pos_detected_at', direction: 'DESCENDING' }],
      limit: 50,
    });

    // Paginate through ALL enriched companies for accurate stats
    const allCompanies = await hubspotSearchAll({
      filterGroups: [{
        filters: [{ propertyName: 'los_platform', operator: 'HAS_PROPERTY' }],
      }],
      properties: ['los_platform', 'pos_platform', 'los_pos_detection_method'],
    });

    // Tally vendor counts
    const losCounts: Record<string, number> = {};
    const posCounts: Record<string, number> = {};
    const methodCounts: Record<string, number> = {};
    let detectedCount = 0;
    let unknownCount = 0;

    for (const co of allCompanies) {
      const los = co.properties?.los_platform;
      const pos = co.properties?.pos_platform;
      const method = co.properties?.los_pos_detection_method;
      const hasDetection = (los && los !== 'Unknown') || (pos && pos !== 'Unknown');
      if (hasDetection) {
        detectedCount++;
        if (los && los !== 'Unknown') losCounts[los] = (losCounts[los] || 0) + 1;
        if (pos && pos !== 'Unknown') posCounts[pos] = (posCounts[pos] || 0) + 1;
        if (method) methodCounts[method] = (methodCounts[method] || 0) + 1;
      } else {
        unknownCount++;
      }
    }

    const topLos = Object.entries(losCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topPos = Object.entries(posCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topMethods = Object.entries(methodCounts).sort((a, b) => b[1] - a[1]);

    const recent = (recentData.results || []).map((co: any) => ({
      id: co.id,
      name: co.properties?.name || co.properties?.domain || co.id,
      domain: co.properties?.domain || '',
      los: co.properties?.los_platform || null,
      pos: co.properties?.pos_platform || null,
      detectedAt: co.properties?.los_pos_detected_at || null,
      method: co.properties?.los_pos_detection_method || null,
    }));

    const statsResult = {
      totalEnriched: allCompanies.length,
      detectedCount,
      unknownCount,
      topLos,
      topPos,
      topMethods,
      recent,
    };
    statsCache = { data: statsResult, expiry: Date.now() + CACHE_TTL_MS };
    return res.status(200).json(statsResult);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
