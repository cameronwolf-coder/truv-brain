import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis not configured — UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars required');
  return new Redis({ url, token });
}

function corsHeaders(res: import('@vercel/node').VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { id } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing campaign id' });

    const redis = getRedis();
    const raw = await redis.get(`campaign:${id}`);
    if (!raw) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const sends = [];
    const totals = { recipients: 0, delivered: 0, opens: 0, clicks: 0, bounces: 0, openRate: 0, clickRate: 0 };

    for (const send of campaign.sends || []) {
      if (send.status !== 'sent') continue;
      const key = send.workflowKey;
      if (!key) continue;

      const stats = await redis.hgetall(`sg:${key}:stats`) || {};
      const delivered = Number(stats.delivered || 0);
      const opens = Number(stats.unique_opens || 0);
      const clicks = Number(stats.unique_clicks || 0);
      const bounces = Number(stats.bounced || 0);
      const recipients = send.recipientCount || 0;

      const sendData = {
        sendId: send.id,
        name: send.name,
        sentAt: send.sentAt,
        recipients,
        delivered,
        opens,
        clicks,
        bounces,
        openRate: delivered > 0 ? opens / delivered : 0,
        clickRate: delivered > 0 ? clicks / delivered : 0,
      };
      sends.push(sendData);

      totals.recipients += recipients;
      totals.delivered += delivered;
      totals.opens += opens;
      totals.clicks += clicks;
      totals.bounces += bounces;
    }

    totals.openRate = totals.delivered > 0 ? totals.opens / totals.delivered : 0;
    totals.clickRate = totals.delivered > 0 ? totals.clicks / totals.delivered : 0;

    return res.status(200).json({ sends, totals });
  } catch (error) {
    console.error('Campaign API error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
