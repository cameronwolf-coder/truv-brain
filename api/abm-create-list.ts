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

  const { listName, contactIds, companyName } = req.body;

  if (!listName || typeof listName !== 'string') {
    return res.status(400).json({ error: 'List name is required' });
  }

  if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
    return res.status(400).json({ error: 'Contact IDs array is required' });
  }

  try {
    // Create a static list
    const listResponse = (await hubspotRequest('POST', '/contacts/v1/lists', {
      name: listName,
      dynamic: false,
    })) as { listId: number };

    const listId = listResponse.listId;

    // Add contacts to the list
    await hubspotRequest('POST', `/contacts/v1/lists/${listId}/add`, {
      vids: contactIds.map((id: string) => parseInt(id, 10)),
    });

    return res.status(200).json({
      success: true,
      listId,
      listName,
      contactCount: contactIds.length,
      companyName: companyName || 'Unknown',
      hubspotUrl: `https://app.hubspot.com/contacts/YOUR_PORTAL_ID/lists/${listId}`,
    });
  } catch (error) {
    console.error('Error creating ABM list:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
