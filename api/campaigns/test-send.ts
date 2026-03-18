import type { VercelRequest, VercelResponse } from '@vercel/node';

function corsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const KNOCK_API_URL = 'https://api.knock.app/v1';
const KNOCK_SERVICE_TOKEN = process.env.KNOCK_SERVICE_TOKEN;

// Cameron's test recipients
const DEFAULT_TEST_RECIPIENTS: Array<{ email: string; firstname?: string; lastname?: string }> = [
  { email: 'cameron.wolf@truv.com', firstname: 'Cameron', lastname: 'Wolf' },
  { email: 'cameron.wolf.8@gmail.com', firstname: 'Cam' },
  { email: 'camerowo@umich.edu' },
  { email: 'camerowo@outlook.com' },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!KNOCK_SERVICE_TOKEN) throw new Error('KNOCK_SERVICE_TOKEN not configured');

    const { workflowKey, emails, extraEmails } = req.body;
    if (!workflowKey) return res.status(400).json({ error: 'Missing workflowKey' });

    let testRecipients = emails && emails.length > 0
      ? emails.map((e: string) => ({ email: e }))
      : [...DEFAULT_TEST_RECIPIENTS];

    // Append any custom emails
    if (extraEmails && Array.isArray(extraEmails)) {
      for (const e of extraEmails) {
        if (e && !testRecipients.some((r: { email: string }) => r.email === e)) {
          testRecipients.push({ email: e });
        }
      }
    }

    // Identify test users in Knock with real name data
    for (const r of testRecipients) {
      const userData: Record<string, string | null> = { email: r.email };
      if (r.firstname) {
        userData.firstname = r.firstname;
        userData.name = r.lastname ? `${r.firstname} ${r.lastname}` : r.firstname;
      } else {
        userData.firstname = null;
        userData.name = null;
      }
      userData.lastname = r.lastname || null;

      await fetch(`${KNOCK_API_URL}/users/${r.email}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${KNOCK_SERVICE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
    }

    const testEmails = testRecipients.map((r: { email: string }) => r.email);

    // Trigger workflow for test recipients
    const triggerRes = await fetch(`${KNOCK_API_URL}/workflows/${workflowKey}/trigger`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KNOCK_SERVICE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipients: testEmails }),
    });

    if (!triggerRes.ok) {
      const errText = await triggerRes.text();
      throw new Error(`Knock trigger failed: ${errText}`);
    }

    const data = await triggerRes.json();

    return res.status(200).json({
      success: true,
      workflowRunId: data.workflow_run_id,
      recipients: testEmails,
      count: testEmails.length,
    });
  } catch (error) {
    console.error('Test send error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
