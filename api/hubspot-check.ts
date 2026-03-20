import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

interface HubSpotMatch {
  lifecycleStage: string;
  firstName: string;
  lastName: string;
  company: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!HUBSPOT_API_TOKEN) {
    return res.status(500).json({ error: 'HubSpot API token not configured' });
  }

  const { emails } = req.body as { emails: string[] };

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'Emails array required' });
  }

  try {
    const matches: Record<string, HubSpotMatch> = {};

    // Batch emails into groups of 100 (HubSpot search limit)
    const batches: string[][] = [];
    for (let i = 0; i < emails.length; i += 100) {
      batches.push(emails.slice(i, i + 100));
    }

    for (const batch of batches) {
      const response = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'email',
                  operator: 'IN',
                  values: batch,
                },
              ],
            },
          ],
          properties: ['email', 'lifecyclestage', 'firstname', 'lastname', 'company'],
          limit: 100,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HubSpot batch search error:', errorText);
        continue;
      }

      const data = (await response.json()) as {
        results?: Array<{ properties: Record<string, string> }>;
      };

      for (const contact of data.results || []) {
        const email = contact.properties.email;
        if (email) {
          matches[email.toLowerCase()] = {
            lifecycleStage: contact.properties.lifecyclestage || '',
            firstName: contact.properties.firstname || '',
            lastName: contact.properties.lastname || '',
            company: contact.properties.company || '',
          };
        }
      }
    }

    return res.status(200).json({
      matches,
      total: emails.length,
      matched: Object.keys(matches).length,
    });
  } catch (error) {
    console.error('HubSpot check error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
