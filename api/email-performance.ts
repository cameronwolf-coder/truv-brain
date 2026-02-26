import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  try {
    // Get all campaign workflow keys
    const workflowKeys = await redis.smembers('campaigns:index') as string[];

    if (workflowKeys.length === 0) {
      return res.status(200).json([]);
    }

    // Fetch data for all campaigns in parallel
    const campaigns = await Promise.all(
      workflowKeys.map(async (key) => {
        const pipeline = redis.pipeline();
        pipeline.hgetall(`campaign:${key}:totals`);
        pipeline.hgetall(`campaign:${key}:meta`);
        pipeline.scard(`campaign:${key}:unique_open`);
        pipeline.scard(`campaign:${key}:unique_click`);

        const results = await pipeline.exec();
        const totals = (results[0] || {}) as Record<string, string>;
        const meta = (results[1] || {}) as Record<string, string>;
        const uniqueOpens = (results[2] || 0) as number;
        const uniqueClicks = (results[3] || 0) as number;

        const num = (v: string | undefined) => parseInt(v || '0', 10);
        const delivered = num(totals.delivered);
        const processed = num(totals.processed);

        return {
          workflow_key: key,
          name: meta.name || key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          template_id: meta.template_id || '',
          first_event: num(meta.first_event),
          last_event: num(meta.last_event),
          metrics: {
            processed,
            delivered,
            opens: num(totals.open),
            unique_opens: uniqueOpens,
            clicks: num(totals.click),
            unique_clicks: uniqueClicks,
            bounces: num(totals.bounce),
            dropped: num(totals.dropped),
            deferred: num(totals.deferred),
            unsubscribes: num(totals.unsubscribe),
            spam_reports: num(totals.spamreport),
            open_rate: delivered > 0 ? uniqueOpens / delivered : 0,
            click_rate: delivered > 0 ? uniqueClicks / delivered : 0,
            bounce_rate: processed > 0 ? num(totals.bounce) / processed : 0,
            click_to_open: uniqueOpens > 0 ? uniqueClicks / uniqueOpens : 0,
          },
        };
      })
    );

    // Sort by last event, newest first
    campaigns.sort((a, b) => b.last_event - a.last_event);

    return res.status(200).json(campaigns);
  } catch (err) {
    console.error('Email performance error:', err);
    return res.status(500).json({ error: 'Failed to fetch campaign data' });
  }
}
