import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Property cache (shared with properties.ts in production via module scope)
const propertyCache: Record<string, { data: HubSpotProperty[]; timestamp: number }> = {};
const CACHE_TTL = 60 * 60 * 1000;

interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  options?: Array<{ value: string; label: string }>;
}

interface HubSpotPropertyResponse {
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
  const properties = (data.results || []).map((p: HubSpotPropertyResponse) => ({
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

  1b. If the user specifies "A or B" for the same property, use a single filter with IN and values.

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
    return res.status(500).json({ error: 'Gemini API key not configured (set GEMINI_API_KEY or GOOGLE_AI_API_KEY)' });
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
