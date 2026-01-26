import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

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

function extractDomain(email: string): string | null {
  const match = email.match(/@(.+)$/);
  return match ? match[1] : null;
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
    const errorText = await response.text();
    console.error('Firecrawl search failed:', response.status, response.statusText, errorText);
    return [];
  }

  const data = await response.json();
  console.log('Firecrawl search response:', JSON.stringify(data).substring(0, 200));
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

async function companyResearchAgent(
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

async function fundraisingAgent(
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

async function leadershipAgent(
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

async function technologyAgent(
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
