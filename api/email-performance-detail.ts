import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface StoredEvent {
  type: string;
  timestamp: number;
  url?: string;
  reason?: string;
  sg_message_id?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  const workflow = req.query.workflow as string;
  if (!workflow) {
    return res.status(400).json({ error: 'workflow query parameter required' });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    // Get all recipient emails for this campaign
    const allEmails = await redis.smembers(`campaign:${workflow}:recipients`) as string[];
    const total = allEmails.length;

    // Paginate
    const pagedEmails = allEmails.slice(offset, offset + limit);

    // Fetch events for each recipient in parallel
    const recipients = await Promise.all(
      pagedEmails.map(async (email) => {
        const rawEvents = await redis.lrange(
          `campaign:${workflow}:recipient:${email}`,
          0, 49
        ) as string[];

        const events: StoredEvent[] = rawEvents.map((e) => {
          if (typeof e === 'string') {
            try { return JSON.parse(e); } catch { return null; }
          }
          return e as unknown as StoredEvent;
        }).filter(Boolean);

        // Sort by timestamp ascending
        events.sort((a, b) => a.timestamp - b.timestamp);

        const eventTypes = new Set(events.map(e => e.type));
        const lastEvent = events.length > 0 ? events[events.length - 1] : null;

        return {
          email,
          events,
          summary: {
            delivered: eventTypes.has('delivered'),
            opened: eventTypes.has('open'),
            clicked: eventTypes.has('click'),
            bounced: eventTypes.has('bounce'),
            last_activity: lastEvent?.timestamp || 0,
          },
        };
      })
    );

    // Sort by last activity, newest first
    recipients.sort((a, b) => b.summary.last_activity - a.summary.last_activity);

    return res.status(200).json({
      workflow_key: workflow,
      recipients,
      total,
    });
  } catch (err) {
    console.error('Email performance detail error:', err);
    return res.status(500).json({ error: 'Failed to fetch recipient data' });
  }
}
