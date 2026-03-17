import type {
  Campaign,
  CampaignListItem,
  Send,
  BuildingBlock,
  BlockType,
} from '../types/campaign';

const BASE = '/api/campaigns';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json();
}

// ---- Campaigns ----

export async function listCampaigns(status?: string): Promise<CampaignListItem[]> {
  const params = status ? `?status=${status}` : '';
  return json(await fetch(`${BASE}${params}`));
}

export async function getCampaign(id: string): Promise<Campaign> {
  return json(await fetch(`${BASE}/${id}`));
}

export async function createCampaign(data: Partial<Campaign>): Promise<Campaign> {
  return json(await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }));
}

export async function updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign> {
  return json(await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }));
}

export async function deleteCampaign(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ---- Sends ----

export async function listSends(campaignId: string): Promise<Send[]> {
  return json(await fetch(`${BASE}/${campaignId}/sends`));
}

export async function createSend(campaignId: string, data: Partial<Send>): Promise<Send> {
  return json(await fetch(`${BASE}/${campaignId}/sends`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }));
}

export async function updateSend(campaignId: string, sendId: string, data: Partial<Send>): Promise<Send> {
  return json(await fetch(`${BASE}/${campaignId}/sends/${sendId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }));
}

export async function cancelSend(campaignId: string, sendId: string): Promise<Send> {
  return updateSend(campaignId, sendId, { status: 'cancelled' });
}

// ---- Building Blocks ----

export async function listBlocks(type?: BlockType): Promise<BuildingBlock[]> {
  const params = type ? `?type=${type}` : '';
  return json(await fetch(`${BASE}/blocks${params}`));
}

export async function createBlock(data: Omit<BuildingBlock, 'lastUsed' | 'usedCount' | 'createdAt'>): Promise<BuildingBlock> {
  return json(await fetch(`${BASE}/blocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }));
}

export async function deleteBlock(id: string): Promise<void> {
  const res = await fetch(`${BASE}/blocks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ---- Campaign Health ----

export interface CampaignHealth {
  pipelineErrors: Array<{ stage: string; error: string; timestamp: string }>;
  deliveryErrors: Array<{ email: string; type: string; reason: string; timestamp: number }>;
}

export async function getCampaignHealth(id: string): Promise<CampaignHealth> {
  return json(await fetch(`${BASE}/${id}/health`));
}

// ---- Analytics ----

export interface CampaignAnalytics {
  sends: Array<{
    sendId: string;
    name: string;
    sentAt: string;
    recipients: number;
    delivered: number;
    opens: number;
    clicks: number;
    bounces: number;
    openRate: number;
    clickRate: number;
  }>;
  totals: {
    recipients: number;
    delivered: number;
    opens: number;
    clicks: number;
    bounces: number;
    openRate: number;
    clickRate: number;
  };
}

export async function getCampaignAnalytics(id: string): Promise<CampaignAnalytics> {
  return json(await fetch(`${BASE}/${id}/analytics`));
}
