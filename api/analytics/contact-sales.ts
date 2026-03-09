import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';
const FORM_ID = '72d5f494-a29f-44a4-93af-8e7faee015b3';

interface FormSubmission {
  submittedAt: number;
  values: Array<{ name: string; value: string }>;
}

interface DeduplicatedContact {
  email: string;
  firstName: string;
  lastName: string;
  intent: string;
  submittedAt: string;
  company?: string;
  jobTitle?: string;
  lifecycleStage?: string;
  leadStatus?: string;
  ownerName?: string;
  hubspotUrl?: string;
  contactId?: string;
  // Pipeline tracking
  hasOwner: boolean;
  firstContactDate?: string;
  meetingDate?: string;
  dealDate?: string;
}

interface WeeklyTrend {
  week: string;
  count: number;
}

async function hubspotGet(endpoint: string): Promise<unknown> {
  const res = await fetch(`${HUBSPOT_BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot ${res.status}: ${text}`);
  }
  return res.json();
}

async function hubspotPost(endpoint: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${HUBSPOT_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HUBSPOT_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot ${res.status}: ${text}`);
  }
  return res.json();
}

function getFieldValue(values: Array<{ name: string; value: string }>, fieldName: string): string {
  return values.find(v => v.name === fieldName)?.value || '';
}

export const config = { maxDuration: 30 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!HUBSPOT_API_TOKEN) {
    return res.status(500).json({ error: 'HubSpot API token not configured' });
  }

  try {
    // Parse date range from query params (default: last 7 days)
    const daysBack = parseInt(req.query.days as string) || 7;
    const now = Date.now();
    const startDate = now - daysBack * 24 * 60 * 60 * 1000;

    // Fetch form submissions with pagination
    const allSubmissions: FormSubmission[] = [];
    let after: string | undefined;
    let iterations = 0;

    while (iterations < 20) {
      const url = after
        ? `/form-integrations/v1/submissions/forms/${FORM_ID}?limit=50&after=${after}`
        : `/form-integrations/v1/submissions/forms/${FORM_ID}?limit=50`;

      const data = (await hubspotGet(url)) as {
        results: FormSubmission[];
        paging?: { next?: { after: string } };
      };

      const results = data.results || [];
      if (results.length === 0) break;

      // Filter by date range
      for (const sub of results) {
        if (sub.submittedAt >= startDate) {
          allSubmissions.push(sub);
        }
      }

      // Stop if we've gone past our date range
      const oldest = results[results.length - 1]?.submittedAt;
      if (oldest && oldest < startDate) break;

      after = data.paging?.next?.after;
      if (!after) break;
      iterations++;
    }

    // Deduplicate by email: keep first (earliest) submission per email
    const byEmail = new Map<string, { intent: string; submittedAt: number; firstName: string; lastName: string; email: string }>();

    for (const sub of allSubmissions) {
      const email = getFieldValue(sub.values, 'email').toLowerCase();
      if (!email) continue;

      // Filter out test data
      const firstName = getFieldValue(sub.values, 'firstname');
      const lastName = getFieldValue(sub.values, 'lastname');
      if (/voodoo/i.test(email) || /voodoo/i.test(firstName) || /voodoo/i.test(lastName)) continue;

      const intent = getFieldValue(sub.values, 'how_can_we_help___forms_') ||
                     getFieldValue(sub.values, 'get_started_intent') ||
                     getFieldValue(sub.values, 'intent') || '';

      const existing = byEmail.get(email);
      if (!existing || sub.submittedAt < existing.submittedAt) {
        byEmail.set(email, {
          intent,
          submittedAt: sub.submittedAt,
          firstName,
          lastName,
          email,
        });
      }
    }

    // Count by intent
    const intentCounts: Record<string, number> = {};
    for (const entry of byEmail.values()) {
      const intent = entry.intent || 'Unknown';
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    }

    // Get "Contact sales" submissions specifically
    const contactSalesEmails: string[] = [];
    const contactSalesEntries: Array<typeof byEmail extends Map<string, infer V> ? V : never> = [];

    for (const entry of byEmail.values()) {
      if (/contact\s*sales/i.test(entry.intent)) {
        contactSalesEmails.push(entry.email);
        contactSalesEntries.push(entry);
      }
    }

    // Weekly trend for Contact Sales (4 weeks)
    const fourWeeksAgo = now - 28 * 24 * 60 * 60 * 1000;
    const weeklyTrend: WeeklyTrend[] = [];
    const weekMap = new Map<string, number>();

    for (const entry of contactSalesEntries) {
      if (entry.submittedAt < fourWeeksAgo) continue;
      const d = new Date(entry.submittedAt);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      weekMap.set(key, (weekMap.get(key) || 0) + 1);
    }
    for (const [week, count] of weekMap) {
      weeklyTrend.push({ week, count });
    }
    weeklyTrend.sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime());

    // Enrich Contact Sales contacts from HubSpot CRM
    const contacts: DeduplicatedContact[] = [];
    const emailBatches: string[][] = [];
    for (let i = 0; i < contactSalesEmails.length; i += 100) {
      emailBatches.push(contactSalesEmails.slice(i, i + 100));
    }

    // Fetch owners for name lookup
    const ownersData = (await hubspotGet('/crm/v3/owners?limit=100')) as {
      results: Array<{ id: string; firstName: string; lastName: string }>;
    };
    const ownerMap = new Map<string, string>();
    for (const o of ownersData.results) {
      ownerMap.set(o.id, `${o.firstName} ${o.lastName}`.trim());
    }

    const contactMap = new Map<string, {
      contactId: string;
      firstName: string;
      lastName: string;
      lifecycleStage: string;
      leadStatus: string;
      ownerId: string;
      company: string;
      jobTitle: string;
    }>();

    for (const batch of emailBatches) {
      try {
        const searchResult = (await hubspotPost('/crm/v3/objects/contacts/search', {
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'IN',
              values: batch,
            }],
          }],
          properties: [
            'email', 'firstname', 'lastname', 'lifecyclestage', 'hs_lead_status',
            'hubspot_owner_id', 'company', 'jobtitle',
            'hs_sales_email_last_replied', 'notes_last_updated',
            'num_associated_deals',
          ],
          limit: 100,
        })) as {
          results: Array<{ id: string; properties: Record<string, string> }>;
        };

        for (const c of searchResult.results) {
          const email = (c.properties.email || '').toLowerCase();
          contactMap.set(email, {
            contactId: c.id,
            firstName: c.properties.firstname || '',
            lastName: c.properties.lastname || '',
            lifecycleStage: c.properties.lifecyclestage || '',
            leadStatus: c.properties.hs_lead_status || '',
            ownerId: c.properties.hubspot_owner_id || '',
            company: c.properties.company || '',
            jobTitle: c.properties.jobtitle || '',
          });
        }
      } catch {
        // Continue if a batch fails
      }
    }

    // Build enriched contact list
    let assignedCount = 0;
    let contactedCount = 0;
    let meetingCount = 0;
    let dealCount = 0;
    const hotLeads: DeduplicatedContact[] = [];
    const repCounts = new Map<string, number>();

    for (const entry of contactSalesEntries) {
      const crm = contactMap.get(entry.email);
      const ownerName = crm?.ownerId ? ownerMap.get(crm.ownerId) || '' : '';
      const hasOwner = !!crm?.ownerId && crm.ownerId !== '';
      const lcs = (crm?.lifecycleStage || '').toLowerCase();
      const leadStatus = crm?.leadStatus || '';

      // Funnel stage tracking
      if (hasOwner) assignedCount++;
      if (leadStatus || lcs === 'salesqualifiedlead' || lcs === 'opportunity') contactedCount++;
      if (/meeting/i.test(leadStatus) || lcs === 'salesqualifiedlead') meetingCount++;
      if (lcs === 'opportunity' || (crm && parseInt(crm.contactId) > 0 && lcs === 'customer')) dealCount++;

      // Count by rep
      if (ownerName) {
        repCounts.set(ownerName, (repCounts.get(ownerName) || 0) + 1);
      }

      const contact: DeduplicatedContact = {
        email: entry.email,
        firstName: crm?.firstName || entry.firstName,
        lastName: crm?.lastName || entry.lastName,
        intent: entry.intent,
        submittedAt: new Date(entry.submittedAt).toISOString(),
        company: crm?.company,
        jobTitle: crm?.jobTitle,
        lifecycleStage: crm?.lifecycleStage,
        leadStatus,
        ownerName,
        contactId: crm?.contactId,
        hubspotUrl: crm?.contactId
          ? `https://app.hubspot.com/contacts/19933594/record/0-1/${crm.contactId}`
          : undefined,
        hasOwner,
      };

      contacts.push(contact);

      // Hot leads: has owner but no lead status (needs first contact)
      if (hasOwner && !leadStatus && lcs !== 'salesqualifiedlead' && lcs !== 'opportunity') {
        hotLeads.push(contact);
      }
    }

    // Sort contacts by submission date, newest first
    contacts.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    // Build rep breakdown
    const byRep = Array.from(repCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Lifecycle stage funnel
    const stageCounts: Record<string, number> = {};
    for (const c of contacts) {
      const stage = c.lifecycleStage || 'unknown';
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    }
    const leadStageFunnel = Object.entries(stageCounts)
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count);

    const contactSalesCount = contactSalesEntries.length;

    return res.status(200).json({
      // KPI cards
      kpis: {
        contactSales: contactSalesCount,
        salesOutreach: contactedCount,
        meetingsScheduled: meetingCount,
        login: intentCounts['Login'] || intentCounts['login'] || 0,
        verificationHelp: intentCounts['Verification help'] || intentCounts['verification_help'] || 0,
      },
      // Conversion funnel (5 stages)
      funnel: [
        { stage: 'Form Fill (Contact Sales)', count: contactSalesCount },
        { stage: 'Assigned to Rep', count: assignedCount },
        { stage: 'First Contact Made', count: contactedCount },
        { stage: 'Meeting Created (SAL)', count: meetingCount },
        { stage: 'Deal Created', count: dealCount },
      ],
      // Charts
      weeklyTrend,
      leadStageFunnel,
      byRep,
      // Tables
      hotLeads,
      contacts,
      // Meta
      totalSubmissions: allSubmissions.length,
      uniqueEmails: byEmail.size,
      intentBreakdown: intentCounts,
      dateRange: {
        start: new Date(startDate).toISOString(),
        end: new Date(now).toISOString(),
        days: daysBack,
      },
    });
  } catch (err) {
    console.error('Contact sales analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch contact sales data' });
  }
}
