import type { VercelRequest, VercelResponse } from '@vercel/node';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_BASE = 'https://api.sendgrid.com/v3';

interface SgGlobalStat {
  date: string;
  stats: Array<{
    metrics: {
      requests: number;
      delivered: number;
      opens: number;
      unique_opens: number;
      clicks: number;
      unique_clicks: number;
      bounces: number;
      bounce_drops: number;
      deferred: number;
      unsubscribes: number;
      spam_reports: number;
      processed: number;
    };
  }>;
}

async function sgGet(endpoint: string): Promise<unknown> {
  const res = await fetch(`${SENDGRID_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SendGrid ${res.status}: ${text}`);
  }
  return res.json();
}

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!SENDGRID_API_KEY) {
    return res.status(500).json({ error: 'SendGrid API key not configured' });
  }

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch daily global stats for last 30 days
    const stats = (await sgGet(
      `/stats?start_date=${toYMD(thirtyDaysAgo)}&end_date=${toYMD(now)}&aggregated_by=week`
    )) as SgGlobalStat[];

    // Build weekly campaign-like objects the frontend expects
    const campaigns = stats
      .filter(s => s.stats.length > 0)
      .map(s => {
        const m = s.stats[0].metrics;
        const weekDate = new Date(s.date);
        const weekTs = Math.floor(weekDate.getTime() / 1000);

        return {
          workflow_key: `week-${s.date}`,
          name: `Week of ${weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          template_id: '',
          first_event: weekTs,
          last_event: weekTs,
          metrics: {
            processed: m.processed,
            delivered: m.delivered,
            opens: m.opens,
            unique_opens: m.unique_opens,
            clicks: m.clicks,
            unique_clicks: m.unique_clicks,
            bounces: m.bounces,
            open_rate: m.delivered > 0 ? m.unique_opens / m.delivered : 0,
            click_rate: m.delivered > 0 ? m.unique_clicks / m.delivered : 0,
            bounce_rate: m.processed > 0 ? m.bounces / m.processed : 0,
            click_to_open: m.unique_opens > 0 ? m.unique_clicks / m.unique_opens : 0,
          },
        };
      });

    // Sort newest first
    campaigns.sort((a, b) => b.last_event - a.last_event);

    return res.status(200).json(campaigns);
  } catch (err) {
    console.error('Email performance error:', err);
    return res.status(500).json({ error: 'Failed to fetch email stats' });
  }
}
