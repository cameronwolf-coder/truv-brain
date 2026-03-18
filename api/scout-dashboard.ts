import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';
const SCOUT_API_URL = 'https://8svutjrjpz.us-east-1.awsapprunner.com';

async function hubspotSearch(filters: any[], properties: string[], limit = 50, sorts?: any[]) {
  const body: any = {
    filterGroups: [{ filters }],
    properties,
    limit,
  };
  if (sorts) body.sorts = sorts;

  const resp = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  return data.results || [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!HUBSPOT_API_TOKEN) return res.status(500).json({ error: 'HubSpot API token not configured' });

  try {
    const scoreProps = [
      'firstname', 'lastname', 'email', 'company', 'jobtitle',
      'inbound_lead_tier', 'lead_routing', 'form_fit_score',
      'scout_reasoning', 'scout_confidence', 'scout_scored_at',
      'scout_tech_stack_matches', 'scout_source',
      'hs_analytics_last_visit_timestamp', 'hs_analytics_num_visits',
      'hs_email_last_open_date', 'hs_email_last_click_date',
      'lifecyclestage',
    ];

    // 1. Recently scored contacts (last 7 days) — sorted by scored_at desc
    const recentlyScored = await hubspotSearch(
      [{ propertyName: 'scout_scored_at', operator: 'HAS_PROPERTY' }],
      scoreProps,
      30,
      [{ propertyName: 'scout_scored_at', direction: 'DESCENDING' }],
    );

    // 2. Closed-lost contacts with recent web engagement (engagement heatmap)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const engagedClosedLost = await hubspotSearch(
      [
        { propertyName: 'lifecyclestage', operator: 'EQ', value: '268636563' },
        { propertyName: 'hs_analytics_last_visit_timestamp', operator: 'GTE', value: thirtyDaysAgo },
      ],
      scoreProps,
      20,
      [{ propertyName: 'hs_analytics_last_visit_timestamp', direction: 'DESCENDING' }],
    );

    // Also get closed-lost with recent email engagement
    const engagedEmail = await hubspotSearch(
      [
        { propertyName: 'lifecyclestage', operator: 'EQ', value: '268636563' },
        { propertyName: 'hs_email_last_open_date', operator: 'GTE', value: thirtyDaysAgo },
      ],
      scoreProps,
      20,
      [{ propertyName: 'hs_email_last_open_date', direction: 'DESCENDING' }],
    );

    // Dedupe engaged contacts by ID
    const engagedMap = new Map<string, any>();
    [...engagedClosedLost, ...engagedEmail].forEach((c: any) => {
      if (!engagedMap.has(c.id)) engagedMap.set(c.id, c);
    });
    const engagedContacts = Array.from(engagedMap.values());

    // 3. Pipeline stats — count by source and tier
    const allScored = recentlyScored;
    const stats = {
      total: allScored.length,
      byTier: { hot: 0, warm: 0, cold: 0 },
      bySource: { form_submission: 0, closed_lost_reengagement: 0, dashboard_signup: 0, unknown: 0 },
      byRouting: { enterprise: 0, 'self-service': 0, government: 0, 'not-a-lead': 0 },
    };

    allScored.forEach((c: any) => {
      const tier = c.properties?.inbound_lead_tier || 'cold';
      const source = c.properties?.scout_source || 'unknown';
      const routing = c.properties?.lead_routing || 'self-service';
      if (tier in stats.byTier) stats.byTier[tier as keyof typeof stats.byTier]++;
      if (source in stats.bySource) stats.bySource[source as keyof typeof stats.bySource]++;
      if (routing in stats.byRouting) stats.byRouting[routing as keyof typeof stats.byRouting]++;
    });

    // 4. Check Scout API health
    let scoutHealth = 'unknown';
    try {
      const healthResp = await fetch(`${SCOUT_API_URL}/health`, { signal: AbortSignal.timeout(5000) });
      const healthData = await healthResp.json();
      scoutHealth = healthData.status === 'ok' ? 'healthy' : 'degraded';
    } catch {
      scoutHealth = 'unreachable';
    }

    // Format contacts for the feed
    const formatContact = (c: any) => ({
      id: c.id,
      name: `${c.properties?.firstname || ''} ${c.properties?.lastname || ''}`.trim() || 'Unknown',
      email: c.properties?.email || '',
      company: c.properties?.company || '',
      title: c.properties?.jobtitle || '',
      tier: c.properties?.inbound_lead_tier || null,
      routing: c.properties?.lead_routing || null,
      score: c.properties?.form_fit_score ? Number(c.properties.form_fit_score) : null,
      reasoning: c.properties?.scout_reasoning || null,
      confidence: c.properties?.scout_confidence || null,
      source: c.properties?.scout_source || null,
      scoredAt: c.properties?.scout_scored_at || null,
      techMatches: c.properties?.scout_tech_stack_matches || null,
      lastVisit: c.properties?.hs_analytics_last_visit_timestamp || null,
      numVisits: c.properties?.hs_analytics_num_visits ? Number(c.properties.hs_analytics_num_visits) : 0,
      lastEmailOpen: c.properties?.hs_email_last_open_date || null,
      lastEmailClick: c.properties?.hs_email_last_click_date || null,
      lifecycle: c.properties?.lifecyclestage || null,
    });

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      scoutHealth,
      stats,
      recentScores: allScored.map(formatContact),
      engagedClosedLost: engagedContacts.map(formatContact),
    });

  } catch (error: any) {
    console.error('Scout dashboard error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
