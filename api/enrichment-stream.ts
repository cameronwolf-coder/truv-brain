import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import Firecrawl from '@mendable/firecrawl-js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
const GEMINI_MODEL = 'gemini-2.0-flash';

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
  work_email: 'contact',
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
  try {
    const app = new Firecrawl({ apiKey });
    const searchResults = await app.search(query, {
      limit: 3,
      scrapeOptions: {
        formats: ['markdown'],
      },
    });

    console.log('Firecrawl search response:', JSON.stringify(searchResults).substring(0, 200));

    if (!searchResults.web || searchResults.web.length === 0) {
      console.log('No web results from Firecrawl for query:', query);
      return [];
    }

    return searchResults.web
      .filter((result): result is { url: string; markdown?: string } => 'url' in result)
      .map(result => ({
        url: result.url || '',
        markdown: result.markdown || '',
      }));
  } catch (error) {
    console.error('Firecrawl search error:', error);
    return [];
  }
}

async function extractWithGemini(
  content: string,
  fields: string[],
  systemPrompt: string,
  client: OpenAI
): Promise<Record<string, string | number | null>> {
  const fieldsList = fields.join(', ');

  const response = await client.chat.completions.create({
    model: GEMINI_MODEL,
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
  geminiKey: string,
  firecrawlKey: string
): Promise<AgentResult[]> {
  const client = new OpenAI({ apiKey: geminiKey, baseURL: GEMINI_BASE_URL });
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

    const extracted = await extractWithGemini(
      content,
      fields,
      'Extract factual company information. Be concise and accurate. Return only verified information.',
      client
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
  geminiKey: string,
  firecrawlKey: string
): Promise<AgentResult[]> {
  const client = new OpenAI({ apiKey: geminiKey, baseURL: GEMINI_BASE_URL });
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

    const extracted = await extractWithGemini(
      content,
      fields,
      'Find the most recent funding information with dates. Be precise about amounts and investors.',
      client
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
  geminiKey: string,
  firecrawlKey: string
): Promise<AgentResult[]> {
  const client = new OpenAI({ apiKey: geminiKey, baseURL: GEMINI_BASE_URL });
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

    const extracted = await extractWithGemini(
      content,
      fields,
      'Identify key decision makers and their roles. Include full names and titles.',
      client
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
  geminiKey: string,
  firecrawlKey: string
): Promise<AgentResult[]> {
  const client = new OpenAI({ apiKey: geminiKey, baseURL: GEMINI_BASE_URL });
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

    const extracted = await extractWithGemini(
      content,
      fields,
      'Identify technologies used and products offered. Focus on main tech stack and core products.',
      client
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

async function emailFinderAgent(
  contactName: string,
  companyName: string,
  fields: string[],
  geminiKey: string,
  firecrawlKey: string
): Promise<AgentResult[]> {
  const client = new OpenAI({ apiKey: geminiKey, baseURL: GEMINI_BASE_URL });
  const results: AgentResult[] = [];

  try {
    const searchQuery = `"${contactName}" "${companyName}" email contact`;
    const searchResults = await searchWithFirecrawl(searchQuery, firecrawlKey);

    if (searchResults.length === 0) {
      fields.forEach(field => {
        results.push({
          field,
          value: null,
          source_url: '',
          confidence: 'low',
          agent: 'Email Finder',
        });
      });
      return results;
    }

    const content = searchResults.map(r => r.markdown || '').join('\n\n');
    const sourceUrl = searchResults[0].url;

    const response = await client.chat.completions.create({
      model: GEMINI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You find work email addresses for professionals. Extract the most likely work email address from the provided content. Only return verified emails that appear in the content. Return JSON with key "work_email". Use null if no email found.',
        },
        {
          role: 'user',
          content: `Find the work email for ${contactName} at ${companyName}.\n\nContent:\n${content}\n\nReturn JSON with key: work_email. Use null if not found.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const result = response.choices[0]?.message?.content;
    let extracted: Record<string, string | null> = {};
    if (result) {
      try {
        extracted = JSON.parse(result);
      } catch {
        extracted = {};
      }
    }

    const email = extracted.work_email;
    results.push({
      field: 'work_email',
      value: email || null,
      source_url: email ? sourceUrl : '',
      confidence: email ? 'medium' : 'low',
      agent: 'Email Finder',
    });
  } catch (error) {
    console.error('Email finder agent error:', error);
    results.push({
      field: 'work_email',
      value: null,
      source_url: '',
      confidence: 'low',
      agent: 'Email Finder',
    });
  }

  return results;
}

async function findDomainFromCompany(companyName: string, firecrawlKey: string): Promise<string | null> {
  try {
    const searchResults = await searchWithFirecrawl(`${companyName} official website`, firecrawlKey);
    if (searchResults.length > 0 && searchResults[0].url) {
      const url = new URL(searchResults[0].url);
      return url.hostname.replace(/^www\./, '');
    }
  } catch {
    // ignore
  }
  return null;
}

function getContactName(contact: Record<string, any>): string {
  return contact.name || contact.first_name || contact.firstname || contact.full_name || contact.fullname || contact.contact_name || contact['First Name'] || contact['Name'] || contact['Full Name'] || contact['Contact'] || contact['Lead Name'] || '';
}

function getCompanyName(contact: Record<string, any>): string {
  return contact.company || contact.organization || contact.org || contact.business || contact.account || contact.company_name || contact['Company'] || contact['Company Name'] || contact['Organization'] || contact['Account'] || contact['Employer'] || '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!GEMINI_API_KEY || !FIRECRAWL_API_KEY) {
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

    const contactName = getContactName(contact);
    const companyName = getCompanyName(contact);
    const contactLabel = contact.email || contactName || `Contact ${i + 1}`;

    // Send start event
    res.write(`data: ${JSON.stringify({ type: 'start', contactId, email: contactLabel })}\n\n`);

    try {
      // Resolve domain: from email if available, otherwise from company name
      let domain = contact.email ? extractDomain(contact.email) : null;

      if (!domain && companyName) {
        domain = await findDomainFromCompany(companyName, FIRECRAWL_API_KEY);
      }

      if (!domain) {
        res.write(`data: ${JSON.stringify({ type: 'error', contactId, error: 'Could not determine company domain' })}\n\n`);
        failed++;
        continue;
      }

      // Group fields by agent
      const agentFields: Record<string, string[]> = {
        company: [],
        fundraising: [],
        leadership: [],
        technology: [],
        contact: [],
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
          companyResearchAgent(domain, agentFields.company, GEMINI_API_KEY, FIRECRAWL_API_KEY)
        );
      }
      if (agentFields.fundraising.length > 0) {
        agentPromises.push(
          fundraisingAgent(domain, agentFields.fundraising, GEMINI_API_KEY, FIRECRAWL_API_KEY)
        );
      }
      if (agentFields.leadership.length > 0) {
        agentPromises.push(
          leadershipAgent(domain, agentFields.leadership, GEMINI_API_KEY, FIRECRAWL_API_KEY)
        );
      }
      if (agentFields.technology.length > 0) {
        agentPromises.push(
          technologyAgent(domain, agentFields.technology, GEMINI_API_KEY, FIRECRAWL_API_KEY)
        );
      }

      // Email finder agent uses name + company instead of domain
      if (agentFields.contact.length > 0) {
        if (contactName && companyName) {
          agentPromises.push(
            emailFinderAgent(contactName, companyName, agentFields.contact, GEMINI_API_KEY, FIRECRAWL_API_KEY)
          );
        } else {
          agentFields.contact.forEach(field => {
            agentPromises.push(
              Promise.resolve([{
                field,
                value: null,
                source_url: '',
                confidence: 'low' as const,
                agent: 'Email Finder',
              }])
            );
          });
        }
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
          email: contact.email || contactLabel,
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
