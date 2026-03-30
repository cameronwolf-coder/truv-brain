import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const KNOCK_API_KEY = process.env.KNOCK_SERVICE_TOKEN || process.env.KNOCK_API_KEY;
const KNOCK_BASE = 'https://api.knock.app/v1';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_BASE = 'https://api.sendgrid.com/v3';

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis not configured');
  return new Redis({ url, token });
}

/** Fetch total send count + timestamp from Knock for a workflow key */
async function knockStats(workflowKey: string): Promise<{ total: number; lastEvent: string | null }> {
  if (!KNOCK_API_KEY) return { total: 0, lastEvent: null };
  try {
    const res = await fetch(`${KNOCK_BASE}/messages?source=${workflowKey}&page_size=1`, {
      headers: { Authorization: `Bearer ${KNOCK_API_KEY}` },
    });
    if (!res.ok) return { total: 0, lastEvent: null };
    const data = await res.json();
    return {
      total: data.page_info?.total_count ?? 0,
      lastEvent: data.items?.[0]?.inserted_at ?? null,
    };
  } catch { return { total: 0, lastEvent: null }; }
}

/** Fetch engagement stats from SendGrid activity API for a template ID */
async function sgStats(templateId: string): Promise<{ delivered: number; bounced: number; uniqueOpens: number; uniqueClicks: number }> {
  if (!SENDGRID_API_KEY || !templateId) return { delivered: 0, bounced: 0, uniqueOpens: 0, uniqueClicks: 0 };
  try {
    const query = encodeURIComponent(`template_id="${templateId}"`);
    const res = await fetch(`${SENDGRID_BASE}/messages?query=${query}&limit=1000`, {
      headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` },
    });
    if (!res.ok) return { delivered: 0, bounced: 0, uniqueOpens: 0, uniqueClicks: 0 };
    const data = await res.json();
    const messages: Array<{ to_email: string; status: string; opens_count: number; clicks_count: number }> = data.messages || [];
    const openedSet = new Set<string>();
    const clickedSet = new Set<string>();
    let delivered = 0, bounced = 0;
    for (const m of messages) {
      if (m.status === 'delivered') delivered++;
      else if (m.status === 'not_delivered') bounced++;
      if (m.opens_count > 0) openedSet.add(m.to_email);
      if (m.clicks_count > 0) clickedSet.add(m.to_email);
    }
    return { delivered, bounced, uniqueOpens: openedSet.size, uniqueClicks: clickedSet.size };
  } catch { return { delivered: 0, bounced: 0, uniqueOpens: 0, uniqueClicks: 0 }; }
}

function corsHeaders(res: import('@vercel/node').VercelResponse): void {}

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

    const sends = [];
    const totals = { recipients: 0, delivered: 0, opens: 0, clicks: 0, bounces: 0, openRate: 0, clickRate: 0 };

    for (const send of campaign.sends || []) {
      if (send.status !== 'sent') continue;
      const key = send.workflowKey;
      if (!key) continue;

      const stats = await redis.hgetall(`sg:${key}:stats`) || {};
      const delivered = Number(stats.delivered || 0);
      const opens = Number(stats.unique_opens || 0);
      const clicks = Number(stats.unique_clicks || 0);
      const bounces = Number(stats.bounced || 0);
      const recipients = send.recipientCount || 0;

      const sendData = {
        sendId: send.id,
        name: send.name,
        sentAt: send.sentAt,
        recipients,
        delivered,
        opens,
        clicks,
        bounces,
        openRate: delivered > 0 ? opens / delivered : 0,
        clickRate: delivered > 0 ? clicks / delivered : 0,
      };
      sends.push(sendData);

      totals.recipients += recipients;
      totals.delivered += delivered;
      totals.opens += opens;
      totals.clicks += clicks;
      totals.bounces += bounces;
    }

    totals.openRate = totals.delivered > 0 ? totals.opens / totals.delivered : 0;
    totals.clickRate = totals.delivered > 0 ? totals.clicks / totals.delivered : 0;

    // Fallback: if no Campaign OS sends were tracked (e.g. campaign was sent
    // directly via Knock), query Knock + SendGrid for inferred historical data.
    const workflowKey = campaign.workflow?.knockWorkflowKey;
    const templateId = campaign.template?.sendgridTemplateId;
    if (sends.length === 0 && workflowKey) {
      const [knock, sg] = await Promise.all([
        knockStats(workflowKey),
        templateId ? sgStats(templateId) : Promise.resolve({ delivered: 0, bounced: 0, uniqueOpens: 0, uniqueClicks: 0 }),
      ]);
      if (knock.total > 0) {
        const delivered = sg.delivered || knock.total;
        const opens = sg.uniqueOpens;
        const clicks = sg.uniqueClicks;
        const bounces = sg.bounced;
        sends.push({
          sendId: 'inferred',
          name: `${campaign.name} (inferred from Knock)`,
          sentAt: knock.lastEvent,
          recipients: knock.total,
          delivered,
          opens,
          clicks,
          bounces,
          openRate: delivered > 0 ? opens / delivered : 0,
          clickRate: delivered > 0 ? clicks / delivered : 0,
        });
        totals.recipients = knock.total;
        totals.delivered = delivered;
        totals.opens = opens;
        totals.clicks = clicks;
        totals.bounces = bounces;
        totals.openRate = delivered > 0 ? opens / delivered : 0;
        totals.clickRate = delivered > 0 ? clicks / delivered : 0;
      }
    }

    return res.status(200).json({ sends, totals, fallback: sends.length > 0 && sends[0]?.sendId === 'inferred' });
  } catch (error) {
    console.error('Campaign API error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
