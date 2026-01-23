import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Persona job title patterns for filtering
const PERSONA_PATTERNS: Record<string, string[]> = {
  coo: ['COO', 'Chief Operating Officer', 'Chief Operating'],
  cfo: ['CFO', 'Chief Financial', 'VP Finance', 'Controller', 'Finance Director'],
  other_exec: ['EVP', 'SVP', 'Senior Vice President', 'Executive Vice President'],
  cto: ['CTO', 'Chief Technology', 'VP Engineering', 'CIO', 'IT Director', 'VP Technology'],
  manager: ['Manager', 'Director', 'Team Lead', 'Supervisor'],
  ceo: ['CEO', 'Chief Executive', 'Founder', 'President', 'Owner', 'Principal'],
  vp_product: ['VP Product', 'Head of Product', 'Product Director', 'Chief Product'],
  vp_underwriting: ['VP Underwriting', 'Chief Credit', 'Underwriting Director', 'Head of Underwriting'],
  vp_lending: ['VP Lending', 'VP Mortgage', 'Lending Director', 'Mortgage Director', 'Head of Lending'],
};

// Excluded lifecycle stages (opportunity, customer, etc.)
const EXCLUDED_STAGES = [
  'opportunity',
  'customer',
  '268636562', // Live Customer
  '268636561', // Indirect Customer
  '268798101', // Advocate
  '268636560', // Disqualified
];

// Default contact properties to fetch
const CONTACT_PROPERTIES = [
  'firstname',
  'lastname',
  'email',
  'jobtitle',
  'company',
  'lifecyclestage',
  'hs_lead_status',
  'sales_vertical',
];

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

async function searchContacts(
  filters: Array<{ propertyName: string; operator: string; value?: string; values?: string[] }>,
  limit: number
): Promise<Array<{ id: string; properties: Record<string, string> }>> {
  const body = {
    filterGroups: [{ filters }],
    properties: CONTACT_PROPERTIES,
    limit: Math.min(limit, 100),
  };

  const response = (await hubspotRequest('POST', '/crm/v3/objects/contacts/search', body)) as {
    results?: Array<{ id: string; properties: Record<string, string> }>;
  };
  return response.results || [];
}

async function createList(name: string): Promise<{ listId: string }> {
  const body = {
    name,
    objectTypeId: '0-1', // CONTACT
    processingType: 'MANUAL',
  };

  const response = (await hubspotRequest('POST', '/crm/v3/lists', body)) as {
    list?: { listId: string };
    listId?: string;
  };
  return { listId: response.list?.listId || response.listId || '' };
}

async function addContactsToList(listId: string, contactIds: string[]): Promise<void> {
  if (contactIds.length === 0) return;
  await hubspotRequest('PUT', `/crm/v3/lists/${listId}/memberships/add`, contactIds);
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

  try {
    const { name, campaignType, persona, vertical, objection, limit = 100 } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'List name is required' });
    }

    // Build filters
    const filters: Array<{ propertyName: string; operator: string; value?: string; values?: string[] }> = [];

    // Exclude certain lifecycle stages
    filters.push({
      propertyName: 'lifecyclestage',
      operator: 'NOT_IN',
      values: EXCLUDED_STAGES,
    });

    // Apply vertical filter
    if (vertical && vertical !== 'all' && (campaignType === 'closed_loss' || campaignType === 'vertical')) {
      filters.push({
        propertyName: 'sales_vertical',
        operator: 'CONTAINS_TOKEN',
        value: vertical,
      });
    }

    // Apply persona filter
    if (persona && PERSONA_PATTERNS[persona]) {
      const pattern = PERSONA_PATTERNS[persona][0];
      filters.push({
        propertyName: 'jobtitle',
        operator: 'CONTAINS_TOKEN',
        value: pattern,
      });
    }

    // Apply campaign-specific filters
    if (campaignType === 'closed_loss') {
      filters.push({
        propertyName: 'lifecyclestage',
        operator: 'EQ',
        value: '268636563', // Closed Lost stage ID
      });
    }

    // Search contacts
    const contacts = await searchContacts(filters, Math.min(limit, 500));

    if (contacts.length === 0) {
      return res.status(200).json({
        success: false,
        error: 'No contacts found matching criteria',
        count: 0,
      });
    }

    // Create list
    const { listId } = await createList(name);

    // Add contacts to list
    const contactIds = contacts.map((c) => c.id);
    await addContactsToList(listId, contactIds);

    return res.status(200).json({
      success: true,
      listId,
      listName: name,
      count: contacts.length,
    });
  } catch (error) {
    console.error('Error creating list:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
