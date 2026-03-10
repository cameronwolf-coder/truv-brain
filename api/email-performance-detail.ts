import type { VercelRequest, VercelResponse } from '@vercel/node';

const KNOCK_API_KEY = process.env.KNOCK_API_KEY;
const KNOCK_BASE = 'https://api.knock.app/v1';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_BASE = 'https://api.sendgrid.com/v3';

/** Same map as email-performance.ts — workflow key → template ID */
const WORKFLOW_TEMPLATES: Record<string, string> = {
  'fcm-webinar-initial-invite': 'd-c0d164034f3d4ac686fc3a3627fcd6a6',
  'fcm-webinar-next-week-reminder': 'd-8c95c04331ca4d299166ff4b0dd5999b',
  'fcm-webinar-24hr-reminder': 'd-3828c81c30224d998c2e9379feec1b23',
  'fcm-webinar-2hr-happening-soon': 'd-4fabc3ad81b54576a133fb9a8fb3d494',
  'fcm-webinar-closed-lost-invite': 'd-f007b95d24e743c5ace5b0fdd641923e',
  'case-study-roundup': 'd-2a143712949848f09403e7b7e5888d4a',
  'case-study-cmg-home-loans': 'd-328eb38ed70a4697ac4ffc3bc3257a42',
  'case-study-banksouth-mortgage': 'd-38af4407671740bca4e75ef5e70ea2cc',
  'product-update-february-2026': 'd-c9d363eaac97470bb73ff78f1782005d',
  'product-update-monthly': 'd-c9d363eaac97470bb73ff78f1782005d',
  'product-update-govt-multilingual-verification': 'd-c9d363eaac97470bb73ff78f1782005d',
  'truv-product-insider-february-2026': 'd-b16131794e514b2784f048923f1cdeea',
  'email-2-truv-product-insider-february-2026': 'd-1051d71848bf4b8f8463c486163a588f',
  'email-3-truv-product-insider-february-2026': 'd-14261458851c447d93ef6ac28491e259',
  'email-4-truv-product-insider-february-2026': 'd-e26ae8a088d6450cb9b52898763d2bbe',
  'public-sector-webinar-invite': 'd-ba5047f0ecf84048a1f1c3a644523cbf',
  'public-sector-webinar-next-week': 'd-ac2d943829094e1f99569d9578e052bd',
  'public-sector-webinar-24hr': 'd-a640dd471fce41fba3ccb258d0c5f149',
  'whitepaper-multi-data-source': 'd-22c26b8f6d264ceba8df5c357a2eb3ab',
  'campaign-launcher-demo-lead-magnet-feb-2026': 'd-716f7028b96e44aa9e8e731103e2a9a0',
  'changelog-weekly-digest': 'd-d8a9aeef798844c68a8f09a455c06141',
  'customer-surver': 'd-b3fb355e144c4a2886a9e59330aa1eb6',
};

interface KnockMessage {
  id: string;
  status: string;
  recipient: string;
  inserted_at: string;
}

interface KnockResponse {
  items: KnockMessage[];
  page_info: {
    total_count: number;
    after: string | null;
  };
}

interface SgMessage {
  to_email: string;
  status: string;
  opens_count: number;
  clicks_count: number;
  last_event_time: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const workflow = req.query.workflow as string;
  if (!workflow) return res.status(400).json({ error: 'workflow query parameter required' });

  if (!KNOCK_API_KEY) return res.status(500).json({ error: 'Knock API key not configured' });

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const templateId = WORKFLOW_TEMPLATES[workflow] || '';

  try {
    // Step 1: Get recipients from Knock (paginated)
    // Knock uses cursor pagination, so we fetch page_size messages and skip via after cursor.
    // For offset-based pagination, we fetch offset+limit and slice.
    const fetchSize = offset + limit;
    let knockItems: KnockMessage[] = [];
    let totalCount = 0;
    let cursor: string | null = null;

    // Paginate through Knock until we have enough items
    while (knockItems.length < fetchSize) {
      const cursorParam = cursor ? `&after=${encodeURIComponent(cursor)}` : '';
      const batchSize = Math.min(fetchSize - knockItems.length, 50);
      const knockRes = await fetch(
        `${KNOCK_BASE}/messages?source=${workflow}&page_size=${batchSize}${cursorParam}`,
        { headers: { Authorization: `Bearer ${KNOCK_API_KEY}` } }
      );
      if (!knockRes.ok) break;
      const data: KnockResponse = await knockRes.json();
      totalCount = data.page_info.total_count;
      knockItems.push(...data.items);
      cursor = data.page_info.after;
      if (!cursor || data.items.length < batchSize) break;
    }

    // Slice to the requested page
    const pageItems = knockItems.slice(offset, offset + limit);

    // Step 2: Build engagement lookup from SendGrid Messages API
    // Fetch all messages for this template (up to 1000) and index by email
    const engagementMap = new Map<string, {
      opens_count: number;
      clicks_count: number;
      status: string;
      last_event_time: string;
    }>();

    if (templateId && SENDGRID_API_KEY) {
      const query = encodeURIComponent(`template_id="${templateId}"`);
      const sgRes = await fetch(
        `${SENDGRID_BASE}/messages?query=${query}&limit=1000`,
        { headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` } }
      );
      if (sgRes.ok) {
        const sgData = await sgRes.json();
        for (const msg of (sgData.messages || []) as SgMessage[]) {
          const existing = engagementMap.get(msg.to_email);
          // Keep the entry with the most engagement
          if (!existing || msg.opens_count > existing.opens_count) {
            engagementMap.set(msg.to_email, {
              opens_count: msg.opens_count,
              clicks_count: msg.clicks_count,
              status: msg.status,
              last_event_time: msg.last_event_time,
            });
          }
        }
      }
    }

    // Step 3: Merge Knock recipients with SendGrid engagement
    const recipients = pageItems.map(item => {
      const email = item.recipient;
      const sg = engagementMap.get(email);
      const knockTs = Math.floor(new Date(item.inserted_at).getTime() / 1000);
      const sgTs = sg ? Math.floor(new Date(sg.last_event_time).getTime() / 1000) : 0;

      return {
        email,
        events: [], // Not fetching per-event detail for performance
        summary: {
          delivered: item.status === 'delivered' || sg?.status === 'delivered',
          opened: (sg?.opens_count || 0) > 0,
          clicked: (sg?.clicks_count || 0) > 0,
          bounced: item.status === 'undelivered' || sg?.status === 'not_delivered',
          last_activity: Math.max(knockTs, sgTs),
        },
      };
    });

    // Sort by engagement level (clicked > opened > delivered > bounced), then by time
    recipients.sort((a, b) => {
      const scoreA = a.summary.clicked ? 3 : a.summary.opened ? 2 : a.summary.delivered ? 1 : 0;
      const scoreB = b.summary.clicked ? 3 : b.summary.opened ? 2 : b.summary.delivered ? 1 : 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return b.summary.last_activity - a.summary.last_activity;
    });

    return res.status(200).json({
      workflow_key: workflow,
      recipients,
      total: totalCount,
    });
  } catch (err) {
    console.error('Email performance detail error:', err);
    return res.status(500).json({ error: 'Failed to fetch recipient data' });
  }
}
