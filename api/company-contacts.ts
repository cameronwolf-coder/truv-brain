import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Contact properties needed for champion scoring
const CONTACT_PROPERTIES = [
  'firstname',
  'lastname',
  'email',
  'jobtitle',
  'hs_persona',
  // Engagement metrics
  'hs_email_last_open_date',
  'hs_email_last_click_date',
  'hs_email_last_reply_date',
  'hs_email_open_count',
  'hs_email_click_count',
  'hs_email_reply_count',
  // Additional context
  'lifecyclestage',
  'hs_lead_status',
];

// Map job titles to persona IDs
function detectPersona(jobTitle: string | undefined): string {
  if (!jobTitle) return 'unknown';
  const title = jobTitle.toLowerCase();

  if (title.includes('coo') || title.includes('chief operating')) return 'coo';
  if (title.includes('cfo') || title.includes('chief financial') || title.includes('controller')) return 'cfo';
  if (title.includes('cto') || title.includes('chief technology') || title.includes('cio')) return 'cto';
  if (title.includes('ceo') || title.includes('chief executive') || title.includes('founder') || title.includes('president')) return 'ceo';
  if (title.includes('vp product') || title.includes('head of product')) return 'vp_product';
  if (title.includes('vp underwriting') || title.includes('underwriting director')) return 'vp_underwriting';
  if (title.includes('vp lending') || title.includes('vp mortgage') || title.includes('lending director')) return 'vp_lending';
  if (title.includes('evp') || title.includes('svp') || title.includes('executive vice')) return 'other_exec';
  if (title.includes('manager') || title.includes('director') || title.includes('team lead')) return 'manager';

  return 'unknown';
}

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

async function getContactDeals(contactId: string): Promise<Array<{
  id: string;
  name: string;
  stage: string;
  amount: number;
  isClosed: boolean;
  isWon: boolean;
}>> {
  try {
    // Get deals associated with this contact
    const response = (await hubspotRequest(
      'GET',
      `/crm/v4/objects/contacts/${contactId}/associations/deals`
    )) as {
      results?: Array<{ toObjectId: string }>;
    };

    if (!response.results || response.results.length === 0) {
      return [];
    }

    // Get deal details
    const dealIds = response.results.map((r) => r.toObjectId);
    const dealsResponse = (await hubspotRequest('POST', '/crm/v3/objects/deals/batch/read', {
      inputs: dealIds.map((id) => ({ id })),
      properties: ['dealname', 'dealstage', 'amount', 'hs_is_closed', 'hs_is_closed_won'],
    })) as {
      results?: Array<{
        id: string;
        properties: Record<string, string>;
      }>;
    };

    return (dealsResponse.results || []).map((deal) => ({
      id: deal.id,
      name: deal.properties.dealname || '',
      stage: deal.properties.dealstage || '',
      amount: parseFloat(deal.properties.amount) || 0,
      isClosed: deal.properties.hs_is_closed === 'true',
      isWon: deal.properties.hs_is_closed_won === 'true',
    }));
  } catch (error) {
    console.error(`Error fetching deals for contact ${contactId}:`, error);
    return [];
  }
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

  const { companyId } = req.query;

  if (!companyId || typeof companyId !== 'string') {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  try {
    // Get contacts associated with this company using the associations API
    const associationsResponse = (await hubspotRequest(
      'GET',
      `/crm/v4/objects/companies/${companyId}/associations/contacts`
    )) as {
      results?: Array<{ toObjectId: string }>;
    };

    const contactIds = (associationsResponse.results || []).map((r) => r.toObjectId);

    if (contactIds.length === 0) {
      return res.status(200).json({
        companyId,
        contactCount: 0,
        contacts: [],
      });
    }

    // Batch read contact details
    const contactsResponse = (await hubspotRequest('POST', '/crm/v3/objects/contacts/batch/read', {
      inputs: contactIds.map((id) => ({ id })),
      properties: CONTACT_PROPERTIES,
    })) as {
      results?: Array<{
        id: string;
        properties: Record<string, string>;
      }>;
    };

    const contactsRaw = contactsResponse.results || [];

    // Fetch deals for each contact (in parallel, but limit concurrency)
    const contacts = await Promise.all(
      contactsRaw.map(async (contact) => {
        const deals = await getContactDeals(contact.id);
        const persona = contact.properties.hs_persona || detectPersona(contact.properties.jobtitle);

        return {
          id: contact.id,
          firstName: contact.properties.firstname || '',
          lastName: contact.properties.lastname || '',
          email: contact.properties.email || '',
          jobTitle: contact.properties.jobtitle || '',
          persona,
          lastOpenDate: contact.properties.hs_email_last_open_date || null,
          lastClickDate: contact.properties.hs_email_last_click_date || null,
          lastReplyDate: contact.properties.hs_email_last_reply_date || null,
          openCount: parseInt(contact.properties.hs_email_open_count) || 0,
          clickCount: parseInt(contact.properties.hs_email_click_count) || 0,
          replyCount: parseInt(contact.properties.hs_email_reply_count) || 0,
          associatedDeals: deals,
        };
      })
    );

    return res.status(200).json({
      companyId,
      contactCount: contacts.length,
      contacts,
    });
  } catch (error) {
    console.error('Error fetching company contacts:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
