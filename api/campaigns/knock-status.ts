import type { VercelRequest, VercelResponse } from '@vercel/node';

function corsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const KNOCK_API_URL = 'https://api.knock.app/v1';
const KNOCK_SERVICE_TOKEN = process.env.KNOCK_SERVICE_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!KNOCK_SERVICE_TOKEN) throw new Error('KNOCK_SERVICE_TOKEN not configured');

    const workflowKey = req.query.workflow as string;
    if (!workflowKey) return res.status(400).json({ error: 'Missing workflow query param' });

    // Fetch messages from Knock for this workflow
    const knockRes = await fetch(
      `${KNOCK_API_URL}/messages?source=${workflowKey}&page_size=50`,
      { headers: { Authorization: `Bearer ${KNOCK_SERVICE_TOKEN}` } }
    );

    if (!knockRes.ok) throw new Error(`Knock API error: ${knockRes.status}`);
    const data = await knockRes.json();

    const messages = (data.items || []).map((m: {
      id: string;
      status: string;
      inserted_at: string;
      recipient: string | { id?: string; email?: string; name?: string };
      channel_id?: string;
    }) => {
      const r = m.recipient;
      let email = '';
      let name = '';
      if (typeof r === 'string') {
        email = r;
      } else if (r) {
        email = r.email || r.id || '';
        name = r.name || '';
      }
      return {
        id: m.id,
        status: m.status,
        email,
        name,
        sentAt: m.inserted_at,
      };
    });

    // Aggregate stats
    const stats = {
      total: data.page_info?.total_count || messages.length,
      delivered: messages.filter((m: { status: string }) => m.status === 'delivered').length,
      sent: messages.filter((m: { status: string }) => m.status === 'sent').length,
      queued: messages.filter((m: { status: string }) => m.status === 'queued').length,
      failed: messages.filter((m: { status: string }) => ['undelivered', 'not_sent', 'bounced'].includes(m.status)).length,
    };

    return res.status(200).json({ messages, stats });
  } catch (error) {
    console.error('Knock status error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
