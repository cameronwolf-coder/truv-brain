import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis, corsHeaders } from './helpers';

const KNOCK_WRAPPER_URL = process.env.KNOCK_WRAPPER_URL || 'https://knock-wrapper.vercel.app';
const SLACK_WEBHOOK_URL = process.env.CAMPAIGN_SLACK_WEBHOOK;

async function notifySlack(text: string): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;
  await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch(() => {});
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const redis = getRedis();
    const now = new Date().toISOString();
    const results: Array<{ campaignId: string; sendId: string; status: string; error?: string }> = [];

    const campaignIds: string[] = await redis.zrange('campaigns:index', 0, -1) || [];

    for (const campaignId of campaignIds) {
      const raw = await redis.get(`campaign:${campaignId}`);
      if (!raw) continue;
      const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;

      let changed = false;
      for (const send of campaign.sends || []) {
        if (send.status !== 'scheduled') continue;
        if (send.scheduledAt > now) continue;

        send.status = 'sending';
        changed = true;

        try {
          const triggerRes = await fetch(`${KNOCK_WRAPPER_URL}/api/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presetKey: send.presetKey }),
          });

          if (!triggerRes.ok) {
            const errText = await triggerRes.text();
            throw new Error(`knock-wrapper ${triggerRes.status}: ${errText}`);
          }

          send.status = 'sent';
          send.sentAt = now;
          results.push({ campaignId, sendId: send.id, status: 'sent' });
          await notifySlack(`Campaign "${campaign.name}" send "${send.name}" completed (${send.recipientCount} recipients)`);
        } catch (err) {
          send.status = 'error';
          send.error = err instanceof Error ? err.message : 'Unknown error';
          results.push({ campaignId, sendId: send.id, status: 'error', error: send.error });
          await notifySlack(`Campaign "${campaign.name}" send "${send.name}" FAILED: ${send.error}`);
        }
      }

      if (changed) {
        const allSent = campaign.sends.every((s: { status: string }) => ['sent', 'cancelled'].includes(s.status));
        const anyError = campaign.sends.some((s: { status: string }) => s.status === 'error');
        if (allSent) campaign.status = 'sent';
        else if (anyError) campaign.status = 'error';
        else campaign.status = 'sending';

        await redis.set(`campaign:${campaignId}`, JSON.stringify(campaign));
      }
    }

    return res.status(200).json({ processed: results.length, results });
  } catch (error) {
    console.error('Campaign API error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
