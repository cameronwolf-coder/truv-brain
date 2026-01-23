import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Contact properties to fetch
const CONTACT_PROPERTIES = [
  'firstname',
  'lastname',
  'email',
  'jobtitle',
  'company',
  'lifecyclestage',
  'hs_lead_status',
  'sales_vertical',
  'associatedcompanyid',
  'hs_email_last_open_date',
  'hs_last_sales_activity_date',
  'notes_last_updated',
  'numberofemployees',
];

// Excluded lifecycle stages
const DEFAULT_EXCLUDED_STAGES = [
  'opportunity',
  'customer',
  '268636562', // Live Customer
  '268636561', // Indirect Customer
  '268798101', // Advocate
  '268636560', // Disqualified
];

// Government domains to exclude
const GOVERNMENT_DOMAINS = ['.gov', '.mil', '.edu', 'state.', 'county.', 'city.'];

// Vertical matching patterns
const VERTICAL_PATTERNS: Record<string, string[]> = {
  Bank: ['bank', 'banking'],
  'Credit Union': ['credit union', 'cu '],
  IMB: ['mortgage', 'imb', 'independent mortgage'],
  'Background Screening': ['background', 'screening', 'hr tech'],
  Lending: ['lending', 'lender', 'loan'],
  Fintech: ['fintech', 'neobank'],
  'Auto Lending': ['auto', 'car loan', 'vehicle'],
  'Tenant Screening': ['tenant', 'rental', 'property'],
};

interface SearchFilters {
  verticals: string[];
  excludeStages?: string[];
  limit?: number;
}

interface Contact {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  jobtitle: string;
  company: string;
  companyId: string;
  lifecyclestage: string;
  vertical: string;
  employees: number | null;
}

interface CompanyGroup {
  id: string;
  name: string;
  vertical: string;
  contactCount: number;
  employees: number | null;
  contacts: Contact[];
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

function matchesVertical(
  vertical: string | undefined,
  company: string | undefined,
  targetVerticals: string[]
): boolean {
  if (targetVerticals.length === 0) return true;

  // Check if contact has a vertical set
  if (vertical && vertical.trim() !== '') {
    const lowerVertical = vertical.toLowerCase();
    for (const target of targetVerticals) {
      // Direct match
      if (lowerVertical.includes(target.toLowerCase())) {
        return true;
      }
      // Pattern match
      const patterns = VERTICAL_PATTERNS[target];
      if (patterns) {
        for (const pattern of patterns) {
          if (lowerVertical.includes(pattern)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // If no vertical set, try to match by company name
  if (company && company.trim() !== '') {
    const lowerCompany = company.toLowerCase();
    for (const target of targetVerticals) {
      const patterns = VERTICAL_PATTERNS[target];
      if (patterns) {
        for (const pattern of patterns) {
          if (lowerCompany.includes(pattern)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

function isGovernmentEmail(email: string | undefined): boolean {
  if (!email) return false;
  const lowerEmail = email.toLowerCase();
  return GOVERNMENT_DOMAINS.some((domain) => lowerEmail.includes(domain));
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
    const filters: SearchFilters = req.body;
    const { verticals, limit = 500 } = filters;
    const excludeStages = filters.excludeStages || DEFAULT_EXCLUDED_STAGES;

    if (!verticals || verticals.length === 0) {
      return res.status(400).json({ error: 'At least one vertical is required' });
    }

    // Build HubSpot filters
    const hubspotFilters: Array<{
      propertyName: string;
      operator: string;
      value?: string;
      values?: string[];
    }> = [];

    // Exclude lifecycle stages
    if (excludeStages.length > 0) {
      hubspotFilters.push({
        propertyName: 'lifecyclestage',
        operator: 'NOT_IN',
        values: excludeStages,
      });
    }

    // Search contacts
    const searchBody = {
      filterGroups: hubspotFilters.length > 0 ? [{ filters: hubspotFilters }] : [],
      properties: CONTACT_PROPERTIES,
      limit: 100,
      sorts: [{ propertyName: 'hs_last_sales_activity_date', direction: 'DESCENDING' }],
    };

    // Paginate and filter locally
    const allContacts: Contact[] = [];
    let after: string | undefined;
    let iterations = 0;
    const maxIterations = Math.ceil((limit * 10) / 100); // Fetch more since we filter locally

    while (iterations < maxIterations && allContacts.length < limit) {
      const body = after ? { ...searchBody, after } : searchBody;
      const response = (await hubspotRequest(
        'POST',
        '/crm/v3/objects/contacts/search',
        body
      )) as {
        results?: Array<{ id: string; properties: Record<string, string> }>;
        paging?: { next?: { after: string } };
      };

      const results = response.results || [];
      if (results.length === 0) break;

      for (const contact of results) {
        const vertical = contact.properties.sales_vertical;
        const company = contact.properties.company;
        const email = contact.properties.email;

        // Skip government emails
        if (isGovernmentEmail(email)) {
          continue;
        }

        // Check vertical match
        if (!matchesVertical(vertical, company, verticals)) {
          continue;
        }

        allContacts.push({
          id: contact.id,
          firstname: contact.properties.firstname || '',
          lastname: contact.properties.lastname || '',
          email: email || '',
          jobtitle: contact.properties.jobtitle || '',
          company: company || '',
          companyId: contact.properties.associatedcompanyid || '',
          lifecyclestage: contact.properties.lifecyclestage || '',
          vertical: vertical || '',
          employees: contact.properties.numberofemployees
            ? parseInt(contact.properties.numberofemployees)
            : null,
        });

        if (allContacts.length >= limit) break;
      }

      if (allContacts.length >= limit) break;
      after = response.paging?.next?.after;
      if (!after) break;
      iterations++;
    }

    // Group contacts by company
    const companyMap = new Map<string, CompanyGroup>();

    for (const contact of allContacts) {
      const companyKey = contact.company || 'Unknown Company';

      if (!companyMap.has(companyKey)) {
        companyMap.set(companyKey, {
          id: contact.companyId || companyKey,
          name: companyKey,
          vertical: contact.vertical,
          contactCount: 0,
          employees: contact.employees,
          contacts: [],
        });
      }

      const group = companyMap.get(companyKey)!;
      group.contactCount++;
      group.contacts.push(contact);
    }

    // Convert to array and sort by contact count
    const companies = Array.from(companyMap.values()).sort(
      (a, b) => b.contactCount - a.contactCount
    );

    return res.status(200).json({
      success: true,
      companies,
      totalCompanies: companies.length,
      totalContacts: allContacts.length,
      verticals,
    });
  } catch (error) {
    console.error('Error searching by vertical:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
