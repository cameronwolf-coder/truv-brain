import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

interface DealStage {
  name: string;
  count: number;
  value: number;
}

// HubSpot default deal stages — maps internal IDs to display names
const STAGE_LABELS: Record<string, string> = {
  appointmentscheduled: 'Appointment Scheduled',
  qualifiedtobuy: 'Qualified to Buy',
  presentationscheduled: 'Presentation Scheduled',
  decisionmakerboughtin: 'Decision Maker Bought-In',
  contractsent: 'Contract Sent',
  closedwon: 'Closed Won',
  closedlost: 'Closed Lost',
};

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
    // Fetch pipeline stages first to get proper names
    const pipelineRes = await fetch(
      `${HUBSPOT_BASE_URL}/crm/v3/pipelines/deals`,
      {
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    let stageNames: Record<string, string> = { ...STAGE_LABELS };

    if (pipelineRes.ok) {
      const pipelineData = (await pipelineRes.json()) as {
        results?: Array<{
          stages?: Array<{ id: string; label: string }>;
        }>;
      };

      // Collect stage labels from ALL pipelines
      for (const pipeline of pipelineData.results || []) {
        if (pipeline?.stages) {
          for (const stage of pipeline.stages) {
            stageNames[stage.id] = stage.label;
          }
        }
      }
    }

    // Search for open deals (exclude closed won/lost)
    const stageMap = new Map<string, { count: number; value: number; totalAge: number }>();
    let after: string | undefined;
    let totalDeals = 0;
    let totalValue = 0;
    let iterations = 0;

    while (iterations < 10) {
      const searchBody: Record<string, unknown> = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'dealstage',
                operator: 'NOT_IN',
                values: ['closedwon', 'closedlost'],
              },
            ],
          },
        ],
        properties: ['dealstage', 'amount', 'createdate', 'dealname'],
        limit: 100,
        sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
      };

      if (after) {
        searchBody.after = after;
      }

      const response = await fetch(
        `${HUBSPOT_BASE_URL}/crm/v3/objects/deals/search`,
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
        throw new Error(`HubSpot deals search error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as {
        results?: Array<{ properties: Record<string, string> }>;
        paging?: { next?: { after: string } };
      };

      const results = data.results || [];
      if (results.length === 0) break;

      const now = Date.now();

      for (const deal of results) {
        const stage = deal.properties.dealstage || 'unknown';
        const amount = parseFloat(deal.properties.amount || '0');
        const created = deal.properties.createdate ? new Date(deal.properties.createdate).getTime() : now;
        const ageDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));

        const existing = stageMap.get(stage) || { count: 0, value: 0, totalAge: 0 };
        existing.count++;
        existing.value += amount;
        existing.totalAge += ageDays;
        stageMap.set(stage, existing);

        totalDeals++;
        totalValue += amount;
      }

      after = data.paging?.next?.after;
      if (!after) break;
      iterations++;
    }

    const stages: DealStage[] = [];
    let totalAgeDays = 0;

    for (const [stageId, metrics] of stageMap) {
      stages.push({
        name: stageNames[stageId] || stageId,
        count: metrics.count,
        value: Math.round(metrics.value),
      });
      totalAgeDays += metrics.totalAge;
    }

    // Sort stages by value descending
    stages.sort((a, b) => b.value - a.value);

    return res.status(200).json({
      stages,
      totalValue: Math.round(totalValue),
      totalDeals,
      avgDealAge: totalDeals > 0 ? Math.round(totalAgeDays / totalDeals) : 0,
    });
  } catch (err) {
    console.error('Pipeline error:', err);
    return res.status(500).json({ error: 'Failed to fetch pipeline data' });
  }
}
