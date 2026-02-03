import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// In-memory cache (persists across warm function invocations)
const propertyCache: Record<string, { data: HubSpotProperty[]; timestamp: number }> = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  options?: Array<{ value: string; label: string }>;
}

interface HubSpotPropertyResponse {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  options?: Array<{ value: string; label: string }>;
}

async function fetchProperties(objectType: string): Promise<HubSpotProperty[]> {
  const cacheKey = objectType;
  const cached = propertyCache[cacheKey];

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const response = await fetch(
    `${HUBSPOT_BASE_URL}/crm/v3/properties/${objectType}`,
    {
      headers: {
        Authorization: `Bearer ${HUBSPOT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HubSpot API error: ${response.status}`);
  }

  const data = await response.json();
  const properties = (data.results || []).map((p: HubSpotPropertyResponse) => ({
    name: p.name,
    label: p.label,
    type: p.type,
    fieldType: p.fieldType,
    options: p.options?.map((o) => ({ value: o.value, label: o.label })),
  }));

  propertyCache[cacheKey] = { data: properties, timestamp: Date.now() };
  return properties;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!HUBSPOT_API_TOKEN) {
    return res.status(500).json({ error: 'HubSpot API token not configured' });
  }

  try {
    const objectType = (req.query.objectType as string) || 'companies';

    if (!['companies', 'contacts', 'deals'].includes(objectType)) {
      return res.status(400).json({ error: 'Invalid objectType. Must be companies, contacts, or deals.' });
    }

    const properties = await fetchProperties(objectType);

    return res.status(200).json({
      success: true,
      objectType,
      properties,
      cached: !!propertyCache[objectType],
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
