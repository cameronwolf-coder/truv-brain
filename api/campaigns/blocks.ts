import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis not configured — UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars required');
  return new Redis({ url, token });
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
    const redis = getRedis();

    if (req.method === 'GET') {
      const { type } = req.query;
      const types = type ? [type as string] : ['audience', 'template', 'workflow'];
      const blocks = [];

      for (const t of types) {
        const ids: string[] = await redis.smembers(`blocks:${t}:index`) || [];
        for (const id of ids) {
          const raw = await redis.get(`block:${t}:${id}`);
          if (raw) {
            blocks.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
          }
        }
      }

      blocks.sort((a, b) => (b.lastUsed || b.createdAt).localeCompare(a.lastUsed || a.createdAt));
      return res.status(200).json(blocks);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const id = body.id || slugify(body.name || `block-${Date.now()}`);
      const now = new Date().toISOString();

      const block = {
        id,
        type: body.type,
        name: body.name,
        config: body.config,
        lastUsed: null,
        usedCount: 0,
        createdAt: now,
      };

      await redis.set(`block:${body.type}:${id}`, JSON.stringify(block));
      await redis.sadd(`blocks:${body.type}:index`, id);

      return res.status(201).json(block);
    }

    if (req.method === 'DELETE') {
      const { id: blockId, type } = req.query;
      if (!blockId || !type) return res.status(400).json({ error: 'Missing id and type params' });

      await redis.del(`block:${type}:${blockId}`);
      await redis.srem(`blocks:${type}:index`, blockId as string);
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Campaign API error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
