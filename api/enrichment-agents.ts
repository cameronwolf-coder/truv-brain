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
