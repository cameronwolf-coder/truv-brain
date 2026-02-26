# Fire Enrich Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build AI-powered data enrichment tool with CSV upload, real-time streaming, and 4 specialized AI agents.

**Architecture:** React frontend with Vercel serverless functions using SSE streaming. Firecrawl for web scraping, OpenAI for data extraction.

**Tech Stack:** React 19, TypeScript, Vite, Vercel Functions, OpenAI API, Firecrawl API, Server-Sent Events

---

## Task 1: Setup Dependencies and Environment

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `.env` (local only, not committed)

**Step 1: Install npm dependencies**

Run:
```bash
npm install openai eventsource-parser
```

Expected: Dependencies installed successfully

**Step 2: Update .env.example with new API keys**

Add to `.env.example`:
```bash
HUBSPOT_API_TOKEN=your-hubspot-private-app-token-here
OPENAI_API_KEY=your-openai-api-key-here
FIRECRAWL_API_KEY=your-firecrawl-api-key-here
```

**Step 3: Add API keys to local .env**

Add to `.env` (do not commit):
```bash
OPENAI_API_KEY=sk-your-actual-key
FIRECRAWL_API_KEY=fc-your-actual-key
```

**Step 4: Commit dependency changes**

```bash
git add package.json package-lock.json .env.example
git commit -m "feat: add OpenAI and eventsource-parser dependencies for enrichment"
```

---

## Task 2: Create TypeScript Types

**Files:**
- Create: `src/types/enrichment.ts`

**Step 1: Create enrichment types file**

Create `src/types/enrichment.ts`:
```typescript
export interface EnrichmentFieldValue {
  value: string | number | null;
  source_url: string;
  confidence: 'high' | 'medium' | 'low';
  agent: string;
}

export interface EnrichmentResult {
  email: string;
  original_data: Record<string, any>;
  enriched_data: Record<string, EnrichmentFieldValue>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface EnrichmentRequest {
  contacts: Array<{
    email: string;
    [key: string]: any;
  }>;
  fields: string[];
  source: 'csv';
}

export type StreamEventType =
  | { type: 'start'; contactId: string; email: string }
  | { type: 'progress'; contactId: string; field: string; value: any; source: string; confidence: 'high' | 'medium' | 'low'; agent: string }
  | { type: 'complete'; contactId: string; data: EnrichmentResult }
  | { type: 'error'; contactId: string; error: string }
  | { type: 'done'; total: number; successful: number; failed: number };

export interface AgentResult {
  field: string;
  value: string | number | null;
  source_url: string;
  confidence: 'high' | 'medium' | 'low';
  agent: string;
}

export interface Agent {
  name: string;
  fields: string[];
  execute: (domain: string, fields: string[]) => Promise<AgentResult[]>;
}

export const FIELD_CATEGORIES = {
  company: ['company_name', 'industry', 'company_size', 'headquarters', 'description', 'website'],
  fundraising: ['funding_stage', 'total_funding', 'latest_round', 'investors', 'valuation'],
  leadership: ['ceo_name', 'founders', 'key_executives', 'employee_count'],
  technology: ['tech_stack', 'main_products', 'integrations', 'target_market'],
} as const;

export const FIELD_BUNDLES = {
  quick: ['company_name', 'industry', 'company_size', 'funding_stage'],
  sales: [...FIELD_CATEGORIES.company, ...FIELD_CATEGORIES.fundraising],
  executive: [...FIELD_CATEGORIES.leadership, 'company_name', 'industry', 'company_size'],
  technical: [...FIELD_CATEGORIES.technology, 'company_name'],
  full: [
    ...FIELD_CATEGORIES.company,
    ...FIELD_CATEGORIES.fundraising,
    ...FIELD_CATEGORIES.leadership,
    ...FIELD_CATEGORIES.technology,
  ],
} as const;

export type FieldBundle = keyof typeof FIELD_BUNDLES;
```

**Step 2: Commit types**

```bash
git add src/types/enrichment.ts
git commit -m "feat: add TypeScript types for data enrichment"
```

---

## Task 3: Create Domain Extraction Utility

**Files:**
- Create: `src/utils/domainExtractor.ts`

**Step 1: Create domain extractor utility**

Create `src/utils/domainExtractor.ts`:
```typescript
const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'protonmail.com',
  'mail.com',
];

export interface DomainExtractionResult {
  domain: string | null;
  isPersonal: boolean;
  error?: string;
}

export function extractDomainFromEmail(email: string): DomainExtractionResult {
  if (!email || typeof email !== 'string') {
    return { domain: null, isPersonal: false, error: 'Invalid email' };
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { domain: null, isPersonal: false, error: 'Invalid email format' };
  }

  const domain = trimmedEmail.split('@')[1];

  if (!domain) {
    return { domain: null, isPersonal: false, error: 'Could not extract domain' };
  }

  const isPersonal = PERSONAL_EMAIL_DOMAINS.includes(domain);

  return { domain, isPersonal, error: undefined };
}

export function isValidBusinessEmail(email: string): boolean {
  const result = extractDomainFromEmail(email);
  return !!result.domain && !result.isPersonal && !result.error;
}
```

**Step 2: Commit domain extractor**

```bash
git add src/utils/domainExtractor.ts
git commit -m "feat: add domain extraction utility for emails"
```

---

## Task 4: Create CSV Parser Utility

**Files:**
- Create: `src/utils/csvParser.ts`

**Step 1: Create CSV parser utility**

Create `src/utils/csvParser.ts`:
```typescript
export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  emailColumn: string | null;
}

export function parseCSV(csvContent: string): ParsedCSV {
  const lines = csvContent.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    return { headers: [], rows: [], emailColumn: null };
  }

  // Parse headers
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  // Detect email column
  const emailColumn = detectEmailColumn(headers);

  // Parse rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue; // Skip malformed rows

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return { headers, rows, emailColumn };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function detectEmailColumn(headers: string[]): string | null {
  const emailPatterns = ['email', 'e-mail', 'mail', 'contact'];

  for (const header of headers) {
    const lowerHeader = header.toLowerCase();
    if (emailPatterns.some(pattern => lowerHeader.includes(pattern))) {
      return header;
    }
  }

  return null;
}

export function validateEmailColumn(rows: Record<string, string>[], columnName: string): boolean {
  if (rows.length === 0) return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validEmails = rows.filter(row => emailRegex.test(row[columnName]));

  // At least 50% of rows should have valid emails
  return validEmails.length / rows.length >= 0.5;
}
```

**Step 2: Commit CSV parser**

```bash
git add src/utils/csvParser.ts
git commit -m "feat: add CSV parsing utility with email detection"
```

---

## Task 5: Create CSV Exporter Utility

**Files:**
- Create: `src/utils/csvExporter.ts`

**Step 1: Create CSV exporter utility**

Create `src/utils/csvExporter.ts`:
```typescript
import { EnrichmentResult } from '../types/enrichment';

export function exportToCSV(results: EnrichmentResult[]): string {
  if (results.length === 0) return '';

  // Collect all unique fields from all results
  const allFields = new Set<string>();
  results.forEach(result => {
    Object.keys(result.original_data).forEach(key => allFields.add(key));
    Object.keys(result.enriched_data).forEach(key => allFields.add(key));
  });

  const headers = ['email', 'status', ...Array.from(allFields)];

  // Build CSV content
  const csvLines: string[] = [headers.join(',')];

  results.forEach(result => {
    const row: string[] = [
      escapeCSVValue(result.email),
      escapeCSVValue(result.status),
    ];

    allFields.forEach(field => {
      let value = '';

      // Check enriched data first, then original data
      if (result.enriched_data[field]) {
        value = String(result.enriched_data[field].value || '');
      } else if (result.original_data[field]) {
        value = String(result.original_data[field]);
      }

      row.push(escapeCSVValue(value));
    });

    csvLines.push(row.join(','));
  });

  return csvLines.join('\n');
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSVValue(value: any): string {
  const stringValue = String(value || '');

  // If value contains comma, newline, or quotes, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function copyToClipboard(results: EnrichmentResult[]): void {
  const tsvContent = exportToTSV(results);
  navigator.clipboard.writeText(tsvContent);
}

function exportToTSV(results: EnrichmentResult[]): string {
  if (results.length === 0) return '';

  const allFields = new Set<string>();
  results.forEach(result => {
    Object.keys(result.original_data).forEach(key => allFields.add(key));
    Object.keys(result.enriched_data).forEach(key => allFields.add(key));
  });

  const headers = ['email', 'status', ...Array.from(allFields)];
  const tsvLines: string[] = [headers.join('\t')];

  results.forEach(result => {
    const row: string[] = [result.email, result.status];

    allFields.forEach(field => {
      let value = '';
      if (result.enriched_data[field]) {
        value = String(result.enriched_data[field].value || '');
      } else if (result.original_data[field]) {
        value = String(result.original_data[field]);
      }
      row.push(value);
    });

    tsvLines.push(row.join('\t'));
  });

  return tsvLines.join('\n');
}
```

**Step 2: Commit CSV exporter**

```bash
git add src/utils/csvExporter.ts
git commit -m "feat: add CSV/TSV export utilities for enriched data"
```

---

## Task 6: Create Firecrawl Service

**Files:**
- Create: `src/services/firecrawl.ts`

**Step 1: Create Firecrawl client service**

Create `src/services/firecrawl.ts`:
```typescript
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

export interface FirecrawlSearchResult {
  url: string;
  title: string;
  description: string;
}

export interface FirecrawlScrapeResult {
  markdown: string;
  html: string;
  url: string;
}

export async function searchWeb(query: string, apiKey: string, limit: number = 5): Promise<FirecrawlSearchResult[]> {
  const response = await fetch(`${FIRECRAWL_API_URL}/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit,
    }),
  });

  if (!response.ok) {
    throw new Error(`Firecrawl search failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.results || [];
}

export async function scrapePage(url: string, apiKey: string): Promise<FirecrawlScrapeResult> {
  const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'html'],
    }),
  });

  if (!response.ok) {
    throw new Error(`Firecrawl scrape failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    markdown: data.markdown || '',
    html: data.html || '',
    url,
  };
}
```

**Step 2: Commit Firecrawl service**

```bash
git add src/services/firecrawl.ts
git commit -m "feat: add Firecrawl API service for web scraping"
```

---

## Task 7: Create Enrichment Agents (Backend)

**Files:**
- Create: `api/enrichment-agents.ts`

**Step 1: Create enrichment agents implementation**

Create `api/enrichment-agents.ts`:
```typescript
import OpenAI from 'openai';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

interface AgentResult {
  field: string;
  value: string | number | null;
  source_url: string;
  confidence: 'high' | 'medium' | 'low';
  agent: string;
}

interface FirecrawlSearchResult {
  url: string;
  markdown?: string;
}

async function searchWithFirecrawl(query: string, apiKey: string): Promise<FirecrawlSearchResult[]> {
  const response = await fetch(`${FIRECRAWL_API_URL}/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit: 3,
      scrapeOptions: {
        formats: ['markdown'],
      },
    }),
  });

  if (!response.ok) {
    console.error('Firecrawl search failed:', response.statusText);
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

async function extractWithOpenAI(
  content: string,
  fields: string[],
  systemPrompt: string,
  openai: OpenAI
): Promise<Record<string, string | number | null>> {
  const fieldsList = fields.join(', ');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Extract the following fields from this content: ${fieldsList}\n\nContent:\n${content}\n\nReturn JSON with keys: ${fieldsList}. Use null for missing data.`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const result = response.choices[0]?.message?.content;
  if (!result) return {};

  try {
    return JSON.parse(result);
  } catch {
    return {};
  }
}

export async function companyResearchAgent(
  domain: string,
  fields: string[],
  openaiKey: string,
  firecrawlKey: string
): Promise<AgentResult[]> {
  const openai = new OpenAI({ apiKey: openaiKey });
  const results: AgentResult[] = [];

  try {
    const searchQuery = `${domain} company information about us`;
    const searchResults = await searchWithFirecrawl(searchQuery, firecrawlKey);

    if (searchResults.length === 0) {
      fields.forEach(field => {
        results.push({
          field,
          value: null,
          source_url: '',
          confidence: 'low',
          agent: 'Company Research',
        });
      });
      return results;
    }

    const content = searchResults.map(r => r.markdown || '').join('\n\n');
    const sourceUrl = searchResults[0].url;

    const extracted = await extractWithOpenAI(
      content,
      fields,
      'Extract factual company information. Be concise and accurate. Return only verified information.',
      openai
    );

    fields.forEach(field => {
      const value = extracted[field];
      results.push({
        field,
        value: value !== undefined ? value : null,
        source_url: sourceUrl,
        confidence: value ? 'high' : 'low',
        agent: 'Company Research',
      });
    });
  } catch (error) {
    console.error('Company research agent error:', error);
    fields.forEach(field => {
      results.push({
        field,
        value: null,
        source_url: '',
        confidence: 'low',
        agent: 'Company Research',
      });
    });
  }

  return results;
}

export async function fundraisingAgent(
  domain: string,
  fields: string[],
  openaiKey: string,
  firecrawlKey: string
): Promise<AgentResult[]> {
  const openai = new OpenAI({ apiKey: openaiKey });
  const results: AgentResult[] = [];

  try {
    const companyName = domain.split('.')[0];
    const searchQuery = `${companyName} funding investment rounds`;
    const searchResults = await searchWithFirecrawl(searchQuery, firecrawlKey);

    if (searchResults.length === 0) {
      fields.forEach(field => {
        results.push({
          field,
          value: null,
          source_url: '',
          confidence: 'low',
          agent: 'Fundraising Intelligence',
        });
      });
      return results;
    }

    const content = searchResults.map(r => r.markdown || '').join('\n\n');
    const sourceUrl = searchResults[0].url;

    const extracted = await extractWithOpenAI(
      content,
      fields,
      'Find the most recent funding information with dates. Be precise about amounts and investors.',
      openai
    );

    fields.forEach(field => {
      const value = extracted[field];
      results.push({
        field,
        value: value !== undefined ? value : null,
        source_url: sourceUrl,
        confidence: value ? 'medium' : 'low',
        agent: 'Fundraising Intelligence',
      });
    });
  } catch (error) {
    console.error('Fundraising agent error:', error);
    fields.forEach(field => {
      results.push({
        field,
        value: null,
        source_url: '',
        confidence: 'low',
        agent: 'Fundraising Intelligence',
      });
    });
  }

  return results;
}

export async function leadershipAgent(
  domain: string,
  fields: string[],
  openaiKey: string,
  firecrawlKey: string
): Promise<AgentResult[]> {
  const openai = new OpenAI({ apiKey: openaiKey });
  const results: AgentResult[] = [];

  try {
    const searchQuery = `${domain} leadership team executives CEO founders`;
    const searchResults = await searchWithFirecrawl(searchQuery, firecrawlKey);

    if (searchResults.length === 0) {
      fields.forEach(field => {
        results.push({
          field,
          value: null,
          source_url: '',
          confidence: 'low',
          agent: 'People & Leadership',
        });
      });
      return results;
    }

    const content = searchResults.map(r => r.markdown || '').join('\n\n');
    const sourceUrl = searchResults[0].url;

    const extracted = await extractWithOpenAI(
      content,
      fields,
      'Identify key decision makers and their roles. Include full names and titles.',
      openai
    );

    fields.forEach(field => {
      const value = extracted[field];
      results.push({
        field,
        value: value !== undefined ? value : null,
        source_url: sourceUrl,
        confidence: value ? 'high' : 'low',
        agent: 'People & Leadership',
      });
    });
  } catch (error) {
    console.error('Leadership agent error:', error);
    fields.forEach(field => {
      results.push({
        field,
        value: null,
        source_url: '',
        confidence: 'low',
        agent: 'People & Leadership',
      });
    });
  }

  return results;
}

export async function technologyAgent(
  domain: string,
  fields: string[],
  openaiKey: string,
  firecrawlKey: string
): Promise<AgentResult[]> {
  const openai = new OpenAI({ apiKey: openaiKey });
  const results: AgentResult[] = [];

  try {
    const searchQuery = `${domain} technology stack products services`;
    const searchResults = await searchWithFirecrawl(searchQuery, firecrawlKey);

    if (searchResults.length === 0) {
      fields.forEach(field => {
        results.push({
          field,
          value: null,
          source_url: '',
          confidence: 'low',
          agent: 'Product & Technology',
        });
      });
      return results;
    }

    const content = searchResults.map(r => r.markdown || '').join('\n\n');
    const sourceUrl = searchResults[0].url;

    const extracted = await extractWithOpenAI(
      content,
      fields,
      'Identify technologies used and products offered. Focus on main tech stack and core products.',
      openai
    );

    fields.forEach(field => {
      const value = extracted[field];
      results.push({
        field,
        value: value !== undefined ? value : null,
        source_url: sourceUrl,
        confidence: value ? 'medium' : 'low',
        agent: 'Product & Technology',
      });
    });
  } catch (error) {
    console.error('Technology agent error:', error);
    fields.forEach(field => {
      results.push({
        field,
        value: null,
        source_url: '',
        confidence: 'low',
        agent: 'Product & Technology',
      });
    });
  }

  return results;
}
```

**Step 2: Commit enrichment agents**

```bash
git add api/enrichment-agents.ts
git commit -m "feat: add AI enrichment agents for company data extraction"
```

---

## Task 8: Create SSE Streaming Endpoint

**Files:**
- Create: `api/enrichment-stream.ts`

**Step 1: Create streaming API endpoint**

Create `api/enrichment-stream.ts`:
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  companyResearchAgent,
  fundraisingAgent,
  leadershipAgent,
  technologyAgent,
} from './enrichment-agents';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

const FIELD_TO_AGENT: Record<string, string> = {
  company_name: 'company',
  industry: 'company',
  company_size: 'company',
  headquarters: 'company',
  description: 'company',
  website: 'company',
  funding_stage: 'fundraising',
  total_funding: 'fundraising',
  latest_round: 'fundraising',
  investors: 'fundraising',
  valuation: 'fundraising',
  ceo_name: 'leadership',
  founders: 'leadership',
  key_executives: 'leadership',
  employee_count: 'leadership',
  tech_stack: 'technology',
  main_products: 'technology',
  integrations: 'technology',
  target_market: 'technology',
};

interface EnrichmentRequest {
  contacts: Array<{
    email: string;
    [key: string]: any;
  }>;
  fields: string[];
}

function extractDomain(email: string): string | null {
  const match = email.match(/@(.+)$/);
  return match ? match[1] : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!OPENAI_API_KEY || !FIRECRAWL_API_KEY) {
    return res.status(500).json({ error: 'API keys not configured' });
  }

  const { contacts, fields } = req.body as EnrichmentRequest;

  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'Contacts array required' });
  }

  if (!fields || !Array.isArray(fields) || fields.length === 0) {
    return res.status(400).json({ error: 'Fields array required' });
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let successful = 0;
  let failed = 0;

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const contactId = `contact-${i}`;

    // Send start event
    res.write(`data: ${JSON.stringify({ type: 'start', contactId, email: contact.email })}\n\n`);

    const domain = extractDomain(contact.email);

    if (!domain) {
      res.write(`data: ${JSON.stringify({ type: 'error', contactId, error: 'Invalid email format' })}\n\n`);
      failed++;
      continue;
    }

    try {
      // Group fields by agent
      const agentFields: Record<string, string[]> = {
        company: [],
        fundraising: [],
        leadership: [],
        technology: [],
      };

      fields.forEach(field => {
        const agent = FIELD_TO_AGENT[field];
        if (agent && agentFields[agent]) {
          agentFields[agent].push(field);
        }
      });

      // Run agents in parallel
      const agentPromises: Promise<any>[] = [];

      if (agentFields.company.length > 0) {
        agentPromises.push(
          companyResearchAgent(domain, agentFields.company, OPENAI_API_KEY, FIRECRAWL_API_KEY)
        );
      }
      if (agentFields.fundraising.length > 0) {
        agentPromises.push(
          fundraisingAgent(domain, agentFields.fundraising, OPENAI_API_KEY, FIRECRAWL_API_KEY)
        );
      }
      if (agentFields.leadership.length > 0) {
        agentPromises.push(
          leadershipAgent(domain, agentFields.leadership, OPENAI_API_KEY, FIRECRAWL_API_KEY)
        );
      }
      if (agentFields.technology.length > 0) {
        agentPromises.push(
          technologyAgent(domain, agentFields.technology, OPENAI_API_KEY, FIRECRAWL_API_KEY)
        );
      }

      const agentResults = await Promise.all(agentPromises);
      const allResults = agentResults.flat();

      // Send progress events for each field
      allResults.forEach(result => {
        res.write(`data: ${JSON.stringify({
          type: 'progress',
          contactId,
          field: result.field,
          value: result.value,
          source: result.source_url,
          confidence: result.confidence,
          agent: result.agent,
        })}\n\n`);
      });

      // Build enriched data
      const enrichedData: Record<string, any> = {};
      allResults.forEach(result => {
        enrichedData[result.field] = {
          value: result.value,
          source_url: result.source_url,
          confidence: result.confidence,
          agent: result.agent,
        };
      });

      // Send complete event
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        contactId,
        data: {
          email: contact.email,
          original_data: contact,
          enriched_data: enrichedData,
          status: 'completed',
        },
      })}\n\n`);

      successful++;
    } catch (error) {
      console.error('Enrichment error:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        contactId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })}\n\n`);
      failed++;
    }

    // Add delay between contacts
    if (i < contacts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  // Send done event
  res.write(`data: ${JSON.stringify({
    type: 'done',
    total: contacts.length,
    successful,
    failed,
  })}\n\n`);

  res.end();
}
```

**Step 2: Commit streaming endpoint**

```bash
git add api/enrichment-stream.ts
git commit -m "feat: add SSE streaming endpoint for real-time enrichment"
```

---

## Task 9: Create Frontend SSE Client

**Files:**
- Create: `src/services/enrichmentClient.ts`

**Step 1: Create enrichment client service**

Create `src/services/enrichmentClient.ts`:
```typescript
import { StreamEventType, EnrichmentRequest } from '../types/enrichment';

export class EnrichmentClient {
  private eventSource: EventSource | null = null;

  async startEnrichment(
    request: EnrichmentRequest,
    onEvent: (event: StreamEventType) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const response = await fetch('/api/enrichment-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onEvent(data);
            } catch (err) {
              console.error('Failed to parse SSE data:', err);
            }
          }
        }
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error('Unknown error'));
    }
  }

  cancel(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
```

**Step 2: Commit enrichment client**

```bash
git add src/services/enrichmentClient.ts
git commit -m "feat: add frontend SSE client for enrichment streaming"
```

---

## Task 10: Create Upload Zone Component

**Files:**
- Create: `src/components/enrichment/UploadZone.tsx`

**Step 1: Create CSV upload component**

Create `src/components/enrichment/UploadZone.tsx`:
```typescript
import { useState, useRef } from 'react';

interface UploadZoneProps {
  onFileUpload: (file: File) => void;
}

export function UploadZone({ onFileUpload }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      onFileUpload(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="text-gray-600">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="mt-2 text-sm font-medium">Drop your CSV file here</p>
        <p className="mt-1 text-xs text-gray-500">or click to browse</p>
      </div>
    </div>
  );
}
```

**Step 2: Commit upload zone component**

```bash
git add src/components/enrichment/UploadZone.tsx
git commit -m "feat: add CSV upload zone component with drag-and-drop"
```

---

## Task 11: Create Field Selector Component

**Files:**
- Create: `src/components/enrichment/FieldSelector.tsx`

**Step 1: Create field selector component**

Create `src/components/enrichment/FieldSelector.tsx`:
```typescript
import { useState } from 'react';
import { FIELD_CATEGORIES, FIELD_BUNDLES, FieldBundle } from '../../types/enrichment';

interface FieldSelectorProps {
  selectedFields: string[];
  onFieldsChange: (fields: string[]) => void;
}

export function FieldSelector({ selectedFields, onFieldsChange }: FieldSelectorProps) {
  const [activeBundle, setActiveBundle] = useState<FieldBundle | null>(null);

  const handleBundleClick = (bundle: FieldBundle) => {
    const bundleFields = FIELD_BUNDLES[bundle];
    onFieldsChange([...bundleFields]);
    setActiveBundle(bundle);
  };

  const handleFieldToggle = (field: string) => {
    if (selectedFields.includes(field)) {
      onFieldsChange(selectedFields.filter(f => f !== field));
    } else {
      onFieldsChange([...selectedFields, field]);
    }
    setActiveBundle(null);
  };

  const handleSelectAll = () => {
    onFieldsChange(FIELD_BUNDLES.full);
    setActiveBundle('full');
  };

  const handleClearAll = () => {
    onFieldsChange([]);
    setActiveBundle(null);
  };

  const estimatedCost = selectedFields.length * 0.02;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Presets</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleBundleClick('quick')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeBundle === 'quick'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Quick Qualification
          </button>
          <button
            onClick={() => handleBundleClick('sales')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeBundle === 'sales'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Sales Intelligence
          </button>
          <button
            onClick={() => handleBundleClick('executive')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeBundle === 'executive'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Executive Outreach
          </button>
          <button
            onClick={() => handleBundleClick('technical')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeBundle === 'technical'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Technical Fit
          </button>
          <button
            onClick={() => handleBundleClick('full')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeBundle === 'full'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Full Enrichment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(FIELD_CATEGORIES).map(([category, fields]) => (
          <div key={category} className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 capitalize">
              {category.replace('_', ' ')}
            </h4>
            <div className="space-y-1">
              {fields.map(field => (
                <label key={field} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(field)}
                    onChange={() => handleFieldToggle(field)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">
                    {field.replace(/_/g, ' ')}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-gray-600">
          <span className="font-medium">{selectedFields.length}</span> fields selected
          {selectedFields.length > 0 && (
            <span className="ml-2 text-gray-500">
              (~${estimatedCost.toFixed(2)} per contact)
            </span>
          )}
        </div>
        <div className="space-x-2">
          <button
            onClick={handleClearAll}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            Clear All
          </button>
          <button
            onClick={handleSelectAll}
            className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800"
          >
            Select All
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit field selector**

```bash
git add src/components/enrichment/FieldSelector.tsx
git commit -m "feat: add field selector with preset bundles"
```

---

## Task 12: Create Enrichment Progress Component

**Files:**
- Create: `src/components/enrichment/EnrichmentProgress.tsx`

**Step 1: Create progress indicator component**

Create `src/components/enrichment/EnrichmentProgress.tsx`:
```typescript
interface EnrichmentProgressProps {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  isRunning: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
}

export function EnrichmentProgress({
  total,
  completed,
  successful,
  failed,
  isRunning,
  onCancel,
}: EnrichmentProgressProps) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const successRate = completed > 0 ? (successful / completed) * 100 : 0;

  return (
    <div className="bg-white border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          {isRunning ? 'Enriching Contacts...' : 'Enrichment Complete'}
        </h3>
        {isRunning && onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-md"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Progress</span>
          <span>{completed} / {total}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-semibold text-gray-900">{completed}</div>
          <div className="text-xs text-gray-500">Processed</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-green-600">{successful}</div>
          <div className="text-xs text-gray-500">Successful</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-red-600">{failed}</div>
          <div className="text-xs text-gray-500">Failed</div>
        </div>
      </div>

      {completed > 0 && (
        <div className="pt-4 border-t text-center">
          <div className="text-sm text-gray-600">
            Success Rate: <span className="font-medium">{successRate.toFixed(1)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit progress component**

```bash
git add src/components/enrichment/EnrichmentProgress.tsx
git commit -m "feat: add enrichment progress indicator component"
```

---

## Task 13: Create Enrichment Table Component

**Files:**
- Create: `src/components/enrichment/EnrichmentTable.tsx`

**Step 1: Create results table component**

Create `src/components/enrichment/EnrichmentTable.tsx`:
```typescript
import { EnrichmentResult } from '../../types/enrichment';

interface EnrichmentTableProps {
  results: EnrichmentResult[];
  selectedFields: string[];
  onSourceClick?: (url: string) => void;
}

export function EnrichmentTable({ results, selectedFields, onSourceClick }: EnrichmentTableProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No results yet. Upload a CSV to begin enrichment.
      </div>
    );
  }

  const getConfidenceColor = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return 'bg-green-50 text-green-700';
      case 'medium':
        return 'bg-yellow-50 text-yellow-700';
      case 'low':
        return 'bg-red-50 text-red-700';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Email
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            {selectedFields.map(field => (
              <th
                key={field}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
              >
                {field.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {results.map((result, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-900">
                {result.email}
              </td>
              <td className="px-4 py-3 text-sm">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    result.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : result.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : result.status === 'processing'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {result.status}
                </span>
              </td>
              {selectedFields.map(field => {
                const enrichedField = result.enriched_data[field];
                const originalValue = result.original_data[field];

                return (
                  <td key={field} className="px-4 py-3 text-sm">
                    {result.status === 'processing' && !enrichedField ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                        <span className="text-gray-400">Loading...</span>
                      </div>
                    ) : enrichedField ? (
                      <div className="space-y-1">
                        <div
                          className={`inline-flex px-2 py-1 rounded text-xs ${getConfidenceColor(
                            enrichedField.confidence
                          )}`}
                        >
                          {enrichedField.value || 'N/A'}
                        </div>
                        {enrichedField.source_url && (
                          <button
                            onClick={() => onSourceClick?.(enrichedField.source_url)}
                            className="block text-xs text-blue-600 hover:underline"
                          >
                            View Source
                          </button>
                        )}
                      </div>
                    ) : originalValue ? (
                      <span className="text-gray-600">{originalValue}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: Commit table component**

```bash
git add src/components/enrichment/EnrichmentTable.tsx
git commit -m "feat: add enrichment results table with real-time updates"
```

---

## Task 14: Create Source Modal Component

**Files:**
- Create: `src/components/enrichment/SourceModal.tsx`

**Step 1: Create source viewer modal**

Create `src/components/enrichment/SourceModal.tsx`:
```typescript
interface SourceModalProps {
  isOpen: boolean;
  url: string;
  onClose: () => void;
}

export function SourceModal({ isOpen, url, onClose }: SourceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black opacity-30" onClick={onClose} />

        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b">
            <h3 className="text-lg font-medium text-gray-900">Data Source</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source URL
              </label>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {url}
              </a>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <iframe
                src={url}
                className="w-full h-96"
                title="Source Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>

          <div className="flex justify-end p-6 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit source modal**

```bash
git add src/components/enrichment/SourceModal.tsx
git commit -m "feat: add source URL viewer modal component"
```

---

## Task 15: Create Main Data Enrichment Page

**Files:**
- Create: `src/pages/DataEnrichment.tsx`

**Step 1: Create main enrichment page**

Create `src/pages/DataEnrichment.tsx`:
```typescript
import { useState } from 'react';
import { UploadZone } from '../components/enrichment/UploadZone';
import { FieldSelector } from '../components/enrichment/FieldSelector';
import { EnrichmentProgress } from '../components/enrichment/EnrichmentProgress';
import { EnrichmentTable } from '../components/enrichment/EnrichmentTable';
import { SourceModal } from '../components/enrichment/SourceModal';
import { parseCSV } from '../utils/csvParser';
import { exportToCSV, downloadCSV, copyToClipboard } from '../utils/csvExporter';
import { EnrichmentClient } from '../services/enrichmentClient';
import { EnrichmentResult, StreamEventType } from '../types/enrichment';

export function DataEnrichment() {
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [emailColumn, setEmailColumn] = useState<string | null>(null);
  const [results, setResults] = useState<EnrichmentResult[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [stats, setStats] = useState({ completed: 0, successful: 0, failed: 0 });
  const [sourceModalUrl, setSourceModalUrl] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    const text = await file.text();
    const parsed = parseCSV(text);

    setCsvData(parsed.rows);
    setEmailColumn(parsed.emailColumn);
    setResults([]);
    setStats({ completed: 0, successful: 0, failed: 0 });
  };

  const handleStartEnrichment = async () => {
    if (!emailColumn || csvData.length === 0 || selectedFields.length === 0) {
      return;
    }

    setIsEnriching(true);
    setResults([]);
    setStats({ completed: 0, successful: 0, failed: 0 });

    const contacts = csvData.map(row => ({
      email: row[emailColumn],
      ...row,
    }));

    // Initialize results with pending status
    const initialResults: EnrichmentResult[] = contacts.map(contact => ({
      email: contact.email,
      original_data: contact,
      enriched_data: {},
      status: 'pending',
    }));
    setResults(initialResults);

    const client = new EnrichmentClient();

    await client.startEnrichment(
      { contacts, fields: selectedFields, source: 'csv' },
      (event: StreamEventType) => {
        handleStreamEvent(event);
      },
      (error) => {
        console.error('Enrichment error:', error);
        setIsEnriching(false);
      }
    );

    setIsEnriching(false);
  };

  const handleStreamEvent = (event: StreamEventType) => {
    switch (event.type) {
      case 'start':
        setResults(prev =>
          prev.map(r =>
            r.email === event.email ? { ...r, status: 'processing' } : r
          )
        );
        break;

      case 'progress':
        setResults(prev =>
          prev.map(r => {
            const contactIdx = parseInt(event.contactId.split('-')[1]);
            if (prev.indexOf(r) === contactIdx) {
              return {
                ...r,
                enriched_data: {
                  ...r.enriched_data,
                  [event.field]: {
                    value: event.value,
                    source_url: event.source,
                    confidence: event.confidence,
                    agent: event.agent,
                  },
                },
              };
            }
            return r;
          })
        );
        break;

      case 'complete':
        setResults(prev =>
          prev.map(r =>
            r.email === event.data.email
              ? { ...event.data, status: 'completed' }
              : r
          )
        );
        setStats(prev => ({ ...prev, completed: prev.completed + 1, successful: prev.successful + 1 }));
        break;

      case 'error':
        setResults(prev =>
          prev.map((r, idx) => {
            const contactIdx = parseInt(event.contactId.split('-')[1]);
            if (idx === contactIdx) {
              return { ...r, status: 'failed', error: event.error };
            }
            return r;
          })
        );
        setStats(prev => ({ ...prev, completed: prev.completed + 1, failed: prev.failed + 1 }));
        break;

      case 'done':
        console.log('Enrichment complete:', event);
        break;
    }
  };

  const handleDownloadCSV = () => {
    const csv = exportToCSV(results);
    downloadCSV(csv, `enriched-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleCopyToClipboard = () => {
    copyToClipboard(results);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Data Enrichment</h1>
        <p className="mt-2 text-gray-600">
          Upload a CSV with email addresses and enrich with AI-powered company data
        </p>
      </div>

      {csvData.length === 0 ? (
        <UploadZone onFileUpload={handleFileUpload} />
      ) : (
        <div className="space-y-8">
          <div className="bg-white border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">CSV Loaded</h3>
                <p className="text-sm text-gray-600">
                  {csvData.length} contacts found
                  {emailColumn && ` • Email column: ${emailColumn}`}
                </p>
              </div>
              <button
                onClick={() => {
                  setCsvData([]);
                  setEmailColumn(null);
                  setResults([]);
                }}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Upload Different File
              </button>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Select Fields to Enrich
            </h3>
            <FieldSelector
              selectedFields={selectedFields}
              onFieldsChange={setSelectedFields}
            />
          </div>

          {!isEnriching && results.length === 0 && (
            <div className="flex justify-center">
              <button
                onClick={handleStartEnrichment}
                disabled={selectedFields.length === 0}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Start Enrichment
              </button>
            </div>
          )}

          {(isEnriching || results.length > 0) && (
            <>
              <EnrichmentProgress
                total={csvData.length}
                completed={stats.completed}
                successful={stats.successful}
                failed={stats.failed}
                isRunning={isEnriching}
              />

              <div className="bg-white border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Results</h3>
                  {results.length > 0 && !isEnriching && (
                    <div className="space-x-2">
                      <button
                        onClick={handleCopyToClipboard}
                        className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                      >
                        Copy to Clipboard
                      </button>
                      <button
                        onClick={handleDownloadCSV}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Download CSV
                      </button>
                    </div>
                  )}
                </div>
                <EnrichmentTable
                  results={results}
                  selectedFields={selectedFields}
                  onSourceClick={setSourceModalUrl}
                />
              </div>
            </>
          )}
        </div>
      )}

      <SourceModal
        isOpen={!!sourceModalUrl}
        url={sourceModalUrl || ''}
        onClose={() => setSourceModalUrl(null)}
      />
    </div>
  );
}
```

**Step 2: Commit main page**

```bash
git add src/pages/DataEnrichment.tsx
git commit -m "feat: add data enrichment main page with full workflow"
```

---

## Task 16: Add Route to Application

**Files:**
- Modify: `src/main.tsx`

**Step 1: Import and add route**

Add import at top of `src/main.tsx`:
```typescript
import { DataEnrichment } from './pages/DataEnrichment';
```

Add route in router configuration (after ABMBuilder):
```typescript
{
  path: 'data-enrichment',
  element: <DataEnrichment />,
},
```

**Step 2: Commit route addition**

```bash
git add src/main.tsx
git commit -m "feat: add data enrichment route to application"
```

---

## Task 17: Update Navigation (Optional)

**Files:**
- Modify: `src/components/Layout.tsx` (if navigation exists)

**Step 1: Add navigation link**

If there's a navigation menu in Layout.tsx, add a link to data enrichment:
```typescript
<a href="/data-enrichment" className="nav-link">
  Data Enrichment
</a>
```

**Step 2: Commit navigation update**

```bash
git add src/components/Layout.tsx
git commit -m "feat: add data enrichment to navigation"
```

---

## Task 18: Test End-to-End

**Step 1: Start dev server**

Run:
```bash
npm run dev
```

Expected: Server starts on localhost:5173

**Step 2: Navigate to enrichment page**

Open: http://localhost:5173/data-enrichment

Expected: Page loads with upload zone

**Step 3: Create test CSV**

Create `test.csv`:
```csv
email,company
john@example.com,Example Corp
jane@testco.com,Test Company
```

**Step 4: Upload and enrich**

1. Upload test.csv
2. Select "Quick Qualification" preset
3. Click "Start Enrichment"
4. Watch real-time streaming updates
5. Download enriched CSV

Expected: Enrichment completes with data populated

**Step 5: Verify results**

Check:
- ✓ Data streams in real-time
- ✓ Source URLs are clickable
- ✓ Confidence levels show correctly
- ✓ CSV download works
- ✓ Copy to clipboard works

---

## Task 19: Final Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md with enrichment info**

Add to Active Projects section:
```markdown
### 3. Data Enrichment
**Status:** Complete
**Location:** `/data-enrichment` route

AI-powered company data enrichment tool using OpenAI and Firecrawl.

**Features:**
- CSV upload with email detection
- 4 specialized AI agents (Company, Fundraising, Leadership, Technology)
- Real-time SSE streaming
- Field presets (Quick, Sales, Executive, Technical, Full)
- Source attribution for all data
- CSV/TSV export

**Cost:** ~$0.05-0.10 per contact for full enrichment
```

**Step 2: Commit documentation update**

```bash
git add CLAUDE.md
git commit -m "docs: add data enrichment to project documentation"
```

---

## Summary

This implementation plan creates a complete Fire Enrich integration with:

✅ TypeScript types and utilities
✅ 4 AI agents (Company, Fundraising, Leadership, Tech)
✅ SSE streaming API endpoint
✅ CSV upload/download workflow
✅ Real-time enrichment UI
✅ Field selection with presets
✅ Source attribution
✅ Progress tracking

**Total Tasks:** 19
**Estimated Time:** 3-4 hours
**Files Created:** 15
**Files Modified:** 4
