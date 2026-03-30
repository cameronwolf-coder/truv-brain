import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface TruvEvent {
  title: string;
  date: string;
  type: 'event' | 'webinar';
  url: string;
}

async function scrapeEvents(): Promise<TruvEvent[]> {
  const res = await fetch('https://truv.com/events');
  if (!res.ok) throw new Error(`truv.com ${res.status}`);
  const html = await res.text();

  const events: TruvEvent[] = [];

  // Match event cards — each has an <a> with href="/events/...", a date string, and title
  // The page uses consistent card markup with links to /events/<slug>
  const cardRegex = /<a[^>]*href="(\/events\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = cardRegex.exec(html)) !== null) {
    const href = match[1];
    const block = match[2];

    // Skip generic /events links (the page itself)
    if (href === '/events' || href === '/events/') continue;

    // Extract text content by stripping tags
    const textContent = block.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // Look for a date pattern like "March 1-4, 2026" or "March 10, 2026"
    const dateMatch = textContent.match(
      /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:\s*[-–]\s*\d{1,2})?,?\s*\d{4}/i,
    );

    // Determine type from text
    const isWebinar = /webinar/i.test(textContent);

    // Extract title — usually the longest meaningful text chunk that isn't the date or CTA
    const lines = textContent
      .split(/\s{2,}/)
      .map((s) => s.trim())
      .filter(
        (s) =>
          s.length > 3 &&
          !/^(Request|Register|Learn More|View|See)/i.test(s) &&
          !/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d/i.test(s) &&
          !/^(Event|Webinar)$/i.test(s),
      );

    const title = lines[0] || href.split('/').pop()?.replace(/-/g, ' ') || '';
    if (!title) continue;

    events.push({
      title,
      date: dateMatch?.[0] || '',
      type: isWebinar ? 'webinar' : 'event',
      url: `https://truv.com${href}`,
    });
  }

  // Deduplicate by URL, keep only webinars with future dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    if (e.type !== 'webinar') return false;
    if (!e.date) return false;
    // Parse first date from string like "March 10, 2026"
    const parsed = new Date(e.date.replace(/(\d+)\s*[-–]\s*\d+/, '$1'));
    return !isNaN(parsed.getTime()) && parsed >= today;
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {  // Cache for 1 hour
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const events = await scrapeEvents();
    return res.status(200).json({ events });
  } catch (err) {
    console.error('Truv events scrape error:', err);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
}
