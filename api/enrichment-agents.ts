import OpenAI from 'openai';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
const GEMINI_MODEL = 'gemini-2.0-flash';

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

export async function companyResearchAgent(
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

export async function fundraisingAgent(
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

export async function leadershipAgent(
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

export async function emailFinderAgent(
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

export async function technologyAgent(
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
