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
