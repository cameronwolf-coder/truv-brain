import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

async function hubspotRequest(
  method: string,
  endpoint: string,
  body?: unknown
): Promise<unknown> {
  const response = await fetch(`${HUBSPOT_BASE_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
  }

  if (response.status === 204) return {};
  return response.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
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

  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Search query (q) is required' });
  }

  try {
    // Search companies by name
    const body = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'name',
              operator: 'CONTAINS_TOKEN',
              value: q,
            },
          ],
        },
      ],
      properties: ['name', 'domain', 'industry', 'numberofemployees', 'city', 'state'],
      limit: 10,
    };

    const response = (await hubspotRequest('POST', '/crm/v3/objects/companies/search', body)) as {
      results?: Array<{
        id: string;
        properties: Record<string, string>;
      }>;
    };

    const companies = (response.results || []).map((company) => ({
      id: company.id,
      name: company.properties.name || '',
      domain: company.properties.domain || '',
      industry: company.properties.industry || '',
      employees: company.properties.numberofemployees || '',
      location: [company.properties.city, company.properties.state].filter(Boolean).join(', '),
    }));

    return res.status(200).json({ companies });
  } catch (error) {
    console.error('Error searching companies:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
