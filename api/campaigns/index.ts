import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis, slugify, corsHeaders } from './helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const redis = getRedis();

    if (req.method === 'GET') {
      const { status } = req.query;
      const ids: string[] = await redis.zrange('campaigns:index', 0, -1, { rev: true }) || [];
      const campaigns = [];

      for (const id of ids) {
        const raw = await redis.get(`campaign:${id}`);
        if (!raw) continue;
        const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (status && campaign.status !== status) continue;
        campaigns.push({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          channel: campaign.channel,
          audienceCount: campaign.audience?.count || 0,
          sendCount: campaign.sends?.length || 0,
          createdAt: campaign.createdAt,
          sentAt: campaign.sentAt,
          nextSendAt: (campaign.sends || [])
            .filter((s: { status: string }) => s.status === 'scheduled')
            .sort((a: { scheduledAt: string }, b: { scheduledAt: string }) => a.scheduledAt.localeCompare(b.scheduledAt))[0]?.scheduledAt || null,
        });
      }

      return res.status(200).json(campaigns);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const id = slugify(body.name || `campaign-${Date.now()}`);
      const now = new Date().toISOString();

      const campaign = {
        id,
        name: body.name || 'Untitled Campaign',
        status: 'draft',
        channel: body.channel || 'marketing',
        audience: body.audience || { hubspotListId: '', count: 0 },
        template: body.template || { sendgridTemplateId: '', name: '' },
        workflow: body.workflow || {},
        preset: body.preset || null,
        pipeline: [
          { stage: 'audience', status: 'idle' },
          { stage: 'list', status: 'idle' },
          { stage: 'knock_audience', status: 'idle' },
          { stage: 'template', status: 'idle' },
          { stage: 'workflow', status: 'idle' },
        ],
        sends: [],
        createdAt: now,
      };

      await redis.set(`campaign:${id}`, JSON.stringify(campaign));
      await redis.zadd('campaigns:index', { score: Date.now(), member: id });

      return res.status(201).json(campaign);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Campaign API error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
