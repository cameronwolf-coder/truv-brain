import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

async function hubspotSearch(filters: any[], properties: string[], limit = 100, sorts?: any[], after?: string) {
  const body: any = {
    filterGroups: [{ filters }],
    properties,
    limit,
  };
  if (sorts) body.sorts = sorts;
  if (after) body.after = after;

  const resp = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  return { results: data.results || [], paging: data.paging || null };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = ['https://brdytqha8f.us-east-1.awsapprunner.com', 'https://truv-brain.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173'];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!HUBSPOT_API_TOKEN) return res.status(500).json({ error: 'HubSpot API token not configured' });

  try {
    const contactProps = [
      'firstname', 'lastname', 'email', 'company', 'jobtitle',
      'has_dashboard_account', 'createdate',
      'lifecyclestage', 'hs_lead_status',
      'inbound_lead_tier', 'lead_routing', 'form_fit_score',
      'scout_source', 'scout_scored_at',
      'use_case', 'what_s_your_use_case___forms_',
      'how_many_loans_do_you_close_per_year',
      'how_many_applications_do_you_see_per_year_',
      'which_of_these_best_describes_your_job_title_',
      'num_associated_deals',
      'hs_analytics_source', 'hs_analytics_num_visits',
      'hs_analytics_last_visit_timestamp',
      'hs_email_last_open_date', 'hs_email_last_click_date',
      'associatedcompanyid',
      'industry', 'numberofemployees',
    ];

    // Fetch all self-service users (has_dashboard_account = yes/true)
    // Try both "yes" and "true" since HubSpot boolean properties can vary
    const filters = [
      { propertyName: 'has_dashboard_account', operator: 'EQ', value: 'yes' },
    ];

    // Paginate to get all results (HubSpot search limit is 100 per page)
    const allResults: any[] = [];
    let after: string | undefined;
    let pages = 0;
    const maxPages = 5; // Cap at 500 contacts

    do {
      const { results, paging } = await hubspotSearch(
        filters,
        contactProps,
        100,
        [{ propertyName: 'createdate', direction: 'DESCENDING' }],
        after,
      );
      allResults.push(...results);
      after = paging?.next?.after;
      pages++;
    } while (after && pages < maxPages);

    // If "yes" returns nothing, try "true"
    if (allResults.length === 0) {
      after = undefined;
      pages = 0;
      const altFilters = [
        { propertyName: 'has_dashboard_account', operator: 'EQ', value: 'true' },
      ];
      do {
        const { results, paging } = await hubspotSearch(
          altFilters,
          contactProps,
          100,
          [{ propertyName: 'createdate', direction: 'DESCENDING' }],
          after,
        );
        allResults.push(...results);
        after = paging?.next?.after;
        pages++;
      } while (after && pages < maxPages);
    }

    // Fetch company data for contacts with associatedcompanyid
    const companyIds = new Set<string>();
    allResults.forEach((c: any) => {
      if (c.properties?.associatedcompanyid) companyIds.add(c.properties.associatedcompanyid);
    });

    const companyData: Record<string, any> = {};
    if (companyIds.size > 0) {
      const ids = Array.from(companyIds);
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        try {
          const resp = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/companies/batch/read`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${HUBSPOT_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              properties: ['name', 'numberofemployees', 'annualrevenue', 'industry', 'domain', 'city', 'state'],
              inputs: batch.map(id => ({ id })),
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            (data.results || []).forEach((co: any) => {
              companyData[co.id] = co.properties || {};
            });
          }
        } catch { /* continue without company data */ }
      }
    }

    // Format response
    const users = allResults.map((c: any) => {
      const p = c.properties || {};
      const co = companyData[p.associatedcompanyid] || {};
      return {
        id: c.id,
        name: `${p.firstname || ''} ${p.lastname || ''}`.trim() || p.email || 'Unknown',
        email: p.email || '',
        company: co.name || p.company || '',
        title: p.jobtitle || '',
        createdAt: p.createdate || null,
        lifecycle: p.lifecyclestage || null,
        leadStatus: p.hs_lead_status || null,
        tier: p.inbound_lead_tier || null,
        routing: p.lead_routing || null,
        score: p.form_fit_score ? Number(p.form_fit_score) : null,
        source: p.scout_source || null,
        scoredAt: p.scout_scored_at || null,
        useCase: p.use_case || p.what_s_your_use_case___forms_ || null,
        loanVolume: p.how_many_loans_do_you_close_per_year || null,
        appVolume: p.how_many_applications_do_you_see_per_year_ || null,
        roleLevel: p.which_of_these_best_describes_your_job_title_ || null,
        deals: p.num_associated_deals ? Number(p.num_associated_deals) : 0,
        analyticsSource: p.hs_analytics_source || null,
        numVisits: p.hs_analytics_num_visits ? Number(p.hs_analytics_num_visits) : 0,
        lastVisit: p.hs_analytics_last_visit_timestamp || null,
        lastEmailOpen: p.hs_email_last_open_date || null,
        lastEmailClick: p.hs_email_last_click_date || null,
        // Company data
        employeeCount: co.numberofemployees ? Number(co.numberofemployees) : null,
        annualRevenue: co.annualrevenue ? Number(co.annualrevenue) : null,
        industry: co.industry || null,
        companyDomain: co.domain || null,
        companyLocation: [co.city, co.state].filter(Boolean).join(', ') || null,
      };
    });

    // Compute summary stats
    const stats = {
      total: users.length,
      byTier: { hot: 0, warm: 0, cold: 0 },
      byRouting: { enterprise: 0, 'self-service': 0, government: 0, 'not-a-lead': 0 } as Record<string, number>,
      byLifecycle: {} as Record<string, number>,
      byIndustry: {} as Record<string, number>,
    };

    users.forEach((u) => {
      const tier = u.tier || 'cold';
      if (tier in stats.byTier) stats.byTier[tier as keyof typeof stats.byTier]++;
      const routing = u.routing || 'self-service';
      stats.byRouting[routing] = (stats.byRouting[routing] || 0) + 1;
      if (u.lifecycle) stats.byLifecycle[u.lifecycle] = (stats.byLifecycle[u.lifecycle] || 0) + 1;
      if (u.industry) stats.byIndustry[u.industry] = (stats.byIndustry[u.industry] || 0) + 1;
    });

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      total: users.length,
      stats,
      users,
    });

  } catch (error: any) {
    console.error('Self-service users error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
