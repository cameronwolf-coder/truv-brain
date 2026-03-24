import type { VercelRequest, VercelResponse } from '@vercel/node';

const SCOUT_API_URL = process.env.SCOUT_API_URL || 'https://8svutjrjpz.us-east-1.awsapprunner.com';
const SCOUT_WEBHOOK_SECRET = process.env.SCOUT_WEBHOOK_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = ['https://truv-brain.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173'];
  const origin = req.headers.origin || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contactId, email } = req.body || {};
  if (!contactId && !email) {
    return res.status(400).json({ error: 'contactId or email required' });
  }

  try {
    const scoutRes = await fetch(`${SCOUT_API_URL}/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SCOUT_WEBHOOK_SECRET ? { 'x-scout-token': SCOUT_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify({ contact_id: contactId, email }),
    });

    const data = await scoutRes.json();
    if (!scoutRes.ok) {
      return res.status(scoutRes.status).json({ error: data.detail || 'Scout API error' });
    }
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Rescore error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
