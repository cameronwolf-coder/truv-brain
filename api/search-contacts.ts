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
  'hs_email_last_open_date',
  'hs_email_last_click_date',
  'notes_last_updated',
  'hs_last_sales_activity_date',
  'annualrevenue',
  'numberofemployees',
  'createdate',
];

interface SearchFilters {
  verticals?: string[];
  personas?: string[];
  excludeStages?: string[];
  engagement?: {
    emailOpensWithin?: number;
    emailClicksWithin?: number;
    noActivityDays?: number;
  };
  firmographic?: {
    companySizeMin?: number;
    companySizeMax?: number;
    revenueMin?: number;
    revenueMax?: number;
  };
  timeFilters?: {
    createdWithinDays?: number;
    lastActivityWithinDays?: number;
  };
  limit?: number;
  requireTitle?: boolean; // Only include contacts with job titles
}

interface Contact {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  jobtitle: string;
  company: string;
  lifecyclestage: string;
  lastActivity: string | null;
  vertical: string;
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

function buildHubSpotFilters(filters: SearchFilters): Array<{ propertyName: string; operator: string; value?: string; values?: string[] }> {
  const hubspotFilters: Array<{ propertyName: string; operator: string; value?: string; values?: string[] }> = [];

  // Exclude lifecycle stages
  if (filters.excludeStages && filters.excludeStages.length > 0) {
    hubspotFilters.push({
      propertyName: 'lifecyclestage',
      operator: 'NOT_IN',
      values: filters.excludeStages,
    });
  }

  // Note: Vertical filtering is done locally for more accurate matching
  // and to handle multiple verticals with OR logic

  // Time filters - created within days
  if (filters.timeFilters?.createdWithinDays) {
    const date = new Date();
    date.setDate(date.getDate() - filters.timeFilters.createdWithinDays);
    hubspotFilters.push({
      propertyName: 'createdate',
      operator: 'GTE',
      value: date.getTime().toString(),
    });
  }

  // Engagement - email opens within days
  if (filters.engagement?.emailOpensWithin) {
    const date = new Date();
    date.setDate(date.getDate() - filters.engagement.emailOpensWithin);
    hubspotFilters.push({
      propertyName: 'hs_email_last_open_date',
      operator: 'GTE',
      value: date.getTime().toString(),
    });
  }

  // Engagement - no activity (dormant)
  if (filters.engagement?.noActivityDays) {
    const date = new Date();
    date.setDate(date.getDate() - filters.engagement.noActivityDays);
    hubspotFilters.push({
      propertyName: 'hs_last_sales_activity_date',
      operator: 'LTE',
      value: date.getTime().toString(),
    });
  }

  // Firmographic - company size
  if (filters.firmographic?.companySizeMin) {
    hubspotFilters.push({
      propertyName: 'numberofemployees',
      operator: 'GTE',
      value: filters.firmographic.companySizeMin.toString(),
    });
  }

  if (filters.firmographic?.companySizeMax) {
    hubspotFilters.push({
      propertyName: 'numberofemployees',
      operator: 'LTE',
      value: filters.firmographic.companySizeMax.toString(),
    });
  }

  // Revenue filters
  if (filters.firmographic?.revenueMin) {
    hubspotFilters.push({
      propertyName: 'annualrevenue',
      operator: 'GTE',
      value: filters.firmographic.revenueMin.toString(),
    });
  }

  if (filters.firmographic?.revenueMax) {
    hubspotFilters.push({
      propertyName: 'annualrevenue',
      operator: 'LTE',
      value: filters.firmographic.revenueMax.toString(),
    });
  }

  return hubspotFilters;
}

function matchesPersona(jobtitle: string | undefined, personas: string[], requireTitle: boolean): boolean {
  // If no personas selected and not requiring title, allow all
  if (personas.length === 0 && !requireTitle) return true;

  // If requiring title or personas selected, must have a job title
  if (!jobtitle || jobtitle.trim() === '') return false;

  // If no personas selected but requiring title, allow any with title
  if (personas.length === 0) return true;

  const lowerTitle = jobtitle.toLowerCase();

  for (const persona of personas) {
    const patterns = PERSONA_PATTERNS[persona];
    if (patterns) {
      for (const pattern of patterns) {
        if (lowerTitle.includes(pattern.toLowerCase())) {
          return true;
        }
      }
    }
  }

  return false;
}

// Vertical matching patterns - more specific matching
const VERTICAL_PATTERNS: Record<string, string[]> = {
  'Bank': ['bank', 'banking'],
  'Credit Union': ['credit union', 'cu '],
  'IMB': ['mortgage', 'imb', 'independent mortgage'],
  'Background Screening': ['background', 'screening', 'hr tech'],
  'Lending': ['lending', 'lender', 'loan'],
  'Fintech': ['fintech', 'neobank'],
  'Auto Lending': ['auto', 'car loan', 'vehicle'],
  'Tenant Screening': ['tenant', 'rental', 'property'],
};

// Domains that indicate government/public sector (should be excluded from commercial lists)
const GOVERNMENT_DOMAINS = ['.gov', '.mil', '.edu', 'state.', 'county.', 'city.'];

function matchesVertical(vertical: string | undefined, company: string | undefined, email: string | undefined, verticals: string[]): boolean {
  // If no verticals selected, allow all
  if (verticals.length === 0) return true;

  // Check if it's a government email (usually not target for commercial lending)
  if (email) {
    const lowerEmail = email.toLowerCase();
    for (const govDomain of GOVERNMENT_DOMAINS) {
      if (lowerEmail.includes(govDomain)) {
        return false; // Exclude government contacts
      }
    }
  }

  // If contact has a vertical set, check if it matches
  if (vertical && vertical.trim() !== '') {
    const lowerVertical = vertical.toLowerCase();
    for (const selectedVertical of verticals) {
      // Direct match
      if (lowerVertical.includes(selectedVertical.toLowerCase())) {
        return true;
      }
      // Pattern match
      const patterns = VERTICAL_PATTERNS[selectedVertical];
      if (patterns) {
        for (const pattern of patterns) {
          if (lowerVertical.includes(pattern)) {
            return true;
          }
        }
      }
    }
    return false; // Has vertical but doesn't match
  }

  // If no vertical set, try to match by company name
  if (company && company.trim() !== '') {
    const lowerCompany = company.toLowerCase();
    for (const selectedVertical of verticals) {
      const patterns = VERTICAL_PATTERNS[selectedVertical];
      if (patterns) {
        for (const pattern of patterns) {
          if (lowerCompany.includes(pattern)) {
            return true;
          }
        }
      }
    }
  }

  // No vertical set and company doesn't match - exclude
  return false;
}

function getLastActivity(props: Record<string, string>): string | null {
  const dates = [
    props.hs_email_last_open_date,
    props.hs_last_sales_activity_date,
    props.notes_last_updated,
  ].filter(Boolean).map(d => new Date(d).getTime());

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
    const filters: SearchFilters = req.body;
    const limit = Math.min(filters.limit || 500, 1000); // Increased default and max
    const requireTitle = filters.requireTitle ?? true; // Default to requiring titles
    const personas = filters.personas || [];
    const verticals = filters.verticals || [];

    // Build HubSpot filters
    const hubspotFilters = buildHubSpotFilters(filters);

    // Search contacts
    const searchBody = {
      filterGroups: hubspotFilters.length > 0 ? [{ filters: hubspotFilters }] : [],
      properties: CONTACT_PROPERTIES,
      limit: 100,
      sorts: [{ propertyName: 'hs_last_sales_activity_date', direction: 'DESCENDING' }],
    };

    // Paginate to get more results - fetch more from HubSpot since we filter locally
    // When verticals are selected, we need to fetch even more since most won't match
    const allContacts: Contact[] = [];
    let after: string | undefined;
    let iterations = 0;
    const fetchMultiplier = verticals.length > 0 ? 10 : 3; // Fetch more when filtering by vertical
    const maxIterations = Math.ceil(limit * fetchMultiplier / 100);

    while (iterations < maxIterations && allContacts.length < limit) {
      const body = after ? { ...searchBody, after } : searchBody;
      const response = (await hubspotRequest('POST', '/crm/v3/objects/contacts/search', body)) as {
        results?: Array<{ id: string; properties: Record<string, string> }>;
        paging?: { next?: { after: string } };
      };

      const results = response.results || [];
      if (results.length === 0) break;

      // Filter by persona, vertical, and title requirement
      for (const contact of results) {
        // Check persona match (includes title requirement check)
        if (!matchesPersona(contact.properties.jobtitle, personas, requireTitle)) {
          continue;
        }

        // Check vertical match (includes government email exclusion)
        if (!matchesVertical(
          contact.properties.sales_vertical,
          contact.properties.company,
          contact.properties.email,
          verticals
        )) {
          continue;
        }

        allContacts.push({
          id: contact.id,
          firstname: contact.properties.firstname || '',
          lastname: contact.properties.lastname || '',
          email: contact.properties.email || '',
          jobtitle: contact.properties.jobtitle || '',
          company: contact.properties.company || '',
          lifecyclestage: contact.properties.lifecyclestage || '',
          lastActivity: getLastActivity(contact.properties),
          vertical: contact.properties.sales_vertical || '',
        });

        if (allContacts.length >= limit) break;
      }

      if (allContacts.length >= limit) break;
      after = response.paging?.next?.after;
      if (!after) break;
      iterations++;
    }

    // Count unique companies
    const companies = new Set(allContacts.map(c => c.company).filter(Boolean));

    // Group by persona for breakdown
    const personaBreakdown: Record<string, number> = {};
    for (const contact of allContacts) {
      const title = contact.jobtitle.toLowerCase();
      let matched = false;
      for (const [persona, patterns] of Object.entries(PERSONA_PATTERNS)) {
        if (patterns.some(p => title.includes(p.toLowerCase()))) {
          personaBreakdown[persona] = (personaBreakdown[persona] || 0) + 1;
          matched = true;
          break;
        }
      }
      if (!matched) {
        personaBreakdown['other'] = (personaBreakdown['other'] || 0) + 1;
      }
    }

    return res.status(200).json({
      success: true,
      contacts: allContacts,
      total: allContacts.length,
      companies: companies.size,
      personaBreakdown,
    });
  } catch (error) {
    console.error('Error searching contacts:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
