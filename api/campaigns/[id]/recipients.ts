import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis not configured');
  return new Redis({ url, token });
}

function corsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const KNOCK_API_URL = 'https://api.knock.app/v1';

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

    const audienceKey = campaign.audience?.knockAudienceKey;
    if (!audienceKey) return res.status(200).json({ recipients: [], source: 'none' });

    const token = process.env.KNOCK_SERVICE_TOKEN;
    if (!token) return res.status(200).json({ recipients: [], source: 'no-token' });

    // Fetch audience members from Knock
    const members: Array<{ id: string; email: string; name: string | null; company: string | null; title: string | null }> = [];
    let after: string | null = null;

    while (members.length < 100) {
      const params = new URLSearchParams({ limit: '50' });
      if (after) params.set('after', after);

      const knockRes = await fetch(`${KNOCK_API_URL}/audiences/${audienceKey}/members?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!knockRes.ok) break;
      const data = await knockRes.json();

      for (const entry of data.entries || []) {
        const user = entry.user || {};
        const email = user.email || user.id || '';
        const rawName = user.name || null;
        // Discard name if it's just the email address (legacy sync artifact)
        const name = rawName && rawName !== email && !rawName.includes('@') ? rawName : null;
        members.push({
          id: user.id || '',
          email,
          name,
          company: user.company || null,
          title: user.title || null,
        });
      }

      after = data.page_info?.after || null;
      if (!after) break;
    }

    return res.status(200).json({ recipients: members, total: members.length });
  } catch (error) {
    console.error('Recipients API error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
