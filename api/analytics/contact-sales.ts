import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';
const FORM_ID = '72d5f494-a29f-44a4-93af-8e7faee015b3';
const PORTAL_ID = '19933594';

// --- Types ---

interface FormSubmission {
  submittedAt: number;
  values: Array<{ name: string; value: string }>;
}

interface ParsedSubmission {
  email: string;
  firstName: string;
  lastName: string;
  intent: string;
  submittedAt: number;
}

interface CrmContact {
  contactId: string;
  firstName: string;
  lastName: string;
  company: string;
  jobTitle: string;
  lifecycleStage: string;
  leadStatus: string;
  ownerId: string;
  ownerAssignedDate: string;
  lastMeetingBooked: string;
  firstDealCreatedDate: string;
  numDeals: number;
  emailLastSendDate: string;
}

interface EnrichedContact {
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
  hasOwner: boolean;
  hasMeeting: boolean;
  hasDeal: boolean;
  hasOutreach: boolean;
  hoursToAssignment?: number;
}

interface WeeklyTrend {
  week: string;
  count: number;
}

// --- HubSpot helpers ---

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

function getField(values: Array<{ name: string; value: string }>, ...names: string[]): string {
  for (const name of names) {
    const found = values.find(v => v.name === name)?.value;
    if (found) return found;
  }
  return '';
}

// --- Deduplication matching Hex logic ---
// Hex: ROW_NUMBER() OVER (PARTITION BY email ORDER BY
//   CASE WHEN how_can_we_help = 'Contact sales' THEN 0 ELSE 1 END,
//   submission_datetime ASC)
// Keep row_num = 1 → prioritize "Contact sales" intent, then earliest submission.

function deduplicateByEmail(submissions: ParsedSubmission[]): Map<string, ParsedSubmission> {
  const byEmail = new Map<string, ParsedSubmission>();

  for (const sub of submissions) {
    const existing = byEmail.get(sub.email);
    if (!existing) {
      byEmail.set(sub.email, sub);
      continue;
    }

    const subIsContactSales = sub.intent === 'Contact sales';
    const existingIsContactSales = existing.intent === 'Contact sales';

    // Prefer Contact sales intent
    if (subIsContactSales && !existingIsContactSales) {
      byEmail.set(sub.email, sub);
    } else if (subIsContactSales === existingIsContactSales && sub.submittedAt < existing.submittedAt) {
      // Same intent priority → keep earliest
      byEmail.set(sub.email, sub);
    }
  }

  return byEmail;
}

// --- Test data filter matching Hex logic ---
// Hex: NOT LIKE '%voodoo%', NOT LIKE '%truv%', NOT LIKE '%.test.%'

function isTestData(email: string, firstName: string, lastName: string): boolean {
  const e = email.toLowerCase();
  const f = firstName.toLowerCase();
  const l = lastName.toLowerCase();
  return (
    e.includes('voodoo') || f.includes('voodoo') || l.includes('voodoo') ||
    e.includes('truv') ||
    e.includes('.test.')
  );
}

export const config = { maxDuration: 30 };

export default async function handler(req: VercelRequest, res: VercelResponse) {  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!HUBSPOT_API_TOKEN) {
    return res.status(500).json({ error: 'HubSpot API token not configured' });
  }

  try {
    const daysBack = Math.min(Math.max(parseInt(String(req.query.days)) || 7, 7), 90);
    const now = Date.now();
    const startDate = now - daysBack * 24 * 60 * 60 * 1000;

    // --- 1. Fetch form submissions ---
    const allSubmissions: ParsedSubmission[] = [];
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

      for (const sub of results) {
        if (sub.submittedAt < startDate) continue;

        const email = getField(sub.values, 'email').toLowerCase();
        if (!email) continue;

        const firstName = getField(sub.values, 'firstname');
        const lastName = getField(sub.values, 'lastname');
        if (isTestData(email, firstName, lastName)) continue;

        const intent = getField(sub.values, 'how_can_we_help', 'how_can_we_help___forms_');

        allSubmissions.push({ email, firstName, lastName, intent, submittedAt: sub.submittedAt });
      }

      // Stop if oldest result is before our date range
      const oldest = results[results.length - 1]?.submittedAt;
      if (oldest && oldest < startDate) break;

      after = data.paging?.next?.after;
      if (!after) break;
      iterations++;
    }

    // --- 2. Deduplicate (Hex logic: first submission, prioritize Contact sales) ---
    const byEmail = deduplicateByEmail(allSubmissions);

    // --- 3. Count by intent (bucket_totals) ---
    const intentCounts: Record<string, number> = {};
    const allDeduplicated = Array.from(byEmail.values());
    for (const entry of allDeduplicated) {
      const intent = entry.intent || 'Unknown';
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    }

    // --- 4. Filter to Contact Sales only (Hex: WHERE how_can_we_help = 'Contact sales') ---
    const contactSalesEntries: ParsedSubmission[] = [];
    const contactSalesEmails: string[] = [];

    for (const entry of allDeduplicated) {
      if (entry.intent === 'Contact sales') {
        contactSalesEntries.push(entry);
        contactSalesEmails.push(entry.email);
      }
    }

    // --- 5. Weekly trend (matching Hex: DATE_TRUNC by WEEK(FRIDAY)) ---
    const fourWeeksAgo = now - 28 * 24 * 60 * 60 * 1000;
    const weekMap = new Map<string, number>();

    for (const entry of contactSalesEntries) {
      if (entry.submittedAt < fourWeeksAgo) continue;
      const d = new Date(entry.submittedAt);
      // Align to Friday week start (matching Hex WEEK(FRIDAY))
      const daysSinceFriday = (d.getDay() + 2) % 7;
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - daysSinceFriday);
      const key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      weekMap.set(key, (weekMap.get(key) || 0) + 1);
    }

    const weeklyTrend: WeeklyTrend[] = Array.from(weekMap.entries())
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime());

    // --- 6. Enrich from HubSpot CRM ---
    // Fetch owners
    const ownersData = (await hubspotGet('/crm/v3/owners?limit=100')) as {
      results: Array<{ id: string; firstName: string; lastName: string }>;
    };
    const ownerMap = new Map<string, string>();
    for (const o of ownersData.results) {
      ownerMap.set(o.id, `${o.firstName} ${o.lastName}`.trim());
    }

    // Batch search contacts — matching Hex property list
    const contactMap = new Map<string, CrmContact>();
    const emailBatches: string[][] = [];
    for (let i = 0; i < contactSalesEmails.length; i += 100) {
      emailBatches.push(contactSalesEmails.slice(i, i + 100));
    }

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
            'email', 'firstname', 'lastname', 'company', 'jobtitle',
            'lifecyclestage', 'hs_lead_status', 'hubspot_owner_id',
            'hubspot_owner_assigneddate',
            'engagements_last_meeting_booked',
            'first_deal_created_date', 'num_associated_deals',
            'hs_email_last_send_date',
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
            company: c.properties.company || '',
            jobTitle: c.properties.jobtitle || '',
            lifecycleStage: c.properties.lifecyclestage || '',
            leadStatus: c.properties.hs_lead_status || '',
            ownerId: c.properties.hubspot_owner_id || '',
            ownerAssignedDate: c.properties.hubspot_owner_assigneddate || '',
            lastMeetingBooked: c.properties.engagements_last_meeting_booked || '',
            firstDealCreatedDate: c.properties.first_deal_created_date || '',
            numDeals: parseInt(c.properties.num_associated_deals || '0') || 0,
            emailLastSendDate: c.properties.hs_email_last_send_date || '',
          });
        }
      } catch {
        // Continue if a batch fails
      }
    }

    // --- 7. Build enriched contacts + funnel counts ---
    // Matching Hex 5-stage funnel:
    //   1. Form Fill (Contact Sales)
    //   2. Assigned to Rep (owner_id IS NOT NULL)
    //   3. First Contact Made (outbound email or call after submission)
    //   4. Meeting Created (SAL)
    //   5. Deal Created

    let assignedCount = 0;
    let firstContactCount = 0;
    let meetingCount = 0;
    let dealCount = 0;
    const hotLeads: EnrichedContact[] = [];
    const repCounts = new Map<string, number>();
    const contacts: EnrichedContact[] = [];

    for (const entry of contactSalesEntries) {
      const crm = contactMap.get(entry.email);
      const ownerName = crm?.ownerId ? ownerMap.get(crm.ownerId) || '' : '';
      const hasOwner = !!crm?.ownerId;

      // Meeting: Hex joins engagement_meeting table; we use the contact property
      const hasMeeting = !!(crm?.lastMeetingBooked);

      // Deal: Hex checks first_deal_created_date IS NOT NULL
      const hasDeal = !!(crm?.firstDealCreatedDate);

      // First contact: Hex joins engagement_email (direction=EMAIL, after submission)
      // We proxy via hs_email_last_send_date — if an outbound email was sent after form fill
      const hasOutreach = !!(crm?.emailLastSendDate &&
        new Date(crm.emailLastSendDate).getTime() >= entry.submittedAt);

      // Hours to assignment (matching Hex TIMESTAMP_DIFF)
      let hoursToAssignment: number | undefined;
      if (hasOwner && crm?.ownerAssignedDate) {
        hoursToAssignment = Math.round(
          (new Date(crm.ownerAssignedDate).getTime() - entry.submittedAt) / 3600000
        );
      }

      // Funnel counts
      if (hasOwner) assignedCount++;
      if (hasOutreach) firstContactCount++;
      if (hasMeeting) meetingCount++;
      if (hasDeal) dealCount++;

      // Rep counts (Hex: GROUP BY owner_name)
      if (ownerName) {
        repCounts.set(ownerName, (repCounts.get(ownerName) || 0) + 1);
      }

      const contact: EnrichedContact = {
        email: entry.email,
        firstName: crm?.firstName || entry.firstName,
        lastName: crm?.lastName || entry.lastName,
        intent: entry.intent,
        submittedAt: new Date(entry.submittedAt).toISOString(),
        company: crm?.company,
        jobTitle: crm?.jobTitle,
        lifecycleStage: crm?.lifecycleStage,
        leadStatus: crm?.leadStatus || '',
        ownerName,
        contactId: crm?.contactId,
        hubspotUrl: crm?.contactId
          ? `https://app.hubspot.com/contacts/${PORTAL_ID}/record/0-1/${crm.contactId}`
          : undefined,
        hasOwner,
        hasMeeting,
        hasDeal,
        hasOutreach,
        hoursToAssignment,
      };

      contacts.push(contact);

      // Hot leads: assigned but no outreach yet (matching Hex hot_leads query)
      if (hasOwner && !hasOutreach) {
        hotLeads.push(contact);
      }
    }

    // Sort contacts newest first
    contacts.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    // Sort hot leads oldest first (longest waiting)
    hotLeads.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

    // Rep breakdown
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
      kpis: {
        contactSales: contactSalesCount,
        salesOutreach: firstContactCount,
        meetingsScheduled: meetingCount,
        login: intentCounts['Login'] || 0,
        verificationHelp: intentCounts['Verification Help'] || intentCounts['Verification help'] || 0,
      },
      funnel: [
        { stage: 'Form Fill (Contact Sales)', count: contactSalesCount },
        { stage: 'Assigned to Rep', count: assignedCount },
        { stage: 'First Contact Made', count: firstContactCount },
        { stage: 'Meeting Created (SAL)', count: meetingCount },
        { stage: 'Deal Created', count: dealCount },
      ],
      weeklyTrend,
      leadStageFunnel,
      byRep,
      hotLeads,
      contacts,
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
