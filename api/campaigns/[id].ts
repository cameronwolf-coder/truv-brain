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

  try {
    const { id } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing campaign id' });

    const redis = getRedis();

    if (req.method === 'GET') {
      const raw = await redis.get(`campaign:${id}`);
      if (!raw) return res.status(404).json({ error: 'Campaign not found' });
      const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return res.status(200).json(campaign);
    }

    if (req.method === 'PUT') {
      const raw = await redis.get(`campaign:${id}`);
      if (!raw) return res.status(404).json({ error: 'Campaign not found' });
      const existing = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const updated = { ...existing, ...req.body, id };
      await redis.set(`campaign:${id}`, JSON.stringify(updated));
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      await redis.del(`campaign:${id}`);
      await redis.zrem('campaigns:index', id);
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Campaign API error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
