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

    const pipelineErrors = (campaign.pipeline || [])
      .filter((s: { status: string }) => s.status === 'error')
      .map((s: { stage: string; error: string; completedAt: string }) => ({
        stage: s.stage,
        error: s.error,
        timestamp: s.completedAt,
      }));

    const sendErrors = (campaign.sends || [])
      .filter((s: { status: string }) => s.status === 'error')
      .map((s: { id: string; name: string; error: string }) => ({
        sendId: s.id,
        name: s.name,
        error: s.error,
      }));

    const deliveryErrors: Array<{ email: string; type: string; reason: string; timestamp: number }> = [];

    for (const send of campaign.sends || []) {
      if (!send.workflowKey) continue;
      const bounces = await redis.smembers(`sg:${send.workflowKey}:bounced`) || [];
      for (const email of bounces.slice(0, 50)) {
        deliveryErrors.push({ email: email as string, type: 'bounce', reason: 'Hard bounce', timestamp: 0 });
      }
      const drops = await redis.smembers(`sg:${send.workflowKey}:dropped`) || [];
      for (const email of drops.slice(0, 50)) {
        deliveryErrors.push({ email: email as string, type: 'dropped', reason: 'Suppressed', timestamp: 0 });
      }
    }

    return res.status(200).json({ pipelineErrors, sendErrors, deliveryErrors });
  } catch (error) {
    console.error('Campaign API error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
