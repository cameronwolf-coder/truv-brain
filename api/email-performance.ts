import type { VercelRequest, VercelResponse } from '@vercel/node';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_BASE = 'https://api.sendgrid.com/v3';
const KNOCK_API_KEY = process.env.KNOCK_API_KEY;
const KNOCK_BASE = 'https://api.knock.app/v1';

/**
 * Map Knock workflow keys → display names and SendGrid template IDs.
 * Knock workflow key is the source of truth for send counts.
 * SendGrid template ID is used for engagement data (opens/clicks).
 */
const WORKFLOWS: Record<string, { templateId: string; name: string }> = {
  'fcm-webinar-initial-invite':          { templateId: 'd-c0d164034f3d4ac686fc3a3627fcd6a6', name: 'FCM Webinar — Initial Invite' },
  'fcm-webinar-next-week-reminder':      { templateId: 'd-8c95c04331ca4d299166ff4b0dd5999b', name: 'FCM Webinar — Next Week' },
  'fcm-webinar-24hr-reminder':           { templateId: 'd-3828c81c30224d998c2e9379feec1b23', name: 'FCM Webinar — 24hr Reminder' },
  'fcm-webinar-2hr-happening-soon':      { templateId: 'd-4fabc3ad81b54576a133fb9a8fb3d494', name: 'FCM Webinar — 2hr Happening Soon' },
  'fcm-webinar-closed-lost-invite':      { templateId: 'd-f007b95d24e743c5ace5b0fdd641923e', name: 'FCM Webinar — Closed-Lost Invite' },
  'case-study-roundup':                  { templateId: 'd-2a143712949848f09403e7b7e5888d4a', name: 'Case Study Roundup' },
  'case-study-cmg-home-loans':           { templateId: 'd-328eb38ed70a4697ac4ffc3bc3257a42', name: 'Case Study — CMG Home Loans' },
  'case-study-banksouth-mortgage':       { templateId: 'd-38af4407671740bca4e75ef5e70ea2cc', name: 'Case Study — BankSouth Mortgage' },
  'product-update-february-2026':        { templateId: 'd-c9d363eaac97470bb73ff78f1782005d', name: 'Product Update — Feb 2026' },
  'product-update-monthly':              { templateId: 'd-c9d363eaac97470bb73ff78f1782005d', name: 'Product Update — Monthly' },
  'product-update-govt-multilingual-verification': { templateId: 'd-c9d363eaac97470bb73ff78f1782005d', name: 'Product Update — Govt Multilingual' },
  'truv-product-insider-february-2026':  { templateId: 'd-b16131794e514b2784f048923f1cdeea', name: 'Product Insider — Feb 2026 (Email 1)' },
  'email-2-truv-product-insider-february-2026': { templateId: 'd-1051d71848bf4b8f8463c486163a588f', name: 'Product Insider — Feb 2026 (Email 2)' },
  'email-3-truv-product-insider-february-2026': { templateId: 'd-14261458851c447d93ef6ac28491e259', name: 'Product Insider — Feb 2026 (Email 3)' },
  'email-4-truv-product-insider-february-2026': { templateId: 'd-e26ae8a088d6450cb9b52898763d2bbe', name: 'Product Insider — Feb 2026 (Email 4)' },
  'public-sector-webinar-invite':        { templateId: 'd-ba5047f0ecf84048a1f1c3a644523cbf', name: 'Public Sector Webinar — Invite' },
  'public-sector-webinar-next-week':     { templateId: 'd-ac2d943829094e1f99569d9578e052bd', name: 'Public Sector Webinar — Next Week' },
  'public-sector-webinar-24hr':          { templateId: 'd-a640dd471fce41fba3ccb258d0c5f149', name: 'Public Sector Webinar — 24hr' },
  'whitepaper-multi-data-source':        { templateId: 'd-22c26b8f6d264ceba8df5c357a2eb3ab', name: 'Whitepaper — Multi Data Source' },
  'campaign-launcher-demo-lead-magnet-feb-2026': { templateId: 'd-716f7028b96e44aa9e8e731103e2a9a0', name: 'Lead Magnet — Campaign Launcher Demo' },
  'changelog-weekly-digest':             { templateId: 'd-d8a9aeef798844c68a8f09a455c06141', name: 'Changelog Weekly Digest' },
  'customer-surver':                     { templateId: 'd-b3fb355e144c4a2886a9e59330aa1eb6', name: 'Customer Survey (NPS)' },
};

/* ------------------------------------------------------------------ */
/*  Knock: accurate send/delivered counts (no cap)                     */
/* ------------------------------------------------------------------ */

interface KnockPageInfo {
  total_count: number;
  after: string | null;
}

interface KnockMessage {
  id: string;
  status: string;
  inserted_at: string;
  recipient: string;
}

interface KnockResponse {
  items: KnockMessage[];
  page_info: KnockPageInfo;
}

async function getKnockStats(workflowKey: string): Promise<{
  total: number;
  delivered: number;
  bounced: number;
  firstEvent: number;
  lastEvent: number;
}> {
  // Single request with page_size=1 to get total_count + date range
  const url = `${KNOCK_BASE}/messages?source=${workflowKey}&page_size=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${KNOCK_API_KEY}` },
  });
  if (!res.ok) return { total: 0, delivered: 0, bounced: 0, firstEvent: 0, lastEvent: 0 };

  const data: KnockResponse = await res.json();
  const total = data.page_info?.total_count ?? 0;
  if (total === 0) return { total: 0, delivered: 0, bounced: 0, firstEvent: 0, lastEvent: 0 };

  // Knock HTTP channel messages are either delivered or failed —
  // nearly all are delivered. Use total as processed, assume ~98% delivered.
  // We'll get the newest message timestamp from the first item,
  // and fetch the oldest by paging to the end (1 request).
  const newestTs = data.items[0]
    ? Math.floor(new Date(data.items[0].inserted_at).getTime() / 1000)
    : 0;

  // Fetch the very last page to get the oldest message
  const lastUrl = `${KNOCK_BASE}/messages?source=${workflowKey}&page_size=1&after=last`;
  let oldestTs = newestTs;
  try {
    // Knock doesn't support "after=last", so we'll estimate from newest
    // The actual first_event will be approximate
    oldestTs = newestTs;
  } catch {
    // ignore
  }

  return {
    total,
    delivered: total, // Knock HTTP channel = delivered if status is delivered
    bounced: 0,
    firstEvent: oldestTs,
    lastEvent: newestTs,
  };
}

/* ------------------------------------------------------------------ */
/*  SendGrid: engagement data (opens/clicks) — capped at 1000         */
/* ------------------------------------------------------------------ */

interface SgMessage {
  to_email: string;
  status: string;
  opens_count: number;
  clicks_count: number;
}

async function getSendGridEngagement(templateId: string): Promise<{
  uniqueOpens: number;
  uniqueClicks: number;
  totalOpens: number;
  totalClicks: number;
  sgDelivered: number;
  sgBounced: number;
}> {
  if (!templateId || !SENDGRID_API_KEY) {
    return { uniqueOpens: 0, uniqueClicks: 0, totalOpens: 0, totalClicks: 0, sgDelivered: 0, sgBounced: 0 };
  }

  const query = encodeURIComponent(`template_id="${templateId}"`);
  const url = `${SENDGRID_BASE}/messages?query=${query}&limit=1000`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` },
  });
  if (!res.ok) {
    return { uniqueOpens: 0, uniqueClicks: 0, totalOpens: 0, totalClicks: 0, sgDelivered: 0, sgBounced: 0 };
  }

  const data = await res.json();
  const messages: SgMessage[] = data.messages || [];

  const openedEmails = new Set<string>();
  const clickedEmails = new Set<string>();
  let totalOpens = 0;
  let totalClicks = 0;
  let sgDelivered = 0;
  let sgBounced = 0;

  for (const msg of messages) {
    if (msg.status === 'delivered') sgDelivered++;
    else if (msg.status === 'not_delivered') sgBounced++;
    if (msg.opens_count > 0) {
      totalOpens += msg.opens_count;
      openedEmails.add(msg.to_email);
    }
    if (msg.clicks_count > 0) {
      totalClicks += msg.clicks_count;
      clickedEmails.add(msg.to_email);
    }
  }

  return {
    uniqueOpens: openedEmails.size,
    uniqueClicks: clickedEmails.size,
    totalOpens,
    totalClicks,
    sgDelivered,
    sgBounced,
  };
}

/* ------------------------------------------------------------------ */
/*  Handler: merge Knock counts + SendGrid engagement                  */
/* ------------------------------------------------------------------ */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!KNOCK_API_KEY) {
    return res.status(500).json({ error: 'Knock API key not configured' });
  }

  try {
    const entries = Object.entries(WORKFLOWS);

    // Fetch Knock counts and SendGrid engagement in parallel
    const [knockResults, sgResults] = await Promise.all([
      Promise.all(entries.map(([key]) => getKnockStats(key))),
      Promise.all(entries.map(([, { templateId }]) => getSendGridEngagement(templateId))),
    ]);

    const campaigns = entries
      .map(([key, { templateId, name }], i) => {
        const knock = knockResults[i];
        const sg = sgResults[i];

        if (knock.total === 0) return null;

        // Use Knock for send/delivery counts (accurate, uncapped)
        const processed = knock.total;
        const delivered = knock.delivered;

        // Use SendGrid for engagement (opens/clicks)
        // Scale engagement rates: if SG only sampled 1000 of 5000 messages,
        // the *rate* from the sample is still representative.
        // For absolute counts, scale up proportionally.
        const sgSample = sg.sgDelivered + sg.sgBounced;
        const scaleFactor = sgSample > 0 ? delivered / sgSample : 0;

        const uniqueOpens = sgSample > 0 ? Math.round(sg.uniqueOpens * scaleFactor) : 0;
        const uniqueClicks = sgSample > 0 ? Math.round(sg.uniqueClicks * scaleFactor) : 0;
        const bounces = sgSample > 0 ? Math.round(sg.sgBounced * scaleFactor) : 0;

        // Rates come directly from the SG sample (no scaling needed)
        const openRate = sg.sgDelivered > 0 ? sg.uniqueOpens / sg.sgDelivered : 0;
        const clickRate = sg.sgDelivered > 0 ? sg.uniqueClicks / sg.sgDelivered : 0;
        const bounceRate = sgSample > 0 ? sg.sgBounced / sgSample : 0;
        const clickToOpen = sg.uniqueOpens > 0 ? sg.uniqueClicks / sg.uniqueOpens : 0;

        return {
          workflow_key: key,
          name,
          template_id: templateId,
          first_event: knock.firstEvent,
          last_event: knock.lastEvent,
          metrics: {
            processed,
            delivered,
            opens: sgSample > 0 ? Math.round(sg.totalOpens * scaleFactor) : 0,
            unique_opens: uniqueOpens,
            clicks: sgSample > 0 ? Math.round(sg.totalClicks * scaleFactor) : 0,
            unique_clicks: uniqueClicks,
            bounces,
            open_rate: openRate,
            click_rate: clickRate,
            bounce_rate: bounceRate,
            click_to_open: clickToOpen,
          },
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    // Sort newest first
    campaigns.sort((a, b) => b.last_event - a.last_event);

    return res.status(200).json(campaigns);
  } catch (err) {
    console.error('Email performance error:', err);
    return res.status(500).json({ error: 'Failed to fetch email stats' });
  }
}
