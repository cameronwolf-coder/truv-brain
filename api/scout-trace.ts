import type { VercelRequest, VercelResponse } from '@vercel/node';

const SCOUT_API_URL = process.env.SCOUT_API_URL || (process.env.NODE_ENV === 'production' ? 'http://localhost:8001' : 'https://brdytqha8f.us-east-1.awsapprunner.com/scout');
const SCOUT_WEBHOOK_SECRET = process.env.SCOUT_WEBHOOK_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = ['https://brdytqha8f.us-east-1.awsapprunner.com', 'https://truv-brain.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173'];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const contactId = req.query.contactId as string;
  if (!contactId) return res.status(400).json({ error: 'contactId query parameter required' });
  if (!/^\d+$/.test(contactId)) return res.status(400).json({ error: 'Invalid contactId' });

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (SCOUT_WEBHOOK_SECRET) headers['X-Scout-Token'] = SCOUT_WEBHOOK_SECRET;

    const resp = await fetch(`${SCOUT_API_URL}/trace/${contactId}`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (resp.status === 404) return res.status(404).json({ error: 'No trace found' });
    if (!resp.ok) return res.status(resp.status).json({ error: 'Scout API error' });

    const data = await resp.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch trace from Scout API' });
  }
}
