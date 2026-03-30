import type { VercelRequest, VercelResponse } from '@vercel/node';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

function corsHeaders(res: VercelResponse): void {}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!SENDGRID_API_KEY) throw new Error('SendGrid API key not configured');

    const query = (req.query.q as string || '').toLowerCase();

    // Fetch dynamic templates (generation=dynamic)
    const sgRes = await fetch(
      'https://api.sendgrid.com/v3/templates?generations=dynamic&page_size=200',
      { headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` } }
    );

    if (!sgRes.ok) {
      const errText = await sgRes.text();
      throw new Error(`SendGrid API error: ${sgRes.status} - ${errText}`);
    }

    const data = await sgRes.json();

    let templates = (data.templates || data.result || []).map((t: {
      id: string;
      name: string;
      updated_at: string;
      versions?: Array<{ subject: string; active: number; updated_at: string }>;
    }) => {
      const activeVersion = (t.versions || []).find((v) => v.active === 1);
      return {
        id: t.id,
        name: t.name,
        subject: activeVersion?.subject || null,
        updatedAt: activeVersion?.updated_at || t.updated_at,
      };
    });

    // Filter by query
    if (query) {
      templates = templates.filter((t: { name: string; id: string; subject: string | null }) =>
        t.name.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query) ||
        (t.subject && t.subject.toLowerCase().includes(query))
      );
    }

    // Sort by most recently updated
    templates.sort((a: { updatedAt: string }, b: { updatedAt: string }) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || '')
    );

    return res.status(200).json({ templates });
  } catch (error) {
    console.error('SendGrid templates error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
