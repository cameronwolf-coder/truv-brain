import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis, corsHeaders } from './helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

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
}
