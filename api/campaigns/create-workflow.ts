import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

function corsHeaders(res: VercelResponse): void {}

const KNOCK_MGMT_TOKEN = 'knock_st_aBOcA5Q7jS9GprJkW-Iqhq5vl1vYr_Kz6ugFQiyvQI8G4g3w59cDLm0-8tuoVhJV';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { campaignId, senderEmail, senderName, asmGroupId } = req.body;
    if (!campaignId) return res.status(400).json({ error: 'Missing campaignId' });

    const redis = getRedis();
    const raw = await redis.get(`campaign:${campaignId}`);
    if (!raw) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const templateId = campaign.template?.sendgridTemplateId;
    if (!templateId) return res.status(400).json({ error: 'No SendGrid template set — add a template first' });

    const workflowKey = campaignId;
    const sender = senderEmail || 'insights@email.truv.com';
    const senderDisplay = senderName || 'Truv';
    const asm = asmGroupId || 29127;

    // Build the SendGrid body — properly formatted JSON string
    const sendgridBody = JSON.stringify({
      personalizations: [{
        to: [{ email: '{{ recipient.email }}' }],
        dynamic_template_data: {
          firstName: "{% if recipient.firstname %}{{ recipient.firstname }}{% elsif recipient.name %}{{ recipient.name | split: ' ' | first }}{% endif %}",
        },
      }],
      from: { email: sender, name: senderDisplay },
      template_id: templateId,
      categories: ['Marketing', '{{ workflow.key }}'],
      asm: { group_id: asm },
    });

    // Create workflow via Knock Management API
    const knockRes = await fetch(
      `https://control.knock.app/v1/workflows/${workflowKey}?environment=development&commit=true`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${KNOCK_MGMT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow: {
            name: campaign.name,
            categories: ['Marketing'],
            steps: [{
              channel_key: 'sendgrid-customer-success',
              ref: 'http_1',
              type: 'channel',
              template: {
                method: 'post',
                url: 'https://api.sendgrid.com/v3/mail/send',
                headers: [
                  { key: 'Authorization', value: 'Bearer {{ vars.sendgrid_api_key }}' },
                  { key: 'Content-Type', value: 'application/json' },
                ],
                body: sendgridBody,
              },
            }],
          },
        }),
      }
    );

    if (!knockRes.ok) {
      const errText = await knockRes.text();
      throw new Error(`Knock API error: ${knockRes.status} - ${errText}`);
    }

    const knockData = await knockRes.json();
    const valid = knockData.workflow?.valid;

    // Update campaign
    campaign.workflow = { ...campaign.workflow, knockWorkflowKey: workflowKey };
    campaign.status = campaign.audience?.knockAudienceKey ? 'ready' : campaign.status;
    const wfStage = (campaign.pipeline || []).find((s: { stage: string }) => s.stage === 'workflow');
    if (wfStage) {
      wfStage.status = 'success';
      wfStage.result = { workflowKey, senderEmail: sender, senderName: senderDisplay, asmGroupId: asm };
      wfStage.completedAt = new Date().toISOString();
    }
    await redis.set(`campaign:${campaignId}`, JSON.stringify(campaign));

    return res.status(200).json({ workflowKey, valid });
  } catch (error) {
    console.error('Create workflow error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
