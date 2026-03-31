import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!HUBSPOT_API_TOKEN) return res.status(500).json({ error: 'HubSpot API token not configured' });

  const { query, type = 'contacts' } = req.body as { query: string; type?: 'contacts' | 'companies' };

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Search query required' });
  }

  try {
    if (type === 'companies') {
      const response = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/companies/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          properties: ['name', 'domain', 'industry', 'city', 'state', 'numberofemployees'],
          limit: 50,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HubSpot company search error:', errorText);
        return res.status(response.status).json({ error: 'HubSpot search failed' });
      }

      const data = await response.json() as { results?: Array<{ properties: Record<string, string> }> };
      const results = (data.results || []).map(c => ({
        name: c.properties.name || '',
        domain: c.properties.domain || '',
        company: c.properties.name || '',
        industry: c.properties.industry || '',
        city: c.properties.city || '',
        state: c.properties.state || '',
        employees: c.properties.numberofemployees || '',
      }));

      return res.status(200).json({ results, total: results.length });
    }

    // Contact search
    const response = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HUBSPOT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        properties: ['email', 'firstname', 'lastname', 'company', 'lifecyclestage', 'jobtitle'],
        limit: 50,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HubSpot contact search error:', errorText);
      return res.status(response.status).json({ error: 'HubSpot search failed' });
    }

    const data = await response.json() as { results?: Array<{ properties: Record<string, string> }> };
    const results = (data.results || []).map(c => ({
      email: c.properties.email || '',
      first_name: c.properties.firstname || '',
      last_name: c.properties.lastname || '',
      company: c.properties.company || '',
      lifecycle_stage: c.properties.lifecyclestage || '',
      job_title: c.properties.jobtitle || '',
    }));

    return res.status(200).json({ results, total: results.length });
  } catch (error) {
    console.error('HubSpot search error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
