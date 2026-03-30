import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createVerify } from 'crypto';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const TRACKED_EVENTS = new Set([
  'processed', 'delivered', 'open', 'click',
  'bounce', 'dropped', 'deferred',
  'unsubscribe', 'spamreport',
]);

interface SendGridEvent {
  email: string;
  event: string;
  timestamp: number;
  sg_event_id?: string;
  sg_message_id?: string;
  url?: string;
  reason?: string;
  knock_workflow?: string;
  category?: string[];
  [key: string]: unknown;
}

/**
 * Verify the SendGrid ECDSA webhook signature.
 * See: https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
 *
 * Set SENDGRID_WEBHOOK_PUBLIC_KEY to the public key from SendGrid's
 * Mail Settings → Event Notifications → Signature Verification.
 */
function verifySignature(
  publicKey: string,
  payload: string,
  signature: string,
  timestamp: string,
): boolean {
  try {
    const verifier = createVerify('SHA256');
    verifier.update(timestamp + payload);
    return verifier.verify(
      { key: publicKey, format: 'pem', type: 'spki' },
      signature,
      'base64',
    );
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify SendGrid ECDSA webhook signature when the public key is configured.
  const webhookPublicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
  if (webhookPublicKey) {
    const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
    const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;
    const rawBody = JSON.stringify(req.body);

    if (!signature || !timestamp) {
      return res.status(403).json({ error: 'Missing webhook signature headers' });
    }

    if (!verifySignature(webhookPublicKey, rawBody, signature, timestamp)) {
      return res.status(403).json({ error: 'Invalid webhook signature' });
    }
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  // SendGrid sends events as a JSON array
  const events: SendGridEvent[] = Array.isArray(req.body) ? req.body : [];

  if (events.length === 0) {
    return res.status(200).json({ received: 0 });
  }

  const pipeline = redis.pipeline();
  let processed = 0;

  for (const event of events) {
    if (!TRACKED_EVENTS.has(event.event)) continue;

    // Get workflow key from custom_args (SendGrid includes them as top-level keys)
    const workflow = event.knock_workflow;
    if (!workflow) continue;

    const email = event.email;
    if (!email) continue;

    const eventData = JSON.stringify({
      type: event.event,
      timestamp: event.timestamp,
      url: event.url || undefined,
      reason: event.reason || undefined,
      sg_message_id: event.sg_message_id || undefined,
    });

    // Aggregate counters
    pipeline.hincrby(`campaign:${workflow}:totals`, event.event, 1);

    // Unique open/click tracking
    if (event.event === 'open') {
      pipeline.sadd(`campaign:${workflow}:unique_open`, email);
    }
    if (event.event === 'click') {
      pipeline.sadd(`campaign:${workflow}:unique_click`, email);
    }

    // Per-recipient event timeline (newest first, cap at 100 events per recipient)
    pipeline.lpush(`campaign:${workflow}:recipient:${email}`, eventData);
    pipeline.ltrim(`campaign:${workflow}:recipient:${email}`, 0, 99);

    // Track all recipients for this campaign
    pipeline.sadd(`campaign:${workflow}:recipients`, email);

    // Campaign registry
    pipeline.sadd('campaigns:index', workflow);

    // Campaign metadata
    pipeline.hset(`campaign:${workflow}:meta`, {
      last_event: event.timestamp,
    });
    // Set first_event only if not already set
    pipeline.hsetnx(`campaign:${workflow}:meta`, 'first_event', event.timestamp);

    processed++;
  }

  if (processed > 0) {
    await pipeline.exec();
  }

  return res.status(200).json({ received: events.length, processed });
}
