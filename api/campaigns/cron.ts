import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis not configured');
  return new Redis({ url, token });
}

function corsHeaders(res: import('@vercel/node').VercelResponse): void {}

const KNOCK_API_URL = 'https://api.knock.app/v1';
const KNOCK_SERVICE_TOKEN = process.env.KNOCK_SERVICE_TOKEN;
const SLACK_WEBHOOK_URL = process.env.CAMPAIGN_SLACK_WEBHOOK;

async function notifySlack(text: string): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;
  await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch(() => {});
}

async function getAudienceMembers(audienceKey: string): Promise<string[]> {
  if (!KNOCK_SERVICE_TOKEN) throw new Error('KNOCK_SERVICE_TOKEN not set');
  const ids: string[] = [];
  let after: string | null = null;

  while (true) {
    const params = new URLSearchParams({ limit: '50' });
    if (after) params.set('after', after);

    const res = await fetch(`${KNOCK_API_URL}/audiences/${audienceKey}/members?${params}`, {
      headers: { Authorization: `Bearer ${KNOCK_SERVICE_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Knock audience fetch failed: ${res.status}`);
    const data = await res.json();

    for (const entry of data.entries || []) {
      const userId = entry.user?.id || entry.user_id;
      if (userId) ids.push(userId);
    }

    after = data.page_info?.after || null;
    if (!after) break;
  }

  return ids;
}

async function triggerWorkflow(workflowKey: string, recipientIds: string[], data?: Record<string, unknown>): Promise<void> {
  if (!KNOCK_SERVICE_TOKEN) throw new Error('KNOCK_SERVICE_TOKEN not set');

  // Knock allows max 1000 recipients per trigger
  for (let i = 0; i < recipientIds.length; i += 1000) {
    const batch = recipientIds.slice(i, i + 1000);
    const body: Record<string, unknown> = { recipients: batch };
    if (data) body.data = data;

    const res = await fetch(`${KNOCK_API_URL}/workflows/${workflowKey}/trigger`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KNOCK_SERVICE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Knock trigger failed: ${res.status} ${errText}`);
    }
  }
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
          // Get audience members from Knock
          const audienceKey = campaign.audience?.knockAudienceKey || campaignId;
          const recipientIds = await getAudienceMembers(audienceKey);

          if (recipientIds.length === 0) {
            throw new Error('No audience members found');
          }

          // Trigger the Knock workflow directly
          const workflowKey = send.workflowKey || campaign.workflow?.knockWorkflowKey || campaignId;
          await triggerWorkflow(workflowKey, recipientIds);

          send.status = 'sent';
          send.sentAt = now;
          send.recipientCount = recipientIds.length;
          results.push({ campaignId, sendId: send.id, status: 'sent' });
          await notifySlack(`Campaign "${campaign.name}" send "${send.name}" completed (${recipientIds.length} recipients)`);
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
    console.error('Campaign cron error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
