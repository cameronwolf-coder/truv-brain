import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

interface WeekBucket {
  week: string; // "Mar 3" format
  weekStart: string; // ISO date
  total: number;
  subscriber: number;
  lead: number;
  marketingqualifiedlead: number;
  salesqualifiedlead: number;
  other: number;
}

const LIFECYCLE_STAGES = ['subscriber', 'lead', 'marketingqualifiedlead', 'salesqualifiedlead'];

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
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Build week buckets
    const weeks: WeekBucket[] = [];
    const weekStartDate = new Date(thirtyDaysAgo);
    // Align to Monday
    weekStartDate.setDate(weekStartDate.getDate() - ((weekStartDate.getDay() + 6) % 7));

    while (weekStartDate < now) {
      const weekEnd = new Date(weekStartDate);
      weekEnd.setDate(weekEnd.getDate() + 6);

      weeks.push({
        week: weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        weekStart: weekStartDate.toISOString().split('T')[0],
        total: 0,
        subscriber: 0,
        lead: 0,
        marketingqualifiedlead: 0,
        salesqualifiedlead: 0,
        other: 0,
      });

      weekStartDate.setDate(weekStartDate.getDate() + 7);
    }

    // Search contacts created in last 30 days
    const byStage: Record<string, number> = {
      subscriber: 0,
      lead: 0,
      marketingqualifiedlead: 0,
      salesqualifiedlead: 0,
      other: 0,
    };

    let total = 0;
    let after: string | undefined;
    let iterations = 0;

    while (iterations < 5) {
      const searchBody: Record<string, unknown> = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'createdate',
                operator: 'GTE',
                value: thirtyDaysAgo.getTime().toString(),
              },
            ],
          },
        ],
        properties: ['createdate', 'lifecyclestage'],
        limit: 100,
        sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
      };

      if (after) {
        searchBody.after = after;
      }

      const response = await fetch(
        `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(searchBody),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HubSpot contacts search error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as {
        results?: Array<{ properties: Record<string, string> }>;
        paging?: { next?: { after: string } };
      };

      const results = data.results || [];
      if (results.length === 0) break;

      for (const contact of results) {
        const stage = (contact.properties.lifecyclestage || '').toLowerCase();
        const created = new Date(contact.properties.createdate);

        total++;

        // Count by stage
        if (LIFECYCLE_STAGES.includes(stage)) {
          byStage[stage]++;
        } else {
          byStage.other++;
        }

        // Bucket into weeks
        const createdStr = created.toISOString().split('T')[0];
        for (let i = weeks.length - 1; i >= 0; i--) {
          if (createdStr >= weeks[i].weekStart) {
            weeks[i].total++;
            if (LIFECYCLE_STAGES.includes(stage)) {
              (weeks[i] as Record<string, number>)[stage]++;
            } else {
              weeks[i].other++;
            }
            break;
          }
        }
      }

      after = data.paging?.next?.after;
      if (!after) break;
      iterations++;
    }

    return res.status(200).json({
      total,
      byStage: {
        subscriber: byStage.subscriber,
        lead: byStage.lead,
        mql: byStage.marketingqualifiedlead,
        sql: byStage.salesqualifiedlead,
        other: byStage.other,
      },
      byWeek: weeks,
      period: {
        start: thirtyDaysAgo.toISOString(),
        end: now.toISOString(),
      },
    });
  } catch (err) {
    console.error('Lead flow error:', err);
    return res.status(500).json({ error: 'Failed to fetch lead flow data' });
  }
}
