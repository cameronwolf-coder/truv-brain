import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';
const PORTAL_ID = '19933594';

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

  if (response.status === 204) return {};
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

// Convert our filter format to HubSpot's filterBranch format for active lists
function buildFilterBranch(
  filters: Filter[],
  propertiesByName: Record<string, HubSpotProperty>
): unknown {
  if (filters.length === 0) {
    return {
      filterBranchType: 'OR',
      filterBranches: [
        { filterBranchType: 'AND', filterBranches: [], filters: [] },
      ],
      filters: [],
    };
  }

  const filterSets = expandFilterSets(filters, propertiesByName);
  const filterBranches = filterSets.map((filterSet) => {
    const hubspotFilters = filterSet.map((f) => {
      const property = propertiesByName[f.propertyName];
      const normalized = normalizeFilterOperation(f, property);
      const filter: {
        filterType: string;
        property: string;
        operation: {
          operationType: string;
          operator: string;
          value?: string;
          values?: string[];
          includeObjectsWithNoValueSet?: boolean;
        };
      } = {
        filterType: 'PROPERTY',
        property: f.propertyName,
        operation: {
          operationType: normalized.operationType,
          operator: normalized.operator,
        },
      };

      if (normalized.value !== undefined) {
        filter.operation.value = normalized.value;
      }
      if (normalized.values !== undefined) {
        filter.operation.values = normalized.values;
      }

      return filter;
    });

    return {
      filterBranchType: 'AND',
      filterBranches: [],
      filters: hubspotFilters,
    };
  });

  return {
    filterBranchType: 'OR',
    filterBranches,
    filters: [],
  };
}

function expandFilterSets(
  filters: Filter[],
  propertiesByName: Record<string, HubSpotProperty>
): Filter[][] {
  let branches: Filter[][] = [[]];

  for (const filter of filters) {
    const property = propertiesByName[filter.propertyName];
    const isEnumeration = property?.type === 'enumeration';
    const values = (filter.values || []).filter(Boolean);
    const value = filter.value?.trim();
    const allValues = values.length > 0 ? values : value ? [value] : [];

    if (!isEnumeration && filter.operator === 'IN') {
      if (allValues.length === 0) {
        throw new Error(`Invalid filter: ${filter.propertyName} IN requires values`);
      }
      const nextBranches: Filter[][] = [];
      for (const branch of branches) {
        for (const v of allValues) {
          nextBranches.push([
            ...branch,
            {
              propertyName: filter.propertyName,
              operator: 'EQ',
              value: v,
            },
          ]);
        }
      }
      branches = nextBranches;
      continue;
    }

    if (!isEnumeration && filter.operator === 'NOT_IN') {
      if (allValues.length === 0) {
        throw new Error(`Invalid filter: ${filter.propertyName} NOT_IN requires values`);
      }
      branches = branches.map((branch) => [
        ...branch,
        ...allValues.map((v) => ({
          propertyName: filter.propertyName,
          operator: 'NEQ',
          value: v,
        })),
      ]);
      continue;
    }

    branches = branches.map((branch) => [...branch, filter]);
  }

  return branches;
}

function mapOperator(operator: string, property?: HubSpotProperty): string {
  if (operator === 'HAS_PROPERTY') return 'IS_KNOWN';
  if (operator === 'NOT_HAS_PROPERTY') return 'IS_UNKNOWN';

  if (property?.type === 'enumeration') {
    const mapping: Record<string, string> = {
      EQ: 'IS_EXACTLY',
      NEQ: 'IS_NOT_EXACTLY',
      IN: 'IS_ANY_OF',
      NOT_IN: 'IS_NONE_OF',
      CONTAINS: 'CONTAINS_ALL',
      NOT_CONTAINS: 'DOES_NOT_CONTAIN_ALL',
    };
    return mapping[operator] || operator;
  }

  const mapping: Record<string, string> = {
    EQ: 'IS_EQUAL_TO',
    NEQ: 'IS_NOT_EQUAL_TO',
    CONTAINS: 'CONTAINS',
    NOT_CONTAINS: 'DOES_NOT_CONTAIN',
    IN: 'IS_ANY_OF',
    NOT_IN: 'IS_NONE_OF',
    GT: 'IS_GREATER_THAN',
    GTE: 'IS_GREATER_THAN_OR_EQUAL_TO',
    LT: 'IS_LESS_THAN',
    LTE: 'IS_LESS_THAN_OR_EQUAL_TO',
  };
  return mapping[operator] || operator;
}

function normalizeFilterOperation(
  filter: Filter,
  property?: HubSpotProperty
): { operationType: string; operator: string; value?: string; values?: string[] } {
  if (filter.operator === 'HAS_PROPERTY' || filter.operator === 'NOT_HAS_PROPERTY') {
    return {
      operationType: 'ALL_PROPERTY',
      operator: mapOperator(filter.operator, property),
    };
  }

  if (filter.operator === 'IN' || filter.operator === 'NOT_IN') {
    const values = (filter.values || []).filter(Boolean);
    if (values.length === 0 && filter.value) {
      values.push(filter.value);
    }
    if (values.length === 0) {
      throw new Error(`Invalid filter: ${filter.propertyName} ${filter.operator} requires values`);
    }
    return {
      operationType: mapOperationType(property),
      operator: mapOperator(filter.operator, property),
      values,
    };
  }

  let value = filter.value?.trim();
  if (!value && filter.values && filter.values.length > 0) {
    value = filter.values[0]?.trim();
  }
  if (!value) {
    throw new Error(`Invalid filter: ${filter.propertyName} ${filter.operator} requires value`);
  }

  if (property?.type === 'enumeration') {
    const operator = filter.operator === 'NEQ' ? 'NOT_IN' : 'IN';
    const values = (filter.values || []).filter(Boolean);
    if (!values.includes(value)) {
      values.push(value);
    }
    return {
      operationType: mapOperationType(property),
      operator: mapOperator(operator, property),
      values,
    };
  }

  return {
    operationType: mapOperationType(property),
    operator: mapOperator(filter.operator, property),
    value,
  };
}

function mapOperationType(property?: HubSpotProperty): string {
  if (!property) return 'STRING';

  if (property.type === 'enumeration') {
    if (property.fieldType === 'checkbox') {
      return 'MULTISTRING';
    }
    return 'ENUMERATION';
  }

  if (property.type === 'number') return 'NUMBER';
  if (property.type === 'bool' || property.fieldType === 'booleancheckbox') return 'BOOL';
  if (property.type === 'datetime' || property.fieldType === 'datetime') return 'DATETIME';
  if (property.type === 'date' || property.fieldType === 'date') return 'DATE';

  return 'STRING';
}

function getObjectTypeId(objectType: string): string {
  const mapping: Record<string, string> = {
    contacts: '0-1',
    companies: '0-2',
    deals: '0-3',
    tickets: '0-5',
  };
  return mapping[objectType] || '0-2';
}

function getListUrl(objectType: string, listId: string): string {
  return `https://app.hubspot.com/contacts/${PORTAL_ID}/lists/${listId}`;
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
    const { name, recordIds, objectType = 'companies', listType = 'static', filters } = req.body as {
      name: string;
      recordIds?: string[];
      objectType?: string;
      listType?: 'static' | 'active';
      filters?: Filter[];
    };

    if (!name) {
      return res.status(400).json({ error: 'List name is required' });
    }

    if (listType === 'static' && ((!filters || filters.length === 0) && (!recordIds || recordIds.length === 0))) {
      return res.status(400).json({ error: 'recordIds or filters required for static list' });
    }

    if (listType === 'active' && (!filters || filters.length === 0)) {
      return res.status(400).json({ error: 'filters required for active list' });
    }

    const objectTypeId = getObjectTypeId(objectType);

    let listResponse: { listId?: string; list?: { listId?: string } };

    if (listType === 'static') {
      if (filters && filters.length > 0) {
        const properties = await fetchProperties(objectType);
        const propertiesByName = properties.reduce<Record<string, HubSpotProperty>>((acc, prop) => {
          acc[prop.name] = prop;
          return acc;
        }, {});
        const filterBranch = buildFilterBranch(filters, propertiesByName);

        listResponse = await hubspotRequest('POST', '/crm/v3/lists', {
          name,
          objectTypeId,
          processingType: 'SNAPSHOT',
          filterBranch,
        }) as typeof listResponse;
      } else {
        // Create static (manual) list
        listResponse = await hubspotRequest('POST', '/crm/v3/lists', {
          name,
          objectTypeId,
          processingType: 'MANUAL',
        }) as typeof listResponse;
      }

      const listId = listResponse.listId || listResponse.list?.listId;

      if (!listId) {
        throw new Error('Failed to get list ID from response');
      }

      if (!filters || filters.length === 0) {
        // Add members in batches of 500
        const batchSize = 500;
        for (let i = 0; i < recordIds!.length; i += batchSize) {
          const batch = recordIds!.slice(i, i + batchSize);
          await hubspotRequest('PUT', `/crm/v3/lists/${listId}/memberships/add`, batch);

          // Rate limiting
          if (i + batchSize < recordIds!.length) {
            await new Promise((resolve) => setTimeout(resolve, 110));
          }
        }
      }

      return res.status(200).json({
        success: true,
        listId,
        listUrl: getListUrl(objectType, listId),
        listType: 'static',
        recordCount: recordIds?.length,
      });
    } else {
      // Create active (dynamic) list
      const properties = await fetchProperties(objectType);
      const propertiesByName = properties.reduce<Record<string, HubSpotProperty>>((acc, prop) => {
        acc[prop.name] = prop;
        return acc;
      }, {});
      const filterBranch = buildFilterBranch(filters!, propertiesByName);

      listResponse = await hubspotRequest('POST', '/crm/v3/lists', {
        name,
        objectTypeId,
        processingType: 'DYNAMIC',
        filterBranch,
      }) as typeof listResponse;

      const listId = listResponse.listId || listResponse.list?.listId;

      if (!listId) {
        throw new Error('Failed to get list ID from response');
      }

      return res.status(200).json({
        success: true,
        listId,
        listUrl: getListUrl(objectType, listId),
        listType: 'active',
      });
    }
  } catch (error) {
    console.error('Error creating list:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
