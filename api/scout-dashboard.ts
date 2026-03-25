import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';
const SCOUT_API_URL = process.env.SCOUT_API_URL || 'https://8svutjrjpz.us-east-1.awsapprunner.com';
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

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
  const allowedOrigins = ['https://truv-brain.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173'];
  const origin = req.headers.origin || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
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

    // 1. Recently scored — query each pipeline separately so a batch run on B/C
    //    can't crowd out real-time Pipeline A inbound leads.
    //
    //    Pipeline A fallback: some inbound contacts get form_fit_score written by a
    //    HubSpot Workflow scorer but never get scout_scored_at (writeback gap).
    //    We surface those via a createdate + form_fit_score query so the board can
    //    see all inbound leads, not just Scout-confirmed ones.
    // HubSpot search API requires Unix millisecond timestamps (as strings) for date
    // property filters like createdate. ISO strings are rejected and return 0 results.
    const sevenDaysAgoMs = String(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sortByScoredAt = [{ propertyName: 'scout_scored_at', direction: 'DESCENDING' }];
    const [pipelineAScout, pipelineAFallback, pipelineB, pipelineC] = await Promise.all([
      // A — Scout-confirmed (scout_source + scout_scored_at both set)
      hubspotSearch(
        [{ propertyName: 'scout_scored_at', operator: 'HAS_PROPERTY' }, { propertyName: 'scout_source', operator: 'EQ', value: 'form_submission' }],
        scoreProps, 15, sortByScoredAt,
      ),
      // A — fallback: recently created with form_fit_score but no scout_scored_at
      hubspotSearch(
        [
          { propertyName: 'form_fit_score', operator: 'HAS_PROPERTY' },
          { propertyName: 'createdate', operator: 'GTE', value: sevenDaysAgoMs },
          { propertyName: 'scout_scored_at', operator: 'NOT_HAS_PROPERTY' },
        ],
        scoreProps, 15,
        [{ propertyName: 'createdate', direction: 'DESCENDING' }],
      ),
      // B — closed-lost re-engagement
      hubspotSearch(
        [{ propertyName: 'scout_scored_at', operator: 'HAS_PROPERTY' }, { propertyName: 'scout_source', operator: 'EQ', value: 'closed_lost_reengagement' }],
        scoreProps, 15, sortByScoredAt,
      ),
      // C — dashboard signups
      hubspotSearch(
        [{ propertyName: 'scout_scored_at', operator: 'HAS_PROPERTY' }, { propertyName: 'scout_source', operator: 'EQ', value: 'dashboard_signup' }],
        scoreProps, 15, sortByScoredAt,
      ),
    ]);

    // Tag fallback Pipeline A contacts with inferred source so the frontend filter works
    pipelineAFallback.forEach((c: any) => {
      if (!c.properties.scout_source) {
        c.properties = { ...c.properties, scout_source: 'form_submission' };
      }
    });

    // Merge all, dedupe by ID, sort by best available timestamp
    const scoredMap = new Map<string, any>();
    [...pipelineAScout, ...pipelineAFallback, ...pipelineB, ...pipelineC].forEach((c: any) => {
      if (!scoredMap.has(c.id)) scoredMap.set(c.id, c);
    });
    const recentlyScored = Array.from(scoredMap.values()).sort((a: any, b: any) => {
      const aTime = new Date(a.properties?.scout_scored_at || a.properties?.createdate || 0).getTime();
      const bTime = new Date(b.properties?.scout_scored_at || b.properties?.createdate || 0).getTime();
      return bTime - aTime;
    });

    // 2. Enterprise prospects — dashboard_signup contacts with enterprise signals
    const enterpriseProps = [
      ...scoreProps,
      'associatedcompanyid',
    ];
    // Two queries: high form_fit_score OR enterprise routing (union)
    const [entByScore, entByRouting] = await Promise.all([
      hubspotSearch(
        [
          { propertyName: 'scout_source', operator: 'EQ', value: 'dashboard_signup' },
          { propertyName: 'scout_scored_at', operator: 'HAS_PROPERTY' },
          { propertyName: 'form_fit_score', operator: 'GTE', value: '70' },
        ],
        enterpriseProps, 50,
        [{ propertyName: 'form_fit_score', direction: 'DESCENDING' }],
      ),
      hubspotSearch(
        [
          { propertyName: 'scout_source', operator: 'EQ', value: 'dashboard_signup' },
          { propertyName: 'scout_scored_at', operator: 'HAS_PROPERTY' },
          { propertyName: 'lead_routing', operator: 'EQ', value: 'enterprise' },
        ],
        enterpriseProps, 50,
        [{ propertyName: 'form_fit_score', direction: 'DESCENDING' }],
      ),
    ]);

    // Dedupe and merge
    const entMap = new Map<string, any>();
    [...entByScore, ...entByRouting].forEach((c: any) => {
      if (!entMap.has(c.id)) entMap.set(c.id, c);
    });

    // Fetch company data for enterprise prospects (employee count, revenue, industry)
    const entContacts = Array.from(entMap.values());
    const companyIds = new Set<string>();
    entContacts.forEach((c: any) => {
      if (c.properties?.associatedcompanyid) companyIds.add(c.properties.associatedcompanyid);
    });

    const companyData: Record<string, any> = {};
    if (companyIds.size > 0) {
      const companyBatches: string[][] = [];
      const ids = Array.from(companyIds);
      for (let i = 0; i < ids.length; i += 50) {
        companyBatches.push(ids.slice(i, i + 50));
      }
      await Promise.all(companyBatches.map(async (batch) => {
        try {
          const resp = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/companies/batch/read`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${HUBSPOT_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              properties: ['name', 'numberofemployees', 'annualrevenue', 'industry', 'domain'],
              inputs: batch.map(id => ({ id })),
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            (data.results || []).forEach((co: any) => {
              companyData[co.id] = co.properties || {};
            });
          }
        } catch { /* company fetch failed, continue without */ }
      }));
    }

    // Sort enterprise prospects by score descending
    const enterpriseProspects = entContacts
      .map((c: any) => {
        const coData = companyData[c.properties?.associatedcompanyid] || {};
        return { ...c, companyData: coData };
      })
      .sort((a: any, b: any) => {
        const aScore = Number(a.properties?.form_fit_score || 0);
        const bScore = Number(b.properties?.form_fit_score || 0);
        return bScore - aScore;
      });

    // 3. Closed-lost contacts with recent web engagement (engagement heatmap)
    const thirtyDaysAgoMs = String(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const engagedClosedLost = await hubspotSearch(
      [
        { propertyName: 'lifecyclestage', operator: 'EQ', value: '268636563' },
        { propertyName: 'hs_analytics_last_visit_timestamp', operator: 'GTE', value: thirtyDaysAgoMs },
      ],
      scoreProps,
      20,
      [{ propertyName: 'hs_analytics_last_visit_timestamp', direction: 'DESCENDING' }],
    );

    // Also get closed-lost with recent email engagement
    const engagedEmail = await hubspotSearch(
      [
        { propertyName: 'lifecyclestage', operator: 'EQ', value: '268636563' },
        { propertyName: 'hs_email_last_open_date', operator: 'GTE', value: thirtyDaysAgoMs },
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

    // Apollo probe — use people/match with a clearly-bogus email (no match = 0 credits consumed)
    // to capture per-minute rate-limit headers
    const checkApollo = async (): Promise<{
      status: 'healthy' | 'degraded' | 'unreachable';
      rateLimit?: { used: number; remaining: number; limit: number };
    }> => {
      if (!APOLLO_API_KEY) return { status: 'unreachable' };
      try {
        const r = await fetch('https://api.apollo.io/v1/people/match', {
          method: 'POST',
          headers: { 'X-Api-Key': APOLLO_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'healthcheck@probe.truv.internal' }),
          signal: AbortSignal.timeout(5000),
        });
        const used = parseInt(r.headers.get('x-minute-usage') || '0', 10);
        const remaining = parseInt(r.headers.get('x-minute-requests-left') || '0', 10);
        const limit = parseInt(r.headers.get('x-rate-limit-minute') || '1000', 10);
        return {
          status: (r.ok || r.status === 404 || r.status === 422) ? 'healthy' : 'degraded',
          rateLimit: { used, remaining, limit },
        };
      } catch {
        return { status: 'unreachable' };
      }
    };

    const [scoutHealth, hubspotHealth, slackHealth, apolloResult] = await Promise.all([
      checkHealth(`${SCOUT_API_URL}/health`),
      (async () => {
        try {
          const r = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/contacts?limit=1`, {
            headers: { 'Authorization': `Bearer ${HUBSPOT_API_TOKEN}` },
            signal: AbortSignal.timeout(5000),
          });
          return r.ok ? 'healthy' as const : 'degraded' as const;
        } catch { return 'unreachable' as const; }
      })(),
      Promise.resolve(process.env.SLACK_WEBHOOK_URL ? 'healthy' as const : 'unreachable' as const),
      checkApollo(),
    ]);

    const services = {
      scout: { status: scoutHealth, name: 'Scout API', url: SCOUT_API_URL, console: 'https://us-east-1.console.aws.amazon.com/apprunner/home?region=us-east-1#/services', type: 'AWS App Runner' },
      hubspot: { status: hubspotHealth, name: 'HubSpot CRM', url: 'https://app.hubspot.com/contacts/19933594', console: 'https://app.hubspot.com/contacts/19933594', type: 'CRM' },
      pipedream: { status: 'healthy' as const, name: 'Pipedream', url: 'https://pipedream.com/@truvhq/projects/proj_BgsYmjp/tree', console: 'https://pipedream.com/@truvhq/projects/proj_BgsYmjp/tree', type: 'Orchestration' },
      slack: { status: slackHealth, name: 'Slack', url: 'https://truv.slack.com/archives/C0A9Y5HLQAF', console: 'https://truv.slack.com/archives/C0A9Y5HLQAF', type: 'Alerts (#outreach-intelligence)' },
      apollo: { status: apolloResult.status, name: 'LOS/POS Bot', url: 'https://app.apollo.io', console: 'https://app.apollo.io', type: 'Tech Detection (Apollo fallback)', rateLimit: apolloResult.rateLimit },
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
        scoredAt: p.scout_scored_at || p.createdate || null,
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

    // Format enterprise prospects with company data
    const formatEnterprise = (c: any) => {
      const base = formatContact(c);
      const co = c.companyData || {};
      return {
        ...base,
        employeeCount: co.numberofemployees ? Number(co.numberofemployees) : null,
        annualRevenue: co.annualrevenue ? Number(co.annualrevenue) : null,
        industry: co.industry || null,
        companyDomain: co.domain || null,
        companyName: co.name || base.company,
      };
    };

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      scoutHealth,
      services,
      stats,
      recentScores: allScored.map(formatContact),
      engagedClosedLost: engagedContacts.map(formatContact),
      enterpriseProspects: enterpriseProspects.map(formatEnterprise),
    });

  } catch (error: any) {
    console.error('Scout dashboard error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
