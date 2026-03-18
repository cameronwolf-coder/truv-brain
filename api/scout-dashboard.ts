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
      'hs_analytics_last_url',
      'hs_email_last_open_date', 'hs_email_last_click_date',
      'hs_last_sales_activity_timestamp',
      'lifecyclestage', 'hs_lead_status',
      'use_case', 'what_s_your_use_case___forms_',
      'how_many_loans_do_you_close_per_year',
      'how_many_applications_do_you_see_per_year_',
      'which_of_these_best_describes_your_job_title_',
      'how_can_we_help', 'createdate',
      'num_associated_deals', 'hs_analytics_source',
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

    // 4. Check all service health
    const checkHealth = async (url: string, timeout = 5000): Promise<'healthy' | 'degraded' | 'unreachable'> => {
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(timeout) });
        if (resp.ok) return 'healthy';
        return 'degraded';
      } catch {
        return 'unreachable';
      }
    };

    const [scoutHealth, hubspotHealth, slackHealth] = await Promise.all([
      checkHealth(`${SCOUT_API_URL}/health`),
      checkHealth(`${HUBSPOT_BASE_URL}/crm/v3/objects/contacts?limit=1`, 5000).then(async () => {
        // Actually test with auth
        try {
          const r = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/contacts?limit=1`, {
            headers: { 'Authorization': `Bearer ${HUBSPOT_API_TOKEN}` },
            signal: AbortSignal.timeout(5000),
          });
          return r.ok ? 'healthy' as const : 'degraded' as const;
        } catch { return 'unreachable' as const; }
      }),
      // Slack webhook — can't test without posting, so just check if configured
      Promise.resolve(process.env.SLACK_WEBHOOK_URL ? 'healthy' as const : 'unreachable' as const),
    ]);

    const services = {
      scout: { status: scoutHealth, name: 'Scout API', url: SCOUT_API_URL, console: 'https://us-east-1.console.aws.amazon.com/apprunner/home?region=us-east-1#/services', type: 'AWS App Runner' },
      hubspot: { status: hubspotHealth, name: 'HubSpot CRM', url: 'https://app.hubspot.com/contacts/19933594', console: 'https://app.hubspot.com/contacts/19933594', type: 'CRM' },
      pipedream: { status: 'healthy' as const, name: 'Pipedream', url: 'https://pipedream.com/@truvhq/projects/proj_BgsYmjp/tree', console: 'https://pipedream.com/@truvhq/projects/proj_BgsYmjp/tree', type: 'Orchestration' },
      slack: { status: slackHealth, name: 'Slack', url: 'https://truv.slack.com/archives/C0A9Y5HLQAF', console: 'https://truv.slack.com/archives/C0A9Y5HLQAF', type: 'Alerts (#outreach-intelligence)' },
      apollo: { status: process.env.APOLLO_API_KEY ? 'healthy' as const : 'unreachable' as const, name: 'Apollo.io', url: 'https://app.apollo.io', console: 'https://app.apollo.io', type: 'Enrichment' },
      gemini: { status: process.env.GOOGLE_API_KEY ? 'healthy' as const : 'unreachable' as const, name: 'Gemini 2.0 Flash', url: 'https://aistudio.google.com', console: 'https://aistudio.google.com', type: 'AI Agent (via Agno)' },
      ecr: { status: scoutHealth, name: 'AWS ECR', url: 'https://us-east-1.console.aws.amazon.com/ecr/repositories/private/968062515708/truv-scout', console: 'https://us-east-1.console.aws.amazon.com/ecr/repositories/private/968062515708/truv-scout', type: 'Container Registry' },
      vercel: { status: 'healthy' as const, name: 'Vercel', url: 'https://truv-brain.vercel.app', console: 'https://vercel.com/truvhq/truv-brain', type: 'Frontend + API Routes' },
    };

    // Format contacts for the feed
    const formatContact = (c: any) => {
      const p = c.properties || {};
      const source = p.scout_source || null;
      // Derive pipeline steps status based on what data exists
      const steps = {
        trigger: { status: 'complete' as const, detail: source === 'dashboard_signup' ? 'Slack DashBot → Pipedream' : source === 'closed_lost_reengagement' ? 'Cron → Pipedream' : 'HubSpot Form → Pipedream' },
        hubspot: { status: (p.email ? 'complete' : 'failed') as 'complete' | 'failed', detail: source === 'dashboard_signup' ? 'Find-or-create' : 'Contact lookup' },
        scorer: { status: (p.form_fit_score ? 'complete' : 'skipped') as 'complete' | 'skipped', detail: `Base score: ${p.form_fit_score || 'N/A'}` },
        apollo: { status: (p.scout_tech_stack_matches ? 'complete' : 'no-data') as 'complete' | 'no-data', detail: p.scout_tech_stack_matches || 'No tech matches found' },
        agent: { status: (p.scout_reasoning && p.scout_reasoning !== 'Deterministic score only.' ? 'complete' : 'fallback') as 'complete' | 'fallback', detail: p.scout_confidence ? `Confidence: ${p.scout_confidence}` : 'Agent did not run' },
        writeback: { status: (p.scout_scored_at ? 'complete' : 'pending') as 'complete' | 'pending', detail: p.scout_scored_at ? `Written ${p.scout_scored_at}` : 'Not written yet' },
      };

      return {
        id: c.id,
        name: `${p.firstname || ''} ${p.lastname || ''}`.trim() || p.email || 'Unknown',
        email: p.email || '',
        company: p.company || '',
        title: p.jobtitle || '',
        tier: p.inbound_lead_tier || null,
        routing: p.lead_routing || null,
        score: p.form_fit_score ? Number(p.form_fit_score) : null,
        reasoning: p.scout_reasoning || null,
        confidence: p.scout_confidence || null,
        source,
        scoredAt: p.scout_scored_at || null,
        techMatches: p.scout_tech_stack_matches || null,
        lastVisit: p.hs_analytics_last_visit_timestamp || null,
        lastVisitUrl: p.hs_analytics_last_url || null,
        numVisits: p.hs_analytics_num_visits ? Number(p.hs_analytics_num_visits) : 0,
        lastEmailOpen: p.hs_email_last_open_date || null,
        lastEmailClick: p.hs_email_last_click_date || null,
        lastSalesActivity: p.hs_last_sales_activity_timestamp || null,
        lifecycle: p.lifecyclestage || null,
        leadStatus: p.hs_lead_status || null,
        useCase: p.use_case || p.what_s_your_use_case___forms_ || null,
        loanVolume: p.how_many_loans_do_you_close_per_year || null,
        appVolume: p.how_many_applications_do_you_see_per_year_ || null,
        roleLevel: p.which_of_these_best_describes_your_job_title_ || null,
        howCanWeHelp: p.how_can_we_help || null,
        createdAt: p.createdate || null,
        analyticsSource: p.hs_analytics_source || null,
        deals: p.num_associated_deals ? Number(p.num_associated_deals) : 0,
        steps,
      };
    };

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      scoutHealth,
      services,
      stats,
      recentScores: allScored.map(formatContact),
      engagedClosedLost: engagedContacts.map(formatContact),
    });

  } catch (error: any) {
    console.error('Scout dashboard error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
