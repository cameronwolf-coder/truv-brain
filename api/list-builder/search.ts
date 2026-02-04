import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Property cache (shared with list-builder handlers)
const propertyCache: Record<string, { data: HubSpotProperty[]; timestamp: number }> = {};
const CACHE_TTL = 60 * 60 * 1000;

interface Filter {
  propertyName: string;
  operator: string;
  value?: string;
  values?: string[];
}

interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  options?: Array<{ value: string; label: string }>;
}

interface HubSpotRecord {
  id: string;
  properties: Record<string, string>;
}

interface SearchResult {
  records: HubSpotRecord[];
  total: number;
  summary: {
    byProperty: Record<string, Record<string, number>>;
    dateRange: { oldest: string | null; newest: string | null };
  };
}

// Results cache (30 min TTL)
const resultsCache: Record<string, { data: SearchResult; timestamp: number }> = {};
const RESULTS_CACHE_TTL = 30 * 60 * 1000;

function generateCacheKey(objectType: string, filters: Filter[]): string {
  return `${objectType}:${JSON.stringify(filters)}`;
}

async function hubspotRequest(method: string, endpoint: string, body?: unknown): Promise<unknown> {
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

  return response.json();
}

async function fetchProperties(objectType: string): Promise<HubSpotProperty[]> {
  const cached = propertyCache[objectType];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const response = await fetch(
    `${HUBSPOT_BASE_URL}/crm/v3/properties/${objectType}`,
    {
      headers: {
        Authorization: `Bearer ${HUBSPOT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HubSpot API error: ${response.status}`);
  }

  const data = await response.json();
  const properties = (data.results || []).map((p: HubSpotProperty) => ({
    name: p.name,
    label: p.label,
    type: p.type,
    fieldType: p.fieldType,
    options: p.options?.map((o) => ({ value: o.value, label: o.label })),
  }));

  propertyCache[objectType] = { data: properties, timestamp: Date.now() };
  return properties;
}

function buildHubSpotFilters(
  filters: Filter[],
  propertiesByName: Record<string, HubSpotProperty>
): Array<{ propertyName: string; operator: string; value?: string; values?: string[] }> {
  return filters.map((f) => {
    const property = propertiesByName[f.propertyName];
    const operator = mapSearchOperator(f.operator, property);
    const filter: { propertyName: string; operator: string; value?: string; values?: string[] } = {
      propertyName: f.propertyName,
      operator,
    };
    if (f.value !== undefined) filter.value = f.value;
    if (f.values !== undefined) filter.values = f.values;
    return filter;
  });
}

function mapSearchOperator(operator: string, property?: HubSpotProperty): string {
  if (operator === 'CONTAINS') return 'CONTAINS_TOKEN';
  if (operator === 'NOT_CONTAINS') return 'NOT_CONTAINS_TOKEN';

  if (property?.type === 'enumeration') {
    const mapping: Record<string, string> = {
      EQ: 'EQ',
      NEQ: 'NEQ',
      IN: 'IN',
      NOT_IN: 'NOT_IN',
      HAS_PROPERTY: 'HAS_PROPERTY',
      NOT_HAS_PROPERTY: 'NOT_HAS_PROPERTY',
      CONTAINS: 'CONTAINS_TOKEN',
      NOT_CONTAINS: 'NOT_CONTAINS_TOKEN',
    };
    return mapping[operator] || operator;
  }

  return operator;
}

async function searchWithPagination(
  objectType: string,
  filters: Filter[],
  properties: string[],
  propertiesByName: Record<string, HubSpotProperty>,
  maxResults: number = 10000
): Promise<HubSpotRecord[]> {
  const allRecords: HubSpotRecord[] = [];
  const seenIds = new Set<string>();
  let after: string | undefined;
  let batchCount = 0;
  const maxBatches = Math.ceil(maxResults / 100);

  const hubspotFilters = buildHubSpotFilters(filters, propertiesByName);

  while (batchCount < maxBatches) {
    const searchBody: {
      filterGroups: Array<{ filters: typeof hubspotFilters }>;
      properties: string[];
      limit: number;
      sorts: Array<{ propertyName: string; direction: string }>;
      after?: string;
    } = {
      filterGroups: hubspotFilters.length > 0 ? [{ filters: hubspotFilters }] : [],
      properties,
      limit: 100,
      sorts: [{ propertyName: 'lastmodifieddate', direction: 'DESCENDING' }],
    };

    if (after) {
      searchBody.after = after;
    }

    const response = await hubspotRequest(
      'POST',
      `/crm/v3/objects/${objectType}/search`,
      searchBody
    ) as {
      results?: HubSpotRecord[];
      paging?: { next?: { after: string } };
      total?: number;
    };

    const results = response.results || [];
    if (results.length === 0) break;

    for (const record of results) {
      if (!seenIds.has(record.id)) {
        seenIds.add(record.id);
        allRecords.push(record);
      }
    }

    after = response.paging?.next?.after;
    if (!after) break;

    batchCount++;

    // Rate limiting: 110ms between requests
    await new Promise((resolve) => setTimeout(resolve, 110));
  }

  return allRecords;
}

async function searchWithBatching(
  objectType: string,
  filters: Filter[],
  properties: string[],
  propertiesByName: Record<string, HubSpotProperty>
): Promise<HubSpotRecord[]> {
  // First, try regular pagination
  let allRecords = await searchWithPagination(objectType, filters, properties, propertiesByName, 10000);

  // If we hit 10k, batch by date ranges
  if (allRecords.length >= 9900) {
    const seenIds = new Set(allRecords.map((r) => r.id));
    let oldestDate = allRecords[allRecords.length - 1]?.properties?.lastmodifieddate;

    while (oldestDate) {
      const batchFilters: Filter[] = [
        ...filters,
        { propertyName: 'lastmodifieddate', operator: 'LT', value: oldestDate },
      ];

      const batchRecords = await searchWithPagination(objectType, batchFilters, properties, propertiesByName, 10000);

      if (batchRecords.length === 0) break;

      let addedAny = false;
      for (const record of batchRecords) {
        if (!seenIds.has(record.id)) {
          seenIds.add(record.id);
          allRecords.push(record);
          addedAny = true;
        }
      }

      if (!addedAny || batchRecords.length < 100) break;

      oldestDate = batchRecords[batchRecords.length - 1]?.properties?.lastmodifieddate;
    }
  }

  return allRecords;
}

function computeSummary(records: HubSpotRecord[], summaryProperties: string[]): SearchResult['summary'] {
  const byProperty: Record<string, Record<string, number>> = {};
  let oldest: string | null = null;
  let newest: string | null = null;

  for (const prop of summaryProperties) {
    byProperty[prop] = {};
  }

  for (const record of records) {
    for (const prop of summaryProperties) {
      const value = record.properties[prop] || 'Unknown';
      byProperty[prop][value] = (byProperty[prop][value] || 0) + 1;
    }

    const modified = record.properties.lastmodifieddate;
    if (modified) {
      if (!oldest || modified < oldest) oldest = modified;
      if (!newest || modified > newest) newest = modified;
    }
  }

  return {
    byProperty,
    dateRange: { oldest, newest },
  };
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

  try {
    const { objectType = 'companies', filters = [], summaryProperties = [] } = req.body;

    if (!['companies', 'contacts', 'deals'].includes(objectType)) {
      return res.status(400).json({ error: 'Invalid objectType' });
    }

    // Check cache
    const cacheKey = generateCacheKey(objectType, filters);
    const cached = resultsCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < RESULTS_CACHE_TTL) {
      return res.status(200).json({
        success: true,
        ...cached.data,
        cached: true,
        cacheKey,
      });
    }

    // Default properties to fetch
    const defaultProps: Record<string, string[]> = {
      companies: ['name', 'domain', 'state', 'city', 'industry', 'sales_vertical', 'lifecyclestage', 'numberofemployees', 'lastmodifieddate', 'createdate'],
      contacts: ['firstname', 'lastname', 'email', 'jobtitle', 'company', 'lifecyclestage', 'sales_vertical', 'lastmodifieddate', 'createdate'],
      deals: ['dealname', 'amount', 'dealstage', 'closedate', 'lastmodifieddate', 'createdate'],
    };

    const properties = [...defaultProps[objectType]];

    // Add filter properties to fetch list
    for (const filter of filters) {
      if (!properties.includes(filter.propertyName)) {
        properties.push(filter.propertyName);
      }
    }

    const hubspotProperties = await fetchProperties(objectType);
    const propertiesByName = hubspotProperties.reduce<Record<string, HubSpotProperty>>((acc, prop) => {
      acc[prop.name] = prop;
      return acc;
    }, {});

    // Execute search
    const records = await searchWithBatching(objectType, filters, properties, propertiesByName);

    // Compute summary
    const defaultSummaryProps: Record<string, string[]> = {
      companies: ['state', 'sales_vertical', 'lifecyclestage'],
      contacts: ['lifecyclestage', 'sales_vertical'],
      deals: ['dealstage'],
    };
    const propsForSummary = summaryProperties.length > 0 ? summaryProperties : defaultSummaryProps[objectType] || [];
    const summary = computeSummary(records, propsForSummary);

    const result: SearchResult = {
      records,
      total: records.length,
      summary,
    };

    // Cache results
    resultsCache[cacheKey] = { data: result, timestamp: Date.now() };

    return res.status(200).json({
      success: true,
      ...result,
      cached: false,
      cacheKey,
    });
  } catch (error) {
    console.error('Error searching:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
