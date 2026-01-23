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
  vp_underwriting: [
    'VP Underwriting',
    'Chief Credit',
    'Underwriting Director',
    'Head of Underwriting',
  ],
  vp_lending: [
    'VP Lending',
    'VP Mortgage',
    'Lending Director',
    'Mortgage Director',
    'Head of Lending',
  ],
};

// Contact properties to fetch
const CONTACT_PROPERTIES = [
  'firstname',
  'lastname',
  'email',
  'jobtitle',
  'company',
  'lifecyclestage',
  'hs_lead_status',
  'associatedcompanyid',
  'hs_email_last_open_date',
  'hs_last_sales_activity_date',
  'notes_last_updated',
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

interface ContactSearchFilters {
  companyIds: string[];
  personas?: string[];
  excludeStages?: string[];
  requireTitle?: boolean;
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
  lastActivity: string | null;
  matchedPersona: string | null;
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

function matchPersona(jobtitle: string | undefined): string | null {
  if (!jobtitle || jobtitle.trim() === '') return null;

  const lowerTitle = jobtitle.toLowerCase();

  for (const [persona, patterns] of Object.entries(PERSONA_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerTitle.includes(pattern.toLowerCase())) {
        return persona;
      }
    }
  }

  return 'other';
}

function isGovernmentEmail(email: string | undefined): boolean {
  if (!email) return false;
  const lowerEmail = email.toLowerCase();
  return GOVERNMENT_DOMAINS.some((domain) => lowerEmail.includes(domain));
}

function getLastActivity(props: Record<string, string>): string | null {
  const dates = [
    props.hs_email_last_open_date,
    props.hs_last_sales_activity_date,
    props.notes_last_updated,
  ]
    .filter(Boolean)
    .map((d) => new Date(d).getTime());

  if (dates.length === 0) return null;

  const latest = new Date(Math.max(...dates));
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - latest.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
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
    const filters: ContactSearchFilters = req.body;
    const { companyIds, personas = [], requireTitle = true, limit = 500 } = filters;
    const excludeStages = filters.excludeStages || DEFAULT_EXCLUDED_STAGES;

    if (!companyIds || companyIds.length === 0) {
      return res.status(400).json({ error: 'companyIds is required' });
    }

    // Build filter for contacts associated with these companies
    const hubspotFilters: Array<{
      propertyName: string;
      operator: string;
      value?: string;
      values?: string[];
    }> = [
      {
        propertyName: 'associatedcompanyid',
        operator: 'IN',
        values: companyIds,
      },
    ];

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
      filterGroups: [{ filters: hubspotFilters }],
      properties: CONTACT_PROPERTIES,
      limit: 100,
      sorts: [{ propertyName: 'hs_last_sales_activity_date', direction: 'DESCENDING' }],
    };

    // Paginate and filter locally
    const allContacts: Contact[] = [];
    let after: string | undefined;
    let iterations = 0;
    const maxIterations = Math.ceil((limit * 3) / 100); // Fetch more since we filter locally

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
        const jobtitle = contact.properties.jobtitle;
        const email = contact.properties.email;

        // Skip if requiring title and none provided
        if (requireTitle && (!jobtitle || jobtitle.trim() === '')) {
          continue;
        }

        // Skip government emails
        if (isGovernmentEmail(email)) {
          continue;
        }

        // Match persona
        const matchedPersona = matchPersona(jobtitle);

        // If personas filter is set, only include matching personas
        if (personas.length > 0) {
          if (!matchedPersona || !personas.includes(matchedPersona)) {
            continue;
          }
        }

        allContacts.push({
          id: contact.id,
          firstname: contact.properties.firstname || '',
          lastname: contact.properties.lastname || '',
          email: email || '',
          jobtitle: jobtitle || '',
          company: contact.properties.company || '',
          companyId: contact.properties.associatedcompanyid || '',
          lifecyclestage: contact.properties.lifecyclestage || '',
          lastActivity: getLastActivity(contact.properties),
          matchedPersona,
        });

        if (allContacts.length >= limit) break;
      }

      if (allContacts.length >= limit) break;
      after = response.paging?.next?.after;
      if (!after) break;
      iterations++;
    }

    // Build persona breakdown
    const personaBreakdown: Record<string, number> = {};
    for (const contact of allContacts) {
      const persona = contact.matchedPersona || 'unknown';
      personaBreakdown[persona] = (personaBreakdown[persona] || 0) + 1;
    }

    // Count unique companies
    const uniqueCompanies = new Set(allContacts.map((c) => c.companyId).filter(Boolean));

    return res.status(200).json({
      success: true,
      contacts: allContacts,
      total: allContacts.length,
      companies: uniqueCompanies.size,
      personaBreakdown,
    });
  } catch (error) {
    console.error('Error getting company contacts:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
