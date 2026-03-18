import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

function corsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const KNOCK_API_URL = 'https://api.knock.app/v1';
const KNOCK_SERVICE_TOKEN = process.env.KNOCK_SERVICE_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { campaignId } = req.body;
    if (!campaignId) return res.status(400).json({ error: 'Missing campaignId' });
    if (!HUBSPOT_API_TOKEN) throw new Error('HubSpot API token not configured');
    if (!KNOCK_SERVICE_TOKEN) throw new Error('KNOCK_SERVICE_TOKEN not configured');

    const redis = getRedis();
    const raw = await redis.get(`campaign:${campaignId}`);
    if (!raw) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const listId = campaign.audience?.hubspotListId;
    if (!listId) return res.status(400).json({ error: 'No HubSpot list set on this campaign' });

    const audienceKey = campaign.audience?.knockAudienceKey || campaignId;

    // Fetch contacts from HubSpot list
    const contacts: Array<{ email: string; firstname: string | null; lastname: string | null; name: string | null; company: string | null; title: string | null; hubspot_contact_id: string }> = [];
    let vidOffset = 0;
    let hasMore = true;

    while (hasMore && contacts.length < 10000) {
      const hsRes = await fetch(
        `https://api.hubapi.com/contacts/v1/lists/${listId}/contacts/all?count=100&vidOffset=${vidOffset}&property=firstname&property=lastname&property=email&property=jobtitle&property=company`,
        { headers: { Authorization: `Bearer ${HUBSPOT_API_TOKEN}` } }
      );

      if (!hsRes.ok) {
        const errText = await hsRes.text();
        throw new Error(`HubSpot API error: ${hsRes.status} - ${errText}`);
      }

      const data = await hsRes.json();
      for (const c of data.contacts || []) {
        const props = c.properties || {};
        const email = props.email?.value;
        if (!email) continue;
        const first = props.firstname?.value || '';
        const last = props.lastname?.value || '';
        contacts.push({
          email,
          firstname: first || null,
          lastname: last || null,
          name: `${first} ${last}`.trim() || null,
          company: props.company?.value || null,
          title: props.jobtitle?.value || null,
          hubspot_contact_id: String(c.vid || ''),
        });
      }

      hasMore = data['has-more'] === true;
      vidOffset = data['vid-offset'] || 0;
      await new Promise((r) => setTimeout(r, 100)); // rate limit
    }

    if (contacts.length === 0) throw new Error('No contacts found in HubSpot list');

    // Push to Knock audience in batches of 100
    for (let i = 0; i < contacts.length; i += 100) {
      const batch = contacts.slice(i, i + 100);
      const members = batch.map((c) => ({
        user: {
          id: c.email,
          email: c.email,
          name: c.name,
          firstname: c.firstname,
          lastname: c.lastname,
          company: c.company,
          title: c.title,
          hubspot_contact_id: c.hubspot_contact_id,
        },
      }));

      const knockRes = await fetch(`${KNOCK_API_URL}/audiences/${audienceKey}/members`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KNOCK_SERVICE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ members }),
      });

      if (!knockRes.ok) {
        const errText = await knockRes.text();
        throw new Error(`Knock API error: ${knockRes.status} - ${errText}`);
      }

      await new Promise((r) => setTimeout(r, 300)); // rate limit
    }

    // Update campaign with audience key
    campaign.audience = { ...campaign.audience, knockAudienceKey: audienceKey, count: contacts.length };
    // Update pipeline
    const knockStage = (campaign.pipeline || []).find((s: { stage: string }) => s.stage === 'knock_audience');
    if (knockStage) {
      knockStage.status = 'success';
      knockStage.result = { audienceKey, memberCount: contacts.length };
      knockStage.completedAt = new Date().toISOString();
    }
    await redis.set(`campaign:${campaignId}`, JSON.stringify(campaign));

    return res.status(200).json({
      audienceKey,
      memberCount: contacts.length,
    });
  } catch (error) {
    console.error('Sync audience error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
