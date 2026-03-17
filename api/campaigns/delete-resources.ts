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

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const KNOCK_SERVICE_TOKEN = process.env.KNOCK_SERVICE_TOKEN;
const KNOCK_MGMT_TOKEN = 'knock_st_aBOcA5Q7jS9GprJkW-Iqhq5vl1vYr_Kz6ugFQiyvQI8G4g3w59cDLm0-8tuoVhJV';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { campaignId, deleteCampaign, deleteTemplate, deleteWorkflow, deleteAudience, deleteHubspotList } = req.body;
    if (!campaignId) return res.status(400).json({ error: 'Missing campaignId' });

    const redis = getRedis();
    const raw = await redis.get(`campaign:${campaignId}`);
    if (!raw) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const results: Array<{ resource: string; status: string; error?: string }> = [];

    // Delete SendGrid template
    if (deleteTemplate && campaign.template?.sendgridTemplateId) {
      try {
        const sgRes = await fetch(
          `https://api.sendgrid.com/v3/templates/${campaign.template.sendgridTemplateId}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` } }
        );
        if (sgRes.ok || sgRes.status === 204) {
          results.push({ resource: 'sendgrid-template', status: 'deleted' });
          campaign.template = { sendgridTemplateId: '', name: '' };
          const tplStage = (campaign.pipeline || []).find((s: { stage: string }) => s.stage === 'template');
          if (tplStage) { tplStage.status = 'idle'; tplStage.result = undefined; }
        } else {
          results.push({ resource: 'sendgrid-template', status: 'error', error: `SendGrid ${sgRes.status}` });
        }
      } catch (err) {
        results.push({ resource: 'sendgrid-template', status: 'error', error: err instanceof Error ? err.message : 'Unknown' });
      }
    }

    // Delete Knock workflow
    if (deleteWorkflow && campaign.workflow?.knockWorkflowKey) {
      try {
        const knockRes = await fetch(
          `https://control.knock.app/v1/workflows/${campaign.workflow.knockWorkflowKey}?environment=development`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${KNOCK_MGMT_TOKEN}` } }
        );
        if (knockRes.ok || knockRes.status === 204 || knockRes.status === 404) {
          results.push({ resource: 'knock-workflow', status: 'deleted' });
          campaign.workflow = {};
          campaign.preset = null;
          const wfStage = (campaign.pipeline || []).find((s: { stage: string }) => s.stage === 'workflow');
          if (wfStage) { wfStage.status = 'idle'; wfStage.result = undefined; }
        } else {
          results.push({ resource: 'knock-workflow', status: 'error', error: `Knock ${knockRes.status}` });
        }
      } catch (err) {
        results.push({ resource: 'knock-workflow', status: 'error', error: err instanceof Error ? err.message : 'Unknown' });
      }
    }

    // Delete Knock audience
    if (deleteAudience && campaign.audience?.knockAudienceKey) {
      try {
        // Knock doesn't have a delete audience endpoint — remove all members instead
        const listRes = await fetch(
          `https://api.knock.app/v1/audiences/${campaign.audience.knockAudienceKey}/members?limit=50`,
          { headers: { Authorization: `Bearer ${KNOCK_SERVICE_TOKEN}` } }
        );
        if (listRes.ok) {
          const listData = await listRes.json();
          const memberIds = (listData.entries || []).map((e: { user?: { id: string }; user_id?: string }) => e.user?.id || e.user_id).filter(Boolean);
          if (memberIds.length > 0) {
            await fetch(`https://api.knock.app/v1/audiences/${campaign.audience.knockAudienceKey}/members`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${KNOCK_SERVICE_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ member_ids: memberIds }),
            });
          }
        }
        results.push({ resource: 'knock-audience', status: 'deleted' });
        campaign.audience = { ...campaign.audience, knockAudienceKey: undefined };
        const kaStage = (campaign.pipeline || []).find((s: { stage: string }) => s.stage === 'knock_audience');
        if (kaStage) { kaStage.status = 'idle'; kaStage.result = undefined; }
      } catch (err) {
        results.push({ resource: 'knock-audience', status: 'error', error: err instanceof Error ? err.message : 'Unknown' });
      }
    }

    // Delete HubSpot list
    if (deleteHubspotList && campaign.audience?.hubspotListId) {
      try {
        const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
        const hsRes = await fetch(
          `https://api.hubapi.com/contacts/v1/lists/${campaign.audience.hubspotListId}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${HUBSPOT_API_TOKEN}` } }
        );
        if (hsRes.ok || hsRes.status === 204) {
          results.push({ resource: 'hubspot-list', status: 'deleted' });
          campaign.audience = { ...campaign.audience, hubspotListId: '', count: 0 };
          const listStage = (campaign.pipeline || []).find((s: { stage: string }) => s.stage === 'list');
          if (listStage) { listStage.status = 'idle'; listStage.result = undefined; }
          const audStage = (campaign.pipeline || []).find((s: { stage: string }) => s.stage === 'audience');
          if (audStage) { audStage.status = 'idle'; audStage.result = undefined; }
        } else {
          results.push({ resource: 'hubspot-list', status: 'error', error: `HubSpot ${hsRes.status}` });
        }
      } catch (err) {
        results.push({ resource: 'hubspot-list', status: 'error', error: err instanceof Error ? err.message : 'Unknown' });
      }
    }

    // Delete the campaign record itself
    if (deleteCampaign) {
      await redis.del(`campaign:${campaignId}`);
      await redis.zrem('campaigns:index', campaignId);
      results.push({ resource: 'campaign', status: 'deleted' });
      return res.status(200).json({ results, campaignDeleted: true });
    }

    // If not deleting campaign, update it with cleared resources
    campaign.status = 'draft';
    campaign.sends = [];
    await redis.set(`campaign:${campaignId}`, JSON.stringify(campaign));
    results.push({ resource: 'campaign', status: 'updated' });

    return res.status(200).json({ results, campaignDeleted: false });
  } catch (error) {
    console.error('Delete resources error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
