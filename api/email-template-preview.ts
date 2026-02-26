import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'SENDGRID_API_KEY not configured' });
  }

  const templateId = req.query.template_id as string;
  if (!templateId) {
    return res.status(400).json({ error: 'template_id query parameter required' });
  }

  try {
    const sgRes = await fetch(`https://api.sendgrid.com/v3/templates/${templateId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!sgRes.ok) {
      return res.status(sgRes.status).json({ error: `SendGrid API ${sgRes.status}` });
    }

    const data = await sgRes.json();
    const version = data.versions?.[0];

    return res.status(200).json({
      name: data.name || '',
      subject: version?.subject || '',
      html_content: version?.html_content || '',
    });
  } catch (err) {
    console.error('Template preview error:', err);
    return res.status(500).json({ error: 'Failed to fetch template' });
  }
}
