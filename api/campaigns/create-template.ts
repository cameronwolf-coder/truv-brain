import type { VercelRequest, VercelResponse } from '@vercel/node';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

function corsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!SENDGRID_API_KEY) throw new Error('SendGrid API key not configured');

    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Template name is required' });

    // Create dynamic template
    const createRes = await fetch('https://api.sendgrid.com/v3/templates', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, generation: 'dynamic' }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`SendGrid error: ${createRes.status} - ${errText}`);
    }

    const template = await createRes.json();

    return res.status(201).json({
      templateId: template.id,
      name: template.name,
      editUrl: `https://mc.sendgrid.com/dynamic-templates/${template.id}`,
    });
  } catch (error) {
    console.error('Create template error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
