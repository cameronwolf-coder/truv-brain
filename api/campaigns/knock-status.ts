import type { VercelRequest, VercelResponse } from '@vercel/node';

function corsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const KNOCK_API_URL = 'https://api.knock.app/v1';
const KNOCK_SERVICE_TOKEN = process.env.KNOCK_SERVICE_TOKEN;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

interface KnockMessage {
  id: string;
  status: string;
  email: string;
  name: string;
  sentAt: string;
}

function parseRecipient(r: unknown): { email: string; name: string } {
  if (typeof r === 'string') return { email: r, name: '' };
  if (r && typeof r === 'object') {
    const obj = r as { id?: string; email?: string; name?: string };
    return { email: obj.email || obj.id || '', name: obj.name || '' };
  }
  return { email: '', name: '' };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!KNOCK_SERVICE_TOKEN) throw new Error('KNOCK_SERVICE_TOKEN not configured');

    const workflowKey = req.query.workflow as string;
    if (!workflowKey) return res.status(400).json({ error: 'Missing workflow query param' });

    // Paginate through ALL Knock messages for this workflow
    const allMessages: KnockMessage[] = [];
    let after: string | null = null;
    let totalCount = 0;

    while (allMessages.length < 5000) { // safety cap
      const params = new URLSearchParams({ source: workflowKey, page_size: '50' });
      if (after) params.set('after', after);

      const knockRes = await fetch(`${KNOCK_API_URL}/messages?${params}`, {
        headers: { Authorization: `Bearer ${KNOCK_SERVICE_TOKEN}` },
      });
      if (!knockRes.ok) throw new Error(`Knock API error: ${knockRes.status}`);
      const data = await knockRes.json();

      totalCount = data.page_info?.total_count || totalCount;

      for (const m of data.items || []) {
        const { email, name } = parseRecipient(m.recipient);
        allMessages.push({
          id: m.id,
          status: m.status,
          email,
          name,
          sentAt: m.inserted_at,
        });
      }

      after = data.page_info?.after || null;
      if (!after) break;
    }

    // Filter out internal/test recipients
    const TEST_DOMAINS = ['truv.com', 'citadelid.com'];
    const isTestEmail = (email: string) => TEST_DOMAINS.some(d => email.toLowerCase().endsWith(`@${d}`));
    const productionMessages = allMessages.filter(m => !isTestEmail(m.email));
    const testMessages = allMessages.filter(m => isTestEmail(m.email));

    // Aggregate Knock stats from production messages only
    const knockStats = {
      total: productionMessages.length,
      delivered: productionMessages.filter((m) => m.status === 'delivered').length,
      sent: productionMessages.filter((m) => m.status === 'sent').length,
      queued: productionMessages.filter((m) => m.status === 'queued').length,
      failed: productionMessages.filter((m) => ['undelivered', 'not_sent', 'bounced'].includes(m.status)).length,
      testExcluded: testMessages.length,
    };

    // Fetch SendGrid category stats for this workflow
    let sendgridStats = null;
    if (SENDGRID_API_KEY) {
      try {
        // SendGrid categories API — get stats for this workflow key
        const sgRes = await fetch(
          `https://api.sendgrid.com/v3/categories/stats?categories=${workflowKey}&start_date=${getStartDate()}`,
          { headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` } }
        );
        if (sgRes.ok) {
          const sgData = await sgRes.json();
          // Aggregate across all dates
          let requests = 0, delivered = 0, opens = 0, uniqueOpens = 0,
              clicks = 0, uniqueClicks = 0, bounces = 0, blocks = 0,
              spamReports = 0, unsubscribes = 0;

          for (const day of sgData) {
            for (const stat of day.stats || []) {
              const m = stat.metrics || {};
              requests += m.requests || 0;
              delivered += m.delivered || 0;
              opens += m.opens || 0;
              uniqueOpens += m.unique_opens || 0;
              clicks += m.clicks || 0;
              uniqueClicks += m.unique_clicks || 0;
              bounces += m.bounces || 0;
              blocks += m.blocks || 0;
              spamReports += m.spam_reports || 0;
              unsubscribes += m.unsubscribes || 0;
            }
          }

          sendgridStats = {
            requests,
            delivered,
            opens,
            uniqueOpens,
            clicks,
            uniqueClicks,
            bounces,
            blocks,
            spamReports,
            unsubscribes,
            openRate: delivered > 0 ? uniqueOpens / delivered : 0,
            clickRate: delivered > 0 ? uniqueClicks / delivered : 0,
            bounceRate: requests > 0 ? bounces / requests : 0,
          };
        }
      } catch { /* SendGrid stats are optional */ }
    }

    return res.status(200).json({
      messages: productionMessages,
      stats: knockStats,
      sendgridStats,
    });
  } catch (error) {
    console.error('Knock status error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}

function getStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}
