# Smart List Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a natural language HubSpot list builder powered by Gemini 2.0 Flash at `/smart-list-builder`.

**Architecture:** React frontend with Vercel serverless API endpoints. Gemini parses natural language queries into HubSpot filters. Results cached for 30 min, exportable to Google Sheets, creates static or active lists.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Gemini 2.0 Flash API, HubSpot CRM API v3, Google Sheets API.

---

## Task 1: Add Dependencies and Environment Setup

**Files:**
- Modify: `/Users/cameronwolf/Downloads/Projects/truv-brain/package.json`
- Modify: `/Users/cameronwolf/Downloads/Projects/truv-brain/.env.example`

**Step 1: Add googleapis dependency**

```bash
cd /Users/cameronwolf/Downloads/Projects/truv-brain && npm install googleapis
```

**Step 2: Update .env.example with new variables**

Add to `.env.example`:
```
# Gemini API
GEMINI_API_KEY=your-gemini-api-key

# Google Sheets (service account JSON, base64 encoded or raw)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

**Step 3: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add googleapis dependency for Smart List Builder"
```

---

## Task 2: Create HubSpot Properties Discovery Endpoint

**Files:**
- Create: `/Users/cameronwolf/Downloads/Projects/truv-brain/api/list-builder/properties.ts`

**Step 1: Create the endpoint**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// In-memory cache (persists across warm function invocations)
const propertyCache: Record<string, { data: unknown; timestamp: number }> = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  options?: Array<{ value: string; label: string }>;
}

async function fetchProperties(objectType: string): Promise<HubSpotProperty[]> {
  const cacheKey = objectType;
  const cached = propertyCache[cacheKey];

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as HubSpotProperty[];
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

  propertyCache[cacheKey] = { data: properties, timestamp: Date.now() };
  return properties;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  try {
    const objectType = (req.query.objectType as string) || 'companies';

    if (!['companies', 'contacts', 'deals'].includes(objectType)) {
      return res.status(400).json({ error: 'Invalid objectType. Must be companies, contacts, or deals.' });
    }

    const properties = await fetchProperties(objectType);

    return res.status(200).json({
      success: true,
      objectType,
      properties,
      cached: !!propertyCache[objectType],
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

**Step 2: Test locally**

```bash
cd /Users/cameronwolf/Downloads/Projects/truv-brain && npm run dev
# In another terminal:
curl "http://localhost:5173/api/list-builder/properties?objectType=companies"
```

Expected: JSON with `success: true` and array of properties.

**Step 3: Commit**

```bash
git add api/list-builder/properties.ts
git commit -m "feat: add HubSpot properties discovery endpoint"
```

---

## Task 3: Create Gemini Parse Endpoint

**Files:**
- Create: `/Users/cameronwolf/Downloads/Projects/truv-brain/api/list-builder/parse.ts`

**Step 1: Create the endpoint**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Property cache (shared with properties.ts in production via module scope)
const propertyCache: Record<string, { data: unknown; timestamp: number }> = {};
const CACHE_TTL = 60 * 60 * 1000;

interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  options?: Array<{ value: string; label: string }>;
}

interface ParsedFilter {
  propertyName: string;
  operator: string;
  value?: string;
  values?: string[];
}

interface ParseResponse {
  resolved: boolean;
  objectType?: string;
  filters?: ParsedFilter[];
  suggestedName?: string;
  canBeActiveList?: boolean;
  clarifications?: Array<{
    id: string;
    question: string;
    options: string[];
  }>;
  error?: string;
}

async function fetchProperties(objectType: string): Promise<HubSpotProperty[]> {
  const cached = propertyCache[objectType];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as HubSpotProperty[];
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

function buildSystemPrompt(properties: HubSpotProperty[], objectType: string): string {
  // Filter to most relevant properties for the prompt
  const relevantProperties = properties.filter((p) =>
    p.type === 'enumeration' ||
    ['state', 'city', 'name', 'domain', 'lifecyclestage', 'industry',
     'numberofemployees', 'annualrevenue', 'sales_vertical', 'jobtitle',
     'email', 'firstname', 'lastname', 'company', 'hs_lead_status',
     'createdate', 'lastmodifieddate', 'notes_last_contacted'].includes(p.name)
  );

  const propertiesJson = JSON.stringify(relevantProperties, null, 2);

  return `You are a HubSpot query parser. Given a natural language request and available HubSpot properties, output a JSON structure.

RULES:
1. Map user terms to actual property names. Common mappings for this HubSpot instance:
   - "government" or "gov" → sales_vertical = "Government"
   - "mortgage" or "IMB" → sales_vertical = "Mortgage" or industry patterns
   - State names should use full names (e.g., "California" not "CA") for the "state" property
   - "leads" → lifecyclestage = "lead"
   - "missing" or "empty" → use NOT_HAS_PROPERTY operator

2. Use the correct operator for each property type:
   - Enum: EQ, NEQ, IN, NOT_IN
   - Text: EQ, NEQ, CONTAINS, NOT_CONTAINS
   - Number: EQ, NEQ, GT, GTE, LT, LTE
   - Date: EQ, NEQ, GT, GTE, LT, LTE (use ISO format YYYY-MM-DD)
   - Boolean: EQ, NEQ
   - For "has value" use HAS_PROPERTY, for "missing/empty" use NOT_HAS_PROPERTY

3. If a term is ambiguous or doesn't match any property/value, add a clarification question.

4. Generate a descriptive list name based on the filters (e.g., "Gov Companies - CA, TX, NY - Feb 2025").

5. Determine if filters can be an active list. These CANNOT be active lists:
   - Queries involving associations (e.g., "contacts at government companies")
   - Queries using BETWEEN operator

OBJECT TYPE: ${objectType}

AVAILABLE PROPERTIES:
${propertiesJson}

OUTPUT FORMAT (JSON only, no markdown):
{
  "resolved": boolean,
  "objectType": "${objectType}",
  "filters": [{ "propertyName": string, "operator": string, "value"?: string, "values"?: string[] }],
  "suggestedName": string,
  "canBeActiveList": boolean,
  "clarifications": [{ "id": string, "question": string, "options": string[] }]
}

If resolved is false, include clarifications array. If resolved is true, include filters array.`;
}

async function callGemini(systemPrompt: string, userQuery: string, clarificationResponse?: Record<string, string>): Promise<ParseResponse> {
  let fullPrompt = `${systemPrompt}\n\nUSER QUERY: ${userQuery}`;

  if (clarificationResponse && Object.keys(clarificationResponse).length > 0) {
    fullPrompt += `\n\nUSER CLARIFICATION RESPONSES: ${JSON.stringify(clarificationResponse)}`;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('No response from Gemini');
  }

  // Parse JSON from response (handle potential markdown code blocks)
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  }
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }

  return JSON.parse(jsonStr.trim());
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

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  if (!HUBSPOT_API_TOKEN) {
    return res.status(500).json({ error: 'HubSpot API token not configured' });
  }

  try {
    const { query, objectType = 'companies', clarificationResponse } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (!['companies', 'contacts', 'deals'].includes(objectType)) {
      return res.status(400).json({ error: 'Invalid objectType' });
    }

    // Fetch properties for the object type
    const properties = await fetchProperties(objectType);

    // Build system prompt and call Gemini
    const systemPrompt = buildSystemPrompt(properties, objectType);
    const parsed = await callGemini(systemPrompt, query, clarificationResponse);

    return res.status(200).json({
      success: true,
      ...parsed,
    });
  } catch (error) {
    console.error('Error parsing query:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

**Step 2: Test locally**

```bash
curl -X POST "http://localhost:5173/api/list-builder/parse" \
  -H "Content-Type: application/json" \
  -d '{"query": "All government companies in California", "objectType": "companies"}'
```

Expected: JSON with `resolved: true` and filters array.

**Step 3: Commit**

```bash
git add api/list-builder/parse.ts
git commit -m "feat: add Gemini-powered query parsing endpoint"
```

---

## Task 4: Create HubSpot Search Endpoint with Batching

**Files:**
- Create: `/Users/cameronwolf/Downloads/Projects/truv-brain/api/list-builder/search.ts`

**Step 1: Create the endpoint**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

interface Filter {
  propertyName: string;
  operator: string;
  value?: string;
  values?: string[];
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
const CACHE_TTL = 30 * 60 * 1000;

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

function buildHubSpotFilters(filters: Filter[]): Array<{ propertyName: string; operator: string; value?: string; values?: string[] }> {
  return filters.map((f) => {
    const filter: { propertyName: string; operator: string; value?: string; values?: string[] } = {
      propertyName: f.propertyName,
      operator: f.operator,
    };
    if (f.value !== undefined) filter.value = f.value;
    if (f.values !== undefined) filter.values = f.values;
    return filter;
  });
}

async function searchWithPagination(
  objectType: string,
  filters: Filter[],
  properties: string[],
  maxResults: number = 10000
): Promise<HubSpotRecord[]> {
  const allRecords: HubSpotRecord[] = [];
  const seenIds = new Set<string>();
  let after: string | undefined;
  let batchCount = 0;
  const maxBatches = Math.ceil(maxResults / 100);

  const hubspotFilters = buildHubSpotFilters(filters);

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
  properties: string[]
): Promise<HubSpotRecord[]> {
  // First, try regular pagination
  let allRecords = await searchWithPagination(objectType, filters, properties, 10000);

  // If we hit 10k, batch by date ranges
  if (allRecords.length >= 9900) {
    const seenIds = new Set(allRecords.map((r) => r.id));
    let oldestDate = allRecords[allRecords.length - 1]?.properties?.lastmodifieddate;

    while (oldestDate) {
      const batchFilters: Filter[] = [
        ...filters,
        { propertyName: 'lastmodifieddate', operator: 'LT', value: oldestDate },
      ];

      const batchRecords = await searchWithPagination(objectType, batchFilters, properties, 10000);

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
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
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

    const properties = defaultProps[objectType] || [];

    // Add filter properties to fetch list
    for (const filter of filters) {
      if (!properties.includes(filter.propertyName)) {
        properties.push(filter.propertyName);
      }
    }

    // Execute search
    const records = await searchWithBatching(objectType, filters, properties);

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
```

**Step 2: Test locally**

```bash
curl -X POST "http://localhost:5173/api/list-builder/search" \
  -H "Content-Type: application/json" \
  -d '{"objectType": "companies", "filters": [{"propertyName": "sales_vertical", "operator": "EQ", "value": "Government"}]}'
```

Expected: JSON with records array and summary.

**Step 3: Commit**

```bash
git add api/list-builder/search.ts
git commit -m "feat: add HubSpot search endpoint with pagination and batching"
```

---

## Task 5: Create Google Sheets Export Endpoint

**Files:**
- Create: `/Users/cameronwolf/Downloads/Projects/truv-brain/api/list-builder/export-sheet.ts`

**Step 1: Create the endpoint**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

interface Record {
  id: string;
  properties: Record<string, string>;
}

function getServiceAccountCredentials(): { client_email: string; private_key: string } | null {
  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!jsonStr) return null;

  try {
    // Handle both raw JSON and base64-encoded JSON
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Try base64 decode
      parsed = JSON.parse(Buffer.from(jsonStr, 'base64').toString('utf-8'));
    }
    return parsed;
  } catch {
    return null;
  }
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

  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    return res.status(500).json({ error: 'Google service account not configured' });
  }

  try {
    const { records, name, columns, shareWithEmail } = req.body as {
      records: Record[];
      name: string;
      columns?: string[];
      shareWithEmail?: string;
    };

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Records array is required' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Sheet name is required' });
    }

    // Authenticate with Google
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Determine columns from first record if not specified
    const cols = columns || ['id', ...Object.keys(records[0]?.properties || {})];

    // Build header row
    const headerRow = cols.map((col) => {
      if (col === 'id') return 'HubSpot ID';
      // Convert camelCase/snake_case to Title Case
      return col
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
    });

    // Build data rows
    const dataRows = records.map((record) => {
      return cols.map((col) => {
        if (col === 'id') return record.id;
        return record.properties[col] || '';
      });
    });

    // Add HubSpot URL column
    headerRow.push('HubSpot URL');
    const objectType = 'companies'; // Could be parameterized
    const portalId = '19933594';
    dataRows.forEach((row, idx) => {
      const recordId = records[idx].id;
      row.push(`https://app.hubspot.com/contacts/${portalId}/company/${recordId}`);
    });

    // Create spreadsheet
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: name },
        sheets: [
          {
            properties: { title: 'Records' },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: [
                  { values: headerRow.map((v) => ({ userEnteredValue: { stringValue: v } })) },
                  ...dataRows.map((row) => ({
                    values: row.map((v) => ({ userEnteredValue: { stringValue: String(v) } })),
                  })),
                ],
              },
            ],
          },
        ],
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId;
    const spreadsheetUrl = spreadsheet.data.spreadsheetUrl;

    // Make it accessible via link (anyone with link can view)
    await drive.permissions.create({
      fileId: spreadsheetId!,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Optionally share with specific email as editor
    if (shareWithEmail) {
      await drive.permissions.create({
        fileId: spreadsheetId!,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: shareWithEmail,
        },
        sendNotificationEmail: false,
      });
    }

    return res.status(200).json({
      success: true,
      sheetId: spreadsheetId,
      sheetUrl: spreadsheetUrl,
      recordCount: records.length,
    });
  } catch (error) {
    console.error('Error creating sheet:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

**Step 2: Commit**

```bash
git add api/list-builder/export-sheet.ts
git commit -m "feat: add Google Sheets export endpoint"
```

---

## Task 6: Create List Creation Endpoint

**Files:**
- Create: `/Users/cameronwolf/Downloads/Projects/truv-brain/api/list-builder/create.ts`

**Step 1: Create the endpoint**

```typescript
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
        listUrl: `https://app.hubspot.com/contacts/${PORTAL_ID}/objects/${objectTypeId === '0-1' ? '0-1' : objectTypeId}/views/${listId}/list`,
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
        listUrl: `https://app.hubspot.com/contacts/${PORTAL_ID}/objects/${objectTypeId === '0-1' ? '0-1' : objectTypeId}/views/${listId}/list`,
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
```

**Step 2: Commit**

```bash
git add api/list-builder/create.ts
git commit -m "feat: add list creation endpoint for static and active lists"
```

---

## Task 7: Create SmartListBuilder React Page

**Files:**
- Create: `/Users/cameronwolf/Downloads/Projects/truv-brain/src/pages/SmartListBuilder.tsx`
- Modify: `/Users/cameronwolf/Downloads/Projects/truv-brain/src/main.tsx`

**Step 1: Create the page component**

```typescript
import { useState, useCallback } from 'react';

interface Filter {
  propertyName: string;
  operator: string;
  value?: string;
  values?: string[];
}

interface Clarification {
  id: string;
  question: string;
  options: string[];
}

interface Record {
  id: string;
  properties: Record<string, string>;
}

interface SearchResult {
  records: Record[];
  total: number;
  summary: {
    byProperty: Record<string, Record<string, number>>;
    dateRange: { oldest: string | null; newest: string | null };
  };
}

type Step = 'query' | 'clarify' | 'preview' | 'complete';

export function SmartListBuilder() {
  const [step, setStep] = useState<Step>('query');
  const [query, setQuery] = useState('');
  const [objectType, setObjectType] = useState<'companies' | 'contacts' | 'deals'>('companies');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse results
  const [filters, setFilters] = useState<Filter[]>([]);
  const [suggestedName, setSuggestedName] = useState('');
  const [canBeActiveList, setCanBeActiveList] = useState(true);
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [clarificationResponses, setClarificationResponses] = useState<Record<string, string>>({});

  // Search results
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

  // List creation
  const [listName, setListName] = useState('');
  const [listType, setListType] = useState<'static' | 'active'>('static');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [createdList, setCreatedList] = useState<{ listId: string; listUrl: string } | null>(null);

  // Export
  const [isExporting, setIsExporting] = useState(false);
  const [exportedSheet, setExportedSheet] = useState<{ sheetUrl: string } | null>(null);

  const handleParse = useCallback(async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/list-builder/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          objectType,
          clarificationResponse: Object.keys(clarificationResponses).length > 0 ? clarificationResponses : undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to parse query');
        return;
      }

      if (data.resolved) {
        setFilters(data.filters || []);
        setSuggestedName(data.suggestedName || '');
        setListName(data.suggestedName || '');
        setCanBeActiveList(data.canBeActiveList !== false);
        setClarifications([]);

        // Now search
        await handleSearch(data.filters);
      } else {
        setClarifications(data.clarifications || []);
        setStep('clarify');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsLoading(false);
    }
  }, [query, objectType, clarificationResponses]);

  const handleSearch = useCallback(async (searchFilters: Filter[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/list-builder/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectType,
          filters: searchFilters,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Search failed');
        return;
      }

      setSearchResult({
        records: data.records,
        total: data.total,
        summary: data.summary,
      });
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsLoading(false);
    }
  }, [objectType]);

  const handleClarificationSubmit = useCallback(() => {
    // Check all clarifications have responses
    for (const c of clarifications) {
      if (!clarificationResponses[c.id]) {
        setError('Please answer all questions');
        return;
      }
    }
    handleParse();
  }, [clarifications, clarificationResponses, handleParse]);

  const handleExportToSheets = useCallback(async () => {
    if (!searchResult) return;

    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch('/api/list-builder/export-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: searchResult.records,
          name: listName || suggestedName,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Export failed');
        return;
      }

      setExportedSheet({ sheetUrl: data.sheetUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsExporting(false);
    }
  }, [searchResult, listName, suggestedName]);

  const handleCreateList = useCallback(async () => {
    if (!searchResult || !listName.trim()) return;

    setIsCreatingList(true);
    setError(null);

    try {
      const body: {
        name: string;
        objectType: string;
        listType: 'static' | 'active';
        recordIds?: string[];
        filters?: Filter[];
      } = {
        name: listName,
        objectType,
        listType,
      };

      if (listType === 'static') {
        body.recordIds = searchResult.records.map((r) => r.id);
      } else {
        body.filters = filters;
      }

      const response = await fetch('/api/list-builder/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to create list');
        return;
      }

      setCreatedList({ listId: data.listId, listUrl: data.listUrl });
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsCreatingList(false);
    }
  }, [searchResult, listName, objectType, listType, filters]);

  const handleReset = () => {
    setStep('query');
    setQuery('');
    setFilters([]);
    setSuggestedName('');
    setCanBeActiveList(true);
    setClarifications([]);
    setClarificationResponses({});
    setSearchResult(null);
    setListName('');
    setListType('static');
    setCreatedList(null);
    setExportedSheet(null);
    setError(null);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Smart List Builder</h1>
            <p className="text-gray-500 mt-1">
              Describe what you need in plain English
            </p>
          </div>
          {step !== 'query' && (
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Start Over
            </button>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Step 1: Query Input */}
      {step === 'query' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Object Type
            </label>
            <div className="flex gap-2">
              {(['companies', 'contacts', 'deals'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setObjectType(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    objectType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Describe what you need
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., All government companies in California, Texas, and New York"
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleParse}
              disabled={!query.trim() || isLoading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
            >
              {isLoading ? 'Processing...' : 'Build Query'}
            </button>
          </div>

          {/* Example queries */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-3">Example queries:</p>
            <div className="flex flex-wrap gap-2">
              {[
                'All government companies in California',
                'Contacts with lifecycle stage lead',
                'Companies missing a state value',
                'Deals created in the last 30 days',
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => setQuery(example)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Clarifications */}
      {step === 'clarify' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            A few clarifying questions
          </h2>

          <div className="space-y-6">
            {clarifications.map((c) => (
              <div key={c.id}>
                <p className="text-sm font-medium text-gray-700 mb-2">{c.question}</p>
                <div className="flex flex-wrap gap-2">
                  {c.options.map((option) => (
                    <button
                      key={option}
                      onClick={() =>
                        setClarificationResponses((prev) => ({ ...prev, [c.id]: option }))
                      }
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        clarificationResponses[c.id] === option
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={() => {
                setStep('query');
                setClarifications([]);
                setClarificationResponses({});
              }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleClarificationSubmit}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
            >
              {isLoading ? 'Processing...' : 'Continue'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && searchResult && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Results Preview</h2>
              <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {searchResult.total.toLocaleString()} {objectType}
              </span>
            </div>

            {/* Applied Filters */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Applied Filters:</p>
              <div className="flex flex-wrap gap-2">
                {filters.map((f, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-white border border-gray-200 rounded text-sm text-gray-700"
                  >
                    {f.propertyName} {f.operator} {f.value || f.values?.join(', ')}
                  </span>
                ))}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              {Object.entries(searchResult.summary.byProperty).map(([prop, values]) => (
                <div key={prop} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                    {prop.replace(/_/g, ' ')}
                  </p>
                  <div className="space-y-1">
                    {Object.entries(values)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([value, count]) => (
                        <div key={value} className="flex justify-between text-sm">
                          <span className="text-gray-700 truncate">{value || 'Unknown'}</span>
                          <span className="text-gray-500 ml-2">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Date Range</p>
                <p className="text-sm text-gray-700">
                  {formatDate(searchResult.summary.dateRange.oldest)} → {formatDate(searchResult.summary.dateRange.newest)}
                </p>
              </div>
            </div>

            {/* Sample Records */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Sample Records ({Math.min(15, searchResult.records.length)} of {searchResult.total})
              </p>
              <div className="max-h-64 overflow-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      {objectType === 'contacts' && (
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Email
                        </th>
                      )}
                      {filters.slice(0, 2).map((f) => (
                        <th
                          key={f.propertyName}
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                        >
                          {f.propertyName.replace(/_/g, ' ')}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Modified
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {searchResult.records.slice(0, 15).map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">
                          {objectType === 'contacts'
                            ? `${record.properties.firstname || ''} ${record.properties.lastname || ''}`.trim() || '—'
                            : record.properties.name || record.properties.dealname || '—'}
                        </td>
                        {objectType === 'contacts' && (
                          <td className="px-3 py-2 text-gray-600">
                            {record.properties.email || '—'}
                          </td>
                        )}
                        {filters.slice(0, 2).map((f) => (
                          <td key={f.propertyName} className="px-3 py-2 text-gray-600">
                            {record.properties[f.propertyName] || '—'}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-gray-500">
                          {formatDate(record.properties.lastmodifieddate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Actions Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-medium text-gray-900 mb-4">Create List</h3>

            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">List Name</label>
              <input
                type="text"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="Enter list name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Exported Sheet Link */}
            {exportedSheet && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">
                  Exported to Google Sheets:{' '}
                  <a
                    href={exportedSheet.sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    Open Sheet
                  </a>
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleExportToSheets}
                disabled={isExporting}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 text-gray-700 font-medium rounded-lg transition-colors"
              >
                {isExporting ? 'Exporting...' : 'Export to Sheets'}
              </button>

              <button
                onClick={() => {
                  setListType('static');
                  handleCreateList();
                }}
                disabled={isCreatingList || !listName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
              >
                {isCreatingList ? 'Creating...' : 'Create Static List'}
              </button>

              <button
                onClick={() => {
                  setListType('active');
                  handleCreateList();
                }}
                disabled={isCreatingList || !listName.trim() || !canBeActiveList}
                title={!canBeActiveList ? 'This query cannot be converted to an active list' : ''}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
              >
                {isCreatingList ? 'Creating...' : 'Create Active List'}
              </button>
            </div>

            {!canBeActiveList && (
              <p className="mt-2 text-xs text-gray-500">
                Active list not available: this query uses filters or associations that can't be represented as an active list.
              </p>
            )}
          </div>

          <div className="flex justify-start">
            <button
              onClick={() => setStep('query')}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ← Modify Query
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 'complete' && createdList && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-2">List Created!</h2>
          <p className="text-gray-600 mb-6">
            {searchResult?.total.toLocaleString()} {objectType} added to "{listName}"
          </p>

          <div className="flex justify-center gap-4">
            <a
              href={createdList.listUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Open in HubSpot
            </a>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Build Another List
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add route to main.tsx**

In `/Users/cameronwolf/Downloads/Projects/truv-brain/src/main.tsx`, add:

```typescript
import { SmartListBuilder } from './pages/SmartListBuilder';
```

And add to the router children array:

```typescript
{
  path: 'smart-list-builder',
  element: <SmartListBuilder />,
},
```

**Step 3: Commit**

```bash
git add src/pages/SmartListBuilder.tsx src/main.tsx
git commit -m "feat: add SmartListBuilder page with NLP interface"
```

---

## Task 8: Add Navigation Link

**Files:**
- Modify: `/Users/cameronwolf/Downloads/Projects/truv-brain/src/components/Layout.tsx` (or wherever nav is defined)

**Step 1: Find and update navigation**

Add a link to Smart List Builder in the navigation, near the existing List Builder link:

```typescript
{ path: '/smart-list-builder', label: 'Smart List Builder' },
```

**Step 2: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "feat: add Smart List Builder to navigation"
```

---

## Task 9: Test End-to-End

**Step 1: Start dev server**

```bash
cd /Users/cameronwolf/Downloads/Projects/truv-brain && npm run dev
```

**Step 2: Test the flow**

1. Navigate to `/smart-list-builder`
2. Enter query: "All government companies in California"
3. Verify Gemini parses it correctly
4. Verify HubSpot search returns results
5. Test "Export to Sheets" (requires GOOGLE_SERVICE_ACCOUNT_JSON env var)
6. Test "Create Static List"
7. Verify list appears in HubSpot

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Smart List Builder implementation"
```

---

## Summary

**Files Created:**
- `api/list-builder/properties.ts` - HubSpot property discovery
- `api/list-builder/parse.ts` - Gemini NLP parsing
- `api/list-builder/search.ts` - HubSpot search with batching
- `api/list-builder/export-sheet.ts` - Google Sheets export
- `api/list-builder/create.ts` - List creation (static/active)
- `src/pages/SmartListBuilder.tsx` - React page component

**Files Modified:**
- `package.json` - Added googleapis dependency
- `.env.example` - Added new env vars
- `src/main.tsx` - Added route
- `src/components/Layout.tsx` - Added nav link

**Environment Variables Required:**
- `HUBSPOT_API_TOKEN` (existing)
- `GEMINI_API_KEY` (new)
- `GOOGLE_SERVICE_ACCOUNT_JSON` (new, for Sheets export)
