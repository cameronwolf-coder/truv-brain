import type { VercelRequest, VercelResponse } from '@vercel/node';

const BOT_URL = process.env.LOS_POS_BOT_URL || 'https://em8y3yp3qk.us-east-1.awsapprunner.com';
const BOT_TOKEN = process.env.LOS_POS_BOT_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!BOT_TOKEN) return res.status(500).json({ error: 'Bot token not configured' });

  const limit = Math.min(req.body?.limit || 100, 500);

  try {
    const resp = await fetch(`${BOT_URL}/run-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Scout-Token': BOT_TOKEN },
      body: JSON.stringify({ limit }),
    });
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message });
  }
}
