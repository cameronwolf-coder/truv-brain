import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cached, STALE_TTL } from './_lib/cache';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SG = 'https://api.sendgrid.com/v3';

/** Max messages to fetch individual events for (rate-limit friendly) */
const SAMPLE_SIZE = 50;

interface ClickEvent {
  url: string;
  processed: string;
}

interface MessageDetail {
  events: Array<{
    event_name: string;
    url?: string;
    processed?: string;
  }>;
}

async function sgFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${SG}${endpoint}`, {
    headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` },
  });
  if (!res.ok) throw new Error(`SendGrid ${res.status}`);
  return res.json() as Promise<T>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const templateId = req.query.template_id as string;
  if (!templateId) return res.status(400).json({ error: 'template_id required' });
  if (!SENDGRID_API_KEY) return res.status(500).json({ error: 'SendGrid API key not configured' });

  try {
    // Click analytics is expensive (50 individual message fetches).
    // Cache for 1 hour for recent templates, 30 days for old ones.
    // Since we can't easily determine age from template_id alone,
    // use a generous 1-hour TTL and let the Sync button bust it.
    const result = await cached(
      `ep:clicks:${templateId}`,
      STALE_TTL, // click data rarely changes after the first few days
      async () => {
        const query = encodeURIComponent(`template_id="${templateId}"`);
        const data = await sgFetch<{ messages: Array<{ msg_id: string; clicks_count: number; to_email: string }> }>(
          `/messages?query=${query}&limit=1000`
        );
        const allMessages = data.messages || [];
        const clickedMessages = allMessages.filter(m => m.clicks_count > 0);
        const totalClicked = clickedMessages.length;

        const sample = clickedMessages.slice(0, SAMPLE_SIZE);
        const details = await Promise.all(
          sample.map(m =>
            sgFetch<MessageDetail>(`/messages/${m.msg_id}`)
              .catch(() => ({ events: [] } as MessageDetail))
          )
        );

        const urlMap = new Map<string, { clicks: number; uniqueClickers: Set<string> }>();
        const utmMap = new Map<string, number>();

        for (let i = 0; i < details.length; i++) {
          const email = sample[i].to_email;
          for (const ev of details[i].events) {
            if (ev.event_name !== 'click' || !ev.url) continue;

            let parsedUrl: URL;
            try { parsedUrl = new URL(ev.url); } catch { continue; }

            const cleanUrl = `${parsedUrl.origin}${parsedUrl.pathname}`.replace(/\/$/, '');
            const entry = urlMap.get(cleanUrl) || { clicks: 0, uniqueClickers: new Set() };
            entry.clicks++;
            entry.uniqueClickers.add(email);
            urlMap.set(cleanUrl, entry);

            for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
              const val = parsedUrl.searchParams.get(key);
              if (val) {
                const utmKey = `${key}=${val}`;
                utmMap.set(utmKey, (utmMap.get(utmKey) || 0) + 1);
              }
            }
          }
        }

        const scale = totalClicked > 0 && sample.length > 0 ? totalClicked / sample.length : 1;

        const linkClicks = Array.from(urlMap.entries())
          .map(([url, d]) => ({
            url,
            clicks: Math.round(d.clicks * scale),
            unique_clickers: Math.round(d.uniqueClickers.size * scale),
            sample_clicks: d.clicks,
          }))
          .sort((a, b) => b.clicks - a.clicks);

        const utmGroups: Record<string, Array<{ value: string; clicks: number }>> = {};
        for (const [key, count] of utmMap.entries()) {
          const [param, value] = key.split('=');
          if (!utmGroups[param]) utmGroups[param] = [];
          utmGroups[param].push({ value, clicks: Math.round(count * scale) });
        }
        for (const group of Object.values(utmGroups)) {
          group.sort((a, b) => b.clicks - a.clicks);
        }

        return {
          template_id: templateId,
          total_messages: allMessages.length,
          messages_with_clicks: totalClicked,
          sample_size: sample.length,
          link_clicks: linkClicks,
          utm_breakdown: utmGroups,
        };
      }
    );

    return res.status(200).json(result);
  } catch (err) {
    console.error('Click analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch click analytics' });
  }
}
