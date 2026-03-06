import type { VercelRequest, VercelResponse } from '@vercel/node';

const SMARTLEAD_API_URL = 'https://server.smartlead.ai/api/v1';
const API_KEY = process.env.SMARTLEAD_API_KEY;

async function slFetch(path: string) {
  const res = await fetch(`${SMARTLEAD_API_URL}${path}?api_key=${API_KEY}`);
  if (!res.ok) throw new Error(`Smartlead ${res.status}: ${path}`);
  return res.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!API_KEY) {
    return res.status(500).json({ error: 'SMARTLEAD_API_KEY not configured' });
  }

  try {
    // Fetch all campaigns
    const allCampaigns = await slFetch('/campaigns') as any[];

    // Filter to ACTIVE or COMPLETED campaigns (skip DRAFTED)
    const relevantCampaigns = allCampaigns.filter(
      (c: any) => c.status === 'ACTIVE' || c.status === 'COMPLETED' || c.status === 'PAUSED'
    );

    // Fetch analytics for each campaign in parallel
    const campaigns = await Promise.all(
      relevantCampaigns.map(async (c: any) => {
        try {
          const analytics = await slFetch(`/campaigns/${c.id}/analytics`);
          const num = (v: any) => parseInt(v || '0', 10);

          const sent = num(analytics.sent_count);
          const opened = num(analytics.unique_open_count);
          const clicked = num(analytics.unique_click_count);
          const replied = num(analytics.reply_count);
          const bounced = num(analytics.bounce_count);
          const total = num(analytics.total_count);
          const unsubscribed = num(analytics.unsubscribed_count);

          return {
            campaign_id: c.id,
            name: analytics.name || c.name,
            status: analytics.status || c.status,
            created_at: c.created_at,
            total_leads: total,
            metrics: {
              sent,
              opened,
              clicked,
              replied,
              bounced,
              unsubscribed,
              open_rate: sent > 0 ? opened / sent : 0,
              click_rate: sent > 0 ? clicked / sent : 0,
              reply_rate: sent > 0 ? replied / sent : 0,
              bounce_rate: sent > 0 ? bounced / sent : 0,
            },
          };
        } catch {
          return null;
        }
      })
    );

    const valid = campaigns.filter(Boolean);
    valid.sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return res.status(200).json(valid);
  } catch (err) {
    console.error('Smartlead performance error:', err);
    return res.status(500).json({ error: 'Failed to fetch Smartlead data' });
  }
}
