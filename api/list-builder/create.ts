import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';
const PORTAL_ID = '19933594';

interface Filter {
  propertyName: string;
  operator: string;
  value?: string;
  values?: string[];
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

// Convert our filter format to HubSpot's filterBranch format for active lists
function buildFilterBranch(filters: Filter[]): unknown {
  if (filters.length === 0) {
    return { filterBranchType: 'AND', filterBranches: [], filters: [] };
  }

  const hubspotFilters = filters.map((f) => {
    const filter: {
      filterType: string;
      property: string;
      operation: { operationType: string; value?: string; values?: string[]; includeObjectsWithNoValueSet?: boolean };
    } = {
      filterType: 'PROPERTY',
      property: f.propertyName,
      operation: {
        operationType: mapOperator(f.operator),
      },
    };

    if (f.value !== undefined) {
      filter.operation.value = f.value;
    }
    if (f.values !== undefined) {
      filter.operation.values = f.values;
    }
    if (f.operator === 'NOT_HAS_PROPERTY') {
      filter.operation.includeObjectsWithNoValueSet = true;
    }

    return filter;
  });

  return {
    filterBranchType: 'AND',
    filterBranches: [],
    filters: hubspotFilters,
  };
}

function mapOperator(operator: string): string {
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
    HAS_PROPERTY: 'HAS_PROPERTY',
    NOT_HAS_PROPERTY: 'HAS_PROPERTY', // handled with includeObjectsWithNoValueSet
  };
  return mapping[operator] || operator;
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
  // HubSpot list URL format varies by object type
  if (objectType === 'contacts') {
    return `https://app.hubspot.com/contacts/${PORTAL_ID}/lists/${listId}`;
  }
  return `https://app.hubspot.com/contacts/${PORTAL_ID}/objects/${getObjectTypeId(objectType)}/views/${listId}/list`;
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

    if (listType === 'static' && (!recordIds || recordIds.length === 0)) {
      return res.status(400).json({ error: 'recordIds required for static list' });
    }

    if (listType === 'active' && (!filters || filters.length === 0)) {
      return res.status(400).json({ error: 'filters required for active list' });
    }

    const objectTypeId = getObjectTypeId(objectType);

    let listResponse: { listId?: string; list?: { listId?: string } };

    if (listType === 'static') {
      // Create static (manual) list
      listResponse = await hubspotRequest('POST', '/crm/v3/lists', {
        name,
        objectTypeId,
        processingType: 'MANUAL',
      }) as typeof listResponse;

      const listId = listResponse.listId || listResponse.list?.listId;

      if (!listId) {
        throw new Error('Failed to get list ID from response');
      }

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

      return res.status(200).json({
        success: true,
        listId,
        listUrl: getListUrl(objectType, listId),
        listType: 'static',
        recordCount: recordIds!.length,
      });
    } else {
      // Create active (dynamic) list
      const filterBranch = buildFilterBranch(filters!);

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
