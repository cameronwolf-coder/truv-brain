import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const WORKFLOW_TEMPLATES: Record<string, string> = {
  'whitepaper-multi-data-source': 'd-22c26b8f6d264ceba8df5c357a2eb3ab',
  'fcm-webinar-initial-invite': 'd-c0d164034f3d4ac686fc3a3627fcd6a6',
  'fcm-webinar-next-week': 'd-8c95c04331ca4d299166ff4b0dd5999b',
  'fcm-webinar-24hr': 'd-3828c81c30224d998c2e9379feec1b23',
  'fcm-webinar-2hr': 'd-4fabc3ad81b54576a133fb9a8fb3d494',
  'case-study-roundup': 'd-2a143712949848f09403e7b7e5888d4a',
};

interface SgMessage {
  from_email: string;
  msg_id: string;
  subject: string;
  to_email: string;
  status: string;
  opens_count: number;
  clicks_count: number;
  last_event_time: string;
}

async function fetchMessages(templateId: string, apiKey: string): Promise<SgMessage[]> {
  const all: SgMessage[] = [];
  const query = encodeURIComponent(`template_id="${templateId}"`);
  const url = `https://api.sendgrid.com/v3/messages?query=${query}&limit=1000`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`SendGrid API ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  all.push(...(data.messages || []));
  return all;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'SENDGRID_API_KEY not configured' });
  }
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  const results: Record<string, { fetched: number; written: number }> = {};

  try {
    for (const [workflow, templateId] of Object.entries(WORKFLOW_TEMPLATES)) {
      const messages = await fetchMessages(templateId, apiKey);
      results[workflow] = { fetched: messages.length, written: 0 };

      if (messages.length === 0) continue;

      const pipeline = redis.pipeline();
      let written = 0;

      // Track earliest and latest event times
      let firstEvent = Infinity;
      let lastEvent = 0;

      for (const msg of messages) {
        const email = msg.to_email;
        if (!email) continue;

        const eventTs = Math.floor(new Date(msg.last_event_time).getTime() / 1000);
        if (eventTs < firstEvent) firstEvent = eventTs;
        if (eventTs > lastEvent) lastEvent = eventTs;

        // Always count as delivered if status is delivered
        const isDelivered = msg.status === 'delivered';

        // Increment aggregate counters
        if (isDelivered) {
          pipeline.hincrby(`campaign:${workflow}:totals`, 'delivered', 1);
          pipeline.hincrby(`campaign:${workflow}:totals`, 'processed', 1);
        } else if (msg.status === 'not_delivered') {
          pipeline.hincrby(`campaign:${workflow}:totals`, 'bounce', 1);
          pipeline.hincrby(`campaign:${workflow}:totals`, 'processed', 1);
        }

        // Count opens and clicks from the message-level counts
        if (msg.opens_count > 0) {
          pipeline.hincrby(`campaign:${workflow}:totals`, 'open', msg.opens_count);
          pipeline.sadd(`campaign:${workflow}:unique_open`, email);
        }
        if (msg.clicks_count > 0) {
          pipeline.hincrby(`campaign:${workflow}:totals`, 'click', msg.clicks_count);
          pipeline.sadd(`campaign:${workflow}:unique_click`, email);
        }

        // Per-recipient event data (reconstruct from summary)
        const events: Array<{ type: string; timestamp: number }> = [];
        if (isDelivered) {
          events.push({ type: 'delivered', timestamp: eventTs });
        }
        if (msg.opens_count > 0) {
          events.push({ type: 'open', timestamp: eventTs });
        }
        if (msg.clicks_count > 0) {
          events.push({ type: 'click', timestamp: eventTs });
        }
        if (msg.status === 'not_delivered') {
          events.push({ type: 'bounce', timestamp: eventTs });
        }

        for (const ev of events) {
          pipeline.lpush(`campaign:${workflow}:recipient:${email}`, JSON.stringify(ev));
        }
        pipeline.ltrim(`campaign:${workflow}:recipient:${email}`, 0, 99);

        // Track recipient
        pipeline.sadd(`campaign:${workflow}:recipients`, email);

        written++;
      }

      // Campaign registry and metadata
      pipeline.sadd('campaigns:index', workflow);
      if (firstEvent < Infinity) {
        pipeline.hsetnx(`campaign:${workflow}:meta`, 'first_event', firstEvent);
      }
      if (lastEvent > 0) {
        pipeline.hset(`campaign:${workflow}:meta`, { last_event: lastEvent });
      }
      pipeline.hsetnx(`campaign:${workflow}:meta`, 'name',
        workflow.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
      pipeline.hsetnx(`campaign:${workflow}:meta`, 'template_id', templateId);

      await pipeline.exec();
      results[workflow].written = written;
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('Backfill error:', err);
    return res.status(500).json({
      error: 'Backfill failed',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
