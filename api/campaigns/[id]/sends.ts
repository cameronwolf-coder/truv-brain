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

function corsHeaders(res: import('@vercel/node').VercelResponse): void {}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { id } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing campaign id' });

    const redis = getRedis();
    const raw = await redis.get(`campaign:${id}`);
    if (!raw) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;

    if (req.method === 'GET') {
      return res.status(200).json(campaign.sends || []);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const sendId = slugify(body.name || `send-${Date.now()}`);

      const send = {
        id: sendId,
        name: body.name || 'Untitled Send',
        templateId: body.templateId || '',
        templateName: body.templateName || '',
        scheduledAt: body.scheduledAt || '',
        status: body.scheduledAt ? 'scheduled' : 'draft',
        audienceFilter: body.audienceFilter || { type: 'all' },
        recipientCount: body.recipientCount || campaign.audience?.count || 0,
        workflowKey: body.workflowKey || campaign.workflow?.knockWorkflowKey || '',
        presetKey: body.presetKey || campaign.preset?.key || '',
      };

      campaign.sends = [...(campaign.sends || []), send];
      await redis.set(`campaign:${id}`, JSON.stringify(campaign));

      return res.status(201).json(send);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Campaign API error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
