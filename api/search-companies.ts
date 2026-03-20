import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Company properties to fetch
const COMPANY_PROPERTIES = [
  'name',
  'industry',
  'numberofemployees',
  'annualrevenue',
  'domain',
  'city',
  'state',
];

// Mapping from Truv verticals to HubSpot industry patterns
const VERTICAL_TO_INDUSTRY: Record<string, string[]> = {
  Bank: ['Banking', 'Financial Services', 'Bank'],
  'Credit Union': ['Credit Union', 'Financial Services'],
  IMB: ['Mortgage', 'Financial Services', 'Lending', 'Real Estate'],
  'Background Screening': ['Human Resources', 'Staffing', 'Employment Services', 'Background Check'],
  Lending: ['Lending', 'Financial Services', 'Consumer Finance'],
  Fintech: ['Financial Technology', 'Fintech', 'Technology'],
  'Auto Lending': ['Automotive', 'Auto Finance', 'Consumer Finance'],
  'Tenant Screening': ['Real Estate', 'Property Management', 'Rental'],
};

interface CompanySearchFilters {
  industries?: string[]; // Truv verticals like "Bank", "IMB", etc.
  employeesMin?: number;
  employeesMax?: number;
  revenueMin?: number;
  revenueMax?: number;
  limit?: number;
}

interface Company {
  id: string;
  name: string;
  industry: string;
  employees: number | null;
  revenue: number | null;
  domain: string;
  location: string;
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

function buildHubSpotFilters(
  filters: CompanySearchFilters
): Array<{ propertyName: string; operator: string; value?: string; values?: string[] }> {
  const hubspotFilters: Array<{
    propertyName: string;
    operator: string;
    value?: string;
    values?: string[];
  }> = [];

  // Industry filter - map Truv verticals to HubSpot industries
  // Note: We'll do local filtering since HubSpot industry field is inconsistent
  // This filter is removed to get all companies, then we filter locally

  // Employee count filters
  if (filters.employeesMin) {
    hubspotFilters.push({
      propertyName: 'numberofemployees',
      operator: 'GTE',
      value: filters.employeesMin.toString(),
    });
  }

  if (filters.employeesMax) {
    hubspotFilters.push({
      propertyName: 'numberofemployees',
      operator: 'LTE',
      value: filters.employeesMax.toString(),
    });
  }

  // Revenue filters
  if (filters.revenueMin) {
    hubspotFilters.push({
      propertyName: 'annualrevenue',
      operator: 'GTE',
      value: filters.revenueMin.toString(),
    });
  }

  if (filters.revenueMax) {
    hubspotFilters.push({
      propertyName: 'annualrevenue',
      operator: 'LTE',
      value: filters.revenueMax.toString(),
    });
  }

  return hubspotFilters;
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
    const filters: CompanySearchFilters = req.body;
    const limit = Math.min(filters.limit || 200, 500);

    // Build HubSpot filters
    const hubspotFilters = buildHubSpotFilters(filters);

    // Search companies
    const searchBody = {
      filterGroups: hubspotFilters.length > 0 ? [{ filters: hubspotFilters }] : [],
      properties: COMPANY_PROPERTIES,
      limit: 100,
      sorts: [{ propertyName: 'numberofemployees', direction: 'DESCENDING' }],
    };

    // Paginate to get more results
    const allCompanies: Company[] = [];
    let after: string | undefined;
    let iterations = 0;
    const maxIterations = Math.ceil(limit / 100);

    while (iterations < maxIterations && allCompanies.length < limit) {
      const body = after ? { ...searchBody, after } : searchBody;
      const response = (await hubspotRequest(
        'POST',
        '/crm/v3/objects/companies/search',
        body
      )) as {
        results?: Array<{ id: string; properties: Record<string, string> }>;
        paging?: { next?: { after: string } };
      };

      const results = response.results || [];
      if (results.length === 0) break;

      for (const company of results) {
        allCompanies.push({
          id: company.id,
          name: company.properties.name || '',
          industry: company.properties.industry || '',
          employees: company.properties.numberofemployees
            ? parseInt(company.properties.numberofemployees)
            : null,
          revenue: company.properties.annualrevenue
            ? parseFloat(company.properties.annualrevenue)
            : null,
          domain: company.properties.domain || '',
          location: [company.properties.city, company.properties.state]
            .filter(Boolean)
            .join(', '),
        });

        if (allCompanies.length >= limit) break;
      }

      if (allCompanies.length >= limit) break;
      after = response.paging?.next?.after;
      if (!after) break;
      iterations++;
    }

    // Get unique industries for facets
    const industryFacets: Record<string, number> = {};
    for (const company of allCompanies) {
      if (company.industry) {
        industryFacets[company.industry] = (industryFacets[company.industry] || 0) + 1;
      }
    }

    return res.status(200).json({
      success: true,
      companies: allCompanies,
      total: allCompanies.length,
      industryFacets,
    });
  } catch (error) {
    console.error('Error searching companies:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
