import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis, corsHeaders } from '../../helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { id, sid } = req.query;
    if (!id || typeof id !== 'string' || !sid || typeof sid !== 'string') {
      return res.status(400).json({ error: 'Missing campaign or send id' });
    }

    const redis = getRedis();
    const raw = await redis.get(`campaign:${id}`);
    if (!raw) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const sendIndex = (campaign.sends || []).findIndex((s: { id: string }) => s.id === sid);
    if (sendIndex === -1) return res.status(404).json({ error: 'Send not found' });

    if (req.method === 'PUT') {
      campaign.sends[sendIndex] = { ...campaign.sends[sendIndex], ...req.body, id: sid };
      await redis.set(`campaign:${id}`, JSON.stringify(campaign));
      return res.status(200).json(campaign.sends[sendIndex]);
    }

    if (req.method === 'DELETE') {
      campaign.sends.splice(sendIndex, 1);
      await redis.set(`campaign:${id}`, JSON.stringify(campaign));
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Campaign API error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
