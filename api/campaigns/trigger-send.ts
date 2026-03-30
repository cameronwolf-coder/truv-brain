import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

function corsHeaders(res: VercelResponse): void {}

const KNOCK_API_URL = 'https://api.knock.app/v1';
const KNOCK_SERVICE_TOKEN = process.env.KNOCK_SERVICE_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { campaignId, batchSize = 500, delaySeconds = 30 } = req.body;
    if (!campaignId) return res.status(400).json({ error: 'Missing campaignId' });
    if (!KNOCK_SERVICE_TOKEN) throw new Error('KNOCK_SERVICE_TOKEN not configured');

    const redis = getRedis();
    const raw = await redis.get(`campaign:${campaignId}`);
    if (!raw) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const workflowKey = campaign.workflow?.knockWorkflowKey;
    const audienceKey = campaign.audience?.knockAudienceKey;
    if (!workflowKey) return res.status(400).json({ error: 'No workflow configured' });
    if (!audienceKey) return res.status(400).json({ error: 'No audience configured' });

    // Fetch audience members
    const memberIds: string[] = [];
    let after: string | null = null;
    while (true) {
      const params = new URLSearchParams({ limit: '50' });
      if (after) params.set('after', after);
      const knockRes = await fetch(`${KNOCK_API_URL}/audiences/${audienceKey}/members?${params}`, {
        headers: { Authorization: `Bearer ${KNOCK_SERVICE_TOKEN}` },
      });
      if (!knockRes.ok) throw new Error(`Knock audience fetch failed: ${knockRes.status}`);
      const data = await knockRes.json();
      for (const entry of data.entries || []) {
        const userId = entry.user?.id || entry.user_id;
        if (userId) memberIds.push(userId);
      }
      after = data.page_info?.after || null;
      if (!after) break;
    }

    if (memberIds.length === 0) throw new Error('No audience members found');

    // Trigger in batches
    let triggered = 0;
    for (let i = 0; i < memberIds.length; i += batchSize) {
      const batch = memberIds.slice(i, i + batchSize);
      const triggerRes = await fetch(`${KNOCK_API_URL}/workflows/${workflowKey}/trigger`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KNOCK_SERVICE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipients: batch }),
      });
      if (!triggerRes.ok) {
        const errText = await triggerRes.text();
        throw new Error(`Knock trigger failed at batch ${Math.floor(i / batchSize) + 1}: ${errText}`);
      }
      triggered += batch.length;

      // Delay between batches (except the last one)
      if (i + batchSize < memberIds.length && delaySeconds > 0) {
        await new Promise((r) => setTimeout(r, delaySeconds * 1000));
      }
    }

    // Update campaign status
    campaign.status = 'sent';
    campaign.sentAt = new Date().toISOString();
    await redis.set(`campaign:${campaignId}`, JSON.stringify(campaign));

    return res.status(200).json({
      triggered,
      total: memberIds.length,
      batches: Math.ceil(memberIds.length / batchSize),
      workflowKey,
      audienceKey,
    });
  } catch (error) {
    console.error('Trigger send error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
