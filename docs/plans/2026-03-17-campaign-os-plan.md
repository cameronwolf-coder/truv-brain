# Campaign OS Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full Campaign OS inside truv-brain with a 5-stage visual campaign builder, multi-send scheduling via Vercel cron, reusable building blocks library, per-campaign analytics, and pipeline + delivery error reporting.

**Architecture:** New lazy-loaded page at `/campaigns` with nested React Router sub-routes (dashboard, wizard, detail, library). API routes in `api/campaigns/` store campaign state in Upstash Redis (already configured). knock-wrapper.vercel.app remains the send execution layer, called via thin proxy routes.

**Tech Stack:** React 19, React Router 7, Tailwind CSS 3.4, Framer Motion 12, Upstash Redis, Vercel Serverless Functions, Recharts (for analytics), Zustand (for wizard state)

**Design doc:** `docs/plans/2026-03-17-campaign-os-design.md`

---

## Task 1: Types & Service Client

**Files:**
- Create: `src/types/campaign.ts`
- Create: `src/services/campaignClient.ts`

**Step 1: Create the type definitions**

```ts
// src/types/campaign.ts

export type CampaignStatus = 'draft' | 'building' | 'ready' | 'sending' | 'sent' | 'error';
export type CampaignChannel = 'marketing' | 'outreach';
export type StageStatus = 'idle' | 'executing' | 'success' | 'error';
export type SendStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'error' | 'cancelled';
export type StageName = 'audience' | 'list' | 'knock_audience' | 'template' | 'workflow';
export type AudienceFilterType = 'all' | 'non_openers' | 'non_clickers' | 'custom';
export type BlockType = 'audience' | 'template' | 'workflow';

export interface PipelineStage {
  stage: StageName;
  status: StageStatus;
  result?: Record<string, unknown>;
  error?: string;
  completedAt?: string;
}

export interface SendAudienceFilter {
  type: AudienceFilterType;
  relativeTo?: string;
}

export interface Send {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  scheduledAt: string;
  status: SendStatus;
  audienceFilter: SendAudienceFilter;
  recipientCount?: number;
  workflowKey?: string;
  presetKey?: string;
  error?: string;
  sentAt?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  channel: CampaignChannel;
  audience: {
    hubspotListId: string;
    knockAudienceKey?: string;
    count: number;
    filterConfig?: AudienceConfig;
  };
  template: {
    sendgridTemplateId: string;
    name: string;
    templateVars?: Record<string, string>;
  };
  workflow: {
    knockWorkflowKey?: string;
    smartleadCampaignId?: string;
  };
  preset: {
    key: string;
    batchSize: number;
    delayMinutes: number;
  } | null;
  pipeline: PipelineStage[];
  sends: Send[];
  createdAt: string;
  sentAt?: string;
}

export interface AudienceConfig {
  filters: HubSpotFilter[];
  excludeLifecycleStages?: string[];
  excludeIndustries?: string[];
  engagementMinimum?: { opens?: number; clicks?: number };
}

export interface HubSpotFilter {
  property: string;
  operator: string;
  value: string | number | string[];
}

export interface TemplateConfig {
  sendgridTemplateId: string;
  subject: string;
  templateVars?: Record<string, string>;
  heroStyle?: 'light' | 'dark';
}

export interface WorkflowConfig {
  knockWorkflowKey: string;
  senderEmail: string;
  senderName: string;
  asmGroupId: number;
  channel: CampaignChannel;
}

export interface BuildingBlock {
  id: string;
  type: BlockType;
  name: string;
  config: AudienceConfig | TemplateConfig | WorkflowConfig;
  lastUsed: string | null;
  usedCount: number;
  createdAt: string;
}

export interface CampaignListItem {
  id: string;
  name: string;
  status: CampaignStatus;
  channel: CampaignChannel;
  audienceCount: number;
  sendCount: number;
  createdAt: string;
  sentAt?: string;
  nextSendAt?: string;
}
```

**Step 2: Create the API service client**

```ts
// src/services/campaignClient.ts

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
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/types/campaign.ts src/services/campaignClient.ts`
Expected: No errors

**Step 4: Commit**

```bash
git add src/types/campaign.ts src/services/campaignClient.ts
git commit -m "feat(campaign-os): add types and API service client"
```

---

## Task 2: Campaign CRUD API Routes

**Files:**
- Create: `api/campaigns/index.ts`
- Create: `api/campaigns/[id].ts`
- Create: `api/campaigns/helpers.ts`

**Step 1: Create Redis helpers**

```ts
// api/campaigns/helpers.ts

import { Redis } from '@upstash/redis';

export function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis not configured');
  return new Redis({ url, token });
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function corsHeaders(res: import('@vercel/node').VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
```

**Step 2: Create campaigns list/create endpoint**

```ts
// api/campaigns/index.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis, slugify, corsHeaders } from './helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const redis = getRedis();

  if (req.method === 'GET') {
    const { status } = req.query;
    const ids: string[] = await redis.zrange('campaigns:index', 0, -1, { rev: true }) || [];
    const campaigns = [];

    for (const id of ids) {
      const raw = await redis.get(`campaign:${id}`);
      if (!raw) continue;
      const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (status && campaign.status !== status) continue;
      campaigns.push({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        channel: campaign.channel,
        audienceCount: campaign.audience?.count || 0,
        sendCount: campaign.sends?.length || 0,
        createdAt: campaign.createdAt,
        sentAt: campaign.sentAt,
        nextSendAt: (campaign.sends || [])
          .filter((s: { status: string }) => s.status === 'scheduled')
          .sort((a: { scheduledAt: string }, b: { scheduledAt: string }) => a.scheduledAt.localeCompare(b.scheduledAt))[0]?.scheduledAt || null,
      });
    }

    return res.status(200).json(campaigns);
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const id = slugify(body.name || `campaign-${Date.now()}`);
    const now = new Date().toISOString();

    const campaign = {
      id,
      name: body.name || 'Untitled Campaign',
      status: 'draft',
      channel: body.channel || 'marketing',
      audience: body.audience || { hubspotListId: '', count: 0 },
      template: body.template || { sendgridTemplateId: '', name: '' },
      workflow: body.workflow || {},
      preset: body.preset || null,
      pipeline: [
        { stage: 'audience', status: 'idle' },
        { stage: 'list', status: 'idle' },
        { stage: 'knock_audience', status: 'idle' },
        { stage: 'template', status: 'idle' },
        { stage: 'workflow', status: 'idle' },
      ],
      sends: [],
      createdAt: now,
    };

    await redis.set(`campaign:${id}`, JSON.stringify(campaign));
    await redis.zadd('campaigns:index', { score: Date.now(), member: id });

    return res.status(201).json(campaign);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
```

**Step 3: Create single campaign endpoint**

```ts
// api/campaigns/[id].ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis, corsHeaders } from './helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing campaign id' });

  const redis = getRedis();

  if (req.method === 'GET') {
    const raw = await redis.get(`campaign:${id}`);
    if (!raw) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return res.status(200).json(campaign);
  }

  if (req.method === 'PUT') {
    const raw = await redis.get(`campaign:${id}`);
    if (!raw) return res.status(404).json({ error: 'Campaign not found' });
    const existing = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const updated = { ...existing, ...req.body, id }; // id is immutable
    await redis.set(`campaign:${id}`, JSON.stringify(updated));
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    await redis.del(`campaign:${id}`);
    await redis.zrem('campaigns:index', id);
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
```

**Step 4: Test with curl**

Run: `vercel dev` (in a separate terminal)

```bash
# Create
curl -s -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Campaign", "channel": "marketing"}' | python3 -m json.tool

# List
curl -s http://localhost:3000/api/campaigns | python3 -m json.tool

# Get
curl -s http://localhost:3000/api/campaigns/test-campaign | python3 -m json.tool

# Delete
curl -s -X DELETE http://localhost:3000/api/campaigns/test-campaign
```

Expected: 201 on create, 200 on list/get, 204 on delete

**Step 5: Commit**

```bash
git add api/campaigns/helpers.ts api/campaigns/index.ts api/campaigns/[id].ts
git commit -m "feat(campaign-os): add campaign CRUD API routes with Redis storage"
```

---

## Task 3: Sends & Blocks API Routes

**Files:**
- Create: `api/campaigns/[id]/sends.ts`
- Create: `api/campaigns/[id]/sends/[sid].ts`
- Create: `api/campaigns/blocks.ts`

**Step 1: Create sends list/create endpoint**

```ts
// api/campaigns/[id]/sends.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis, slugify, corsHeaders } from '../helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing campaign id' });

  const redis = getRedis();
  const raw = await redis.get(`campaign:${id}`);
  if (!raw) return res.status(404).json({ error: 'Campaign not found' });
  const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (req.method === 'GET') {
    return res.status(200).json(campaign.sends || []);
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const sendId = slugify(body.name || `send-${Date.now()}`);

    const send = {
      id: sendId,
      name: body.name || 'Untitled Send',
      templateId: body.templateId || '',
      templateName: body.templateName || '',
      scheduledAt: body.scheduledAt || '',
      status: body.scheduledAt ? 'scheduled' : 'draft',
      audienceFilter: body.audienceFilter || { type: 'all' },
      recipientCount: body.recipientCount || campaign.audience?.count || 0,
      workflowKey: body.workflowKey || campaign.workflow?.knockWorkflowKey || '',
      presetKey: body.presetKey || campaign.preset?.key || '',
    };

    campaign.sends = [...(campaign.sends || []), send];
    await redis.set(`campaign:${id}`, JSON.stringify(campaign));

    return res.status(201).json(send);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
```

**Step 2: Create single send endpoint (update/cancel)**

```ts
// api/campaigns/[id]/sends/[sid].ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis, corsHeaders } from '../../helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, sid } = req.query;
  if (!id || typeof id !== 'string' || !sid || typeof sid !== 'string') {
    return res.status(400).json({ error: 'Missing campaign or send id' });
  }

  const redis = getRedis();
  const raw = await redis.get(`campaign:${id}`);
  if (!raw) return res.status(404).json({ error: 'Campaign not found' });
  const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;

  const sendIndex = (campaign.sends || []).findIndex((s: { id: string }) => s.id === sid);
  if (sendIndex === -1) return res.status(404).json({ error: 'Send not found' });

  if (req.method === 'PUT') {
    campaign.sends[sendIndex] = { ...campaign.sends[sendIndex], ...req.body, id: sid };
    await redis.set(`campaign:${id}`, JSON.stringify(campaign));
    return res.status(200).json(campaign.sends[sendIndex]);
  }

  if (req.method === 'DELETE') {
    campaign.sends.splice(sendIndex, 1);
    await redis.set(`campaign:${id}`, JSON.stringify(campaign));
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
```

**Step 3: Create building blocks endpoint**

```ts
// api/campaigns/blocks.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis, slugify, corsHeaders } from './helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const redis = getRedis();

  if (req.method === 'GET') {
    const { type } = req.query;
    const types = type ? [type as string] : ['audience', 'template', 'workflow'];
    const blocks = [];

    for (const t of types) {
      const ids: string[] = await redis.smembers(`blocks:${t}:index`) || [];
      for (const id of ids) {
        const raw = await redis.get(`block:${t}:${id}`);
        if (raw) {
          blocks.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
        }
      }
    }

    blocks.sort((a, b) => (b.lastUsed || b.createdAt).localeCompare(a.lastUsed || a.createdAt));
    return res.status(200).json(blocks);
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const id = body.id || slugify(body.name || `block-${Date.now()}`);
    const now = new Date().toISOString();

    const block = {
      id,
      type: body.type,
      name: body.name,
      config: body.config,
      lastUsed: null,
      usedCount: 0,
      createdAt: now,
    };

    await redis.set(`block:${body.type}:${id}`, JSON.stringify(block));
    await redis.sadd(`blocks:${body.type}:index`, id);

    return res.status(201).json(block);
  }

  if (req.method === 'DELETE') {
    const { id: blockId, type } = req.query;
    if (!blockId || !type) return res.status(400).json({ error: 'Missing id and type params' });

    await redis.del(`block:${type}:${blockId}`);
    await redis.srem(`blocks:${type}:index`, blockId as string);
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
```

**Step 4: Verify with curl**

```bash
# Create a block
curl -s -X POST http://localhost:3000/api/campaigns/blocks \
  -H "Content-Type: application/json" \
  -d '{"type": "template", "name": "Dark Hero Template", "config": {"sendgridTemplateId": "d-abc123", "subject": "Test"}}' | python3 -m json.tool

# List blocks
curl -s http://localhost:3000/api/campaigns/blocks?type=template | python3 -m json.tool
```

**Step 5: Commit**

```bash
git add api/campaigns/[id]/sends.ts api/campaigns/[id]/sends/[sid].ts api/campaigns/blocks.ts
git commit -m "feat(campaign-os): add sends and building blocks API routes"
```

---

## Task 4: Cron & Health API Routes

**Files:**
- Create: `api/campaigns/cron.ts`
- Create: `api/campaigns/[id]/health.ts`
- Create: `api/campaigns/[id]/analytics.ts`
- Modify: `vercel.json`

**Step 1: Create the cron endpoint**

```ts
// api/campaigns/cron.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis, corsHeaders } from './helpers';

const KNOCK_WRAPPER_URL = process.env.KNOCK_WRAPPER_URL || 'https://knock-wrapper.vercel.app';
const SLACK_WEBHOOK_URL = process.env.CAMPAIGN_SLACK_WEBHOOK;

async function notifySlack(text: string): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;
  await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch(() => {});
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Vercel cron sends GET requests
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const redis = getRedis();
  const now = new Date().toISOString();
  const results: Array<{ campaignId: string; sendId: string; status: string; error?: string }> = [];

  // Scan all campaigns for due sends
  const campaignIds: string[] = await redis.zrange('campaigns:index', 0, -1) || [];

  for (const campaignId of campaignIds) {
    const raw = await redis.get(`campaign:${campaignId}`);
    if (!raw) continue;
    const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;

    let changed = false;
    for (const send of campaign.sends || []) {
      if (send.status !== 'scheduled') continue;
      if (send.scheduledAt > now) continue;

      // This send is due — fire it
      send.status = 'sending';
      changed = true;

      try {
        const triggerRes = await fetch(`${KNOCK_WRAPPER_URL}/api/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presetKey: send.presetKey }),
        });

        if (!triggerRes.ok) {
          const errText = await triggerRes.text();
          throw new Error(`knock-wrapper ${triggerRes.status}: ${errText}`);
        }

        send.status = 'sent';
        send.sentAt = now;
        results.push({ campaignId, sendId: send.id, status: 'sent' });
        await notifySlack(`Campaign "${campaign.name}" send "${send.name}" completed (${send.recipientCount} recipients)`);
      } catch (err) {
        send.status = 'error';
        send.error = err instanceof Error ? err.message : 'Unknown error';
        results.push({ campaignId, sendId: send.id, status: 'error', error: send.error });
        await notifySlack(`Campaign "${campaign.name}" send "${send.name}" FAILED: ${send.error}`);
      }
    }

    if (changed) {
      // Update overall campaign status
      const allSent = campaign.sends.every((s: { status: string }) => ['sent', 'cancelled'].includes(s.status));
      const anyError = campaign.sends.some((s: { status: string }) => s.status === 'error');
      if (allSent) campaign.status = 'sent';
      else if (anyError) campaign.status = 'error';
      else campaign.status = 'sending';

      await redis.set(`campaign:${campaignId}`, JSON.stringify(campaign));
    }
  }

  return res.status(200).json({ processed: results.length, results });
}
```

**Step 2: Create health endpoint**

```ts
// api/campaigns/[id]/health.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { corsHeaders } from '../helpers';

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing campaign id' });

  const redis = getRedis();
  const raw = await redis.get(`campaign:${id}`);
  if (!raw) return res.status(404).json({ error: 'Campaign not found' });
  const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;

  // Pipeline errors from campaign object
  const pipelineErrors = (campaign.pipeline || [])
    .filter((s: { status: string }) => s.status === 'error')
    .map((s: { stage: string; error: string; completedAt: string }) => ({
      stage: s.stage,
      error: s.error,
      timestamp: s.completedAt,
    }));

  // Send-level errors
  const sendErrors = (campaign.sends || [])
    .filter((s: { status: string }) => s.status === 'error')
    .map((s: { id: string; name: string; error: string }) => ({
      sendId: s.id,
      name: s.name,
      error: s.error,
    }));

  // Delivery errors from SendGrid webhook data (existing redis keys)
  const deliveryErrors: Array<{ email: string; type: string; reason: string; timestamp: number }> = [];

  for (const send of campaign.sends || []) {
    if (!send.workflowKey) continue;
    const bounces = await redis.smembers(`sg:${send.workflowKey}:bounced`) || [];
    for (const email of bounces.slice(0, 50)) {
      deliveryErrors.push({ email: email as string, type: 'bounce', reason: 'Hard bounce', timestamp: 0 });
    }
    const drops = await redis.smembers(`sg:${send.workflowKey}:dropped`) || [];
    for (const email of drops.slice(0, 50)) {
      deliveryErrors.push({ email: email as string, type: 'dropped', reason: 'Suppressed', timestamp: 0 });
    }
  }

  return res.status(200).json({ pipelineErrors, sendErrors, deliveryErrors });
}
```

**Step 3: Create analytics endpoint**

```ts
// api/campaigns/[id]/analytics.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { corsHeaders } from '../helpers';

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing campaign id' });

  const redis = getRedis();
  const raw = await redis.get(`campaign:${id}`);
  if (!raw) return res.status(404).json({ error: 'Campaign not found' });
  const campaign = typeof raw === 'string' ? JSON.parse(raw) : raw;

  const sends = [];
  const totals = { recipients: 0, delivered: 0, opens: 0, clicks: 0, bounces: 0, openRate: 0, clickRate: 0 };

  for (const send of campaign.sends || []) {
    if (send.status !== 'sent') continue;
    const key = send.workflowKey;
    if (!key) continue;

    // Read from existing SendGrid webhook aggregation keys
    const stats = await redis.hgetall(`sg:${key}:stats`) || {};
    const delivered = Number(stats.delivered || 0);
    const opens = Number(stats.unique_opens || 0);
    const clicks = Number(stats.unique_clicks || 0);
    const bounces = Number(stats.bounced || 0);
    const recipients = send.recipientCount || 0;

    const sendData = {
      sendId: send.id,
      name: send.name,
      sentAt: send.sentAt,
      recipients,
      delivered,
      opens,
      clicks,
      bounces,
      openRate: delivered > 0 ? opens / delivered : 0,
      clickRate: delivered > 0 ? clicks / delivered : 0,
    };
    sends.push(sendData);

    totals.recipients += recipients;
    totals.delivered += delivered;
    totals.opens += opens;
    totals.clicks += clicks;
    totals.bounces += bounces;
  }

  totals.openRate = totals.delivered > 0 ? totals.opens / totals.delivered : 0;
  totals.clickRate = totals.delivered > 0 ? totals.clicks / totals.delivered : 0;

  return res.status(200).json({ sends, totals });
}
```

**Step 4: Add cron to vercel.json**

Modify `vercel.json` — add crons config alongside existing rewrites:

```json
{
  "devCommand": "vite --port $PORT",
  "crons": [{
    "path": "/api/campaigns/cron",
    "schedule": "*/15 * * * *"
  }],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    },
    {
      "source": "/((?!api/).*)",
      "destination": "/index.html"
    }
  ]
}
```

**Step 5: Commit**

```bash
git add api/campaigns/cron.ts api/campaigns/[id]/health.ts api/campaigns/[id]/analytics.ts vercel.json
git commit -m "feat(campaign-os): add cron scheduler, health, and analytics API routes"
```

---

## Task 5: Route Shell & Navigation

**Files:**
- Create: `src/pages/CampaignOS.tsx`
- Modify: `src/main.tsx` (lines 13, 28, 59-60)
- Modify: `src/components/Layout.tsx` (lines 112-126)

**Step 1: Create the route shell page**

```tsx
// src/pages/CampaignOS.tsx

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// Sub-views will be added in later tasks — start with stubs
function DashboardTab() {
  return (
    <div className="text-center py-20 text-gray-400">
      Dashboard — coming in Task 8
    </div>
  );
}

function WizardTab() {
  return (
    <div className="text-center py-20 text-gray-400">
      Wizard — coming in Task 7
    </div>
  );
}

function LibraryTab() {
  return (
    <div className="text-center py-20 text-gray-400">
      Library — coming in Task 10
    </div>
  );
}

type Tab = 'dashboard' | 'new' | 'library';

export function CampaignOS() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as Tab) || 'dashboard';

  const setTab = (t: Tab) => {
    setSearchParams(t === 'dashboard' ? {} : { tab: t });
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'new', label: 'New Campaign' },
    { id: 'library', label: 'Library' },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Campaign OS</h1>
        <p className="text-gray-500 mt-1">
          Build, schedule, and monitor email campaigns
        </p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'new' && <WizardTab />}
      {tab === 'library' && <LibraryTab />}
    </div>
  );
}
```

**Step 2: Add route to main.tsx**

In `src/main.tsx`:

1. Add import at top (after line 13, the Campaigns import):
```ts
const CampaignOS = lazy(() => import('./pages/CampaignOS').then((m) => ({ default: m.CampaignOS })));
```

2. Replace the existing campaigns route (lines 59-60):
```tsx
      {
        path: 'campaigns',
        element: <Suspense fallback={<div className="p-8 text-gray-500">Loading...</div>}><CampaignOS /></Suspense>,
      },
```

3. Remove the static import `import { Campaigns } from './pages/Campaigns';` (line 13) since we're replacing it with the lazy-loaded CampaignOS.

**Step 3: Update sidebar nav label**

In `src/components/Layout.tsx`, change the sidebar link text (around line 123-125):

Replace:
```tsx
                <span className="text-lg">📧</span>
                Campaign Logic
```

With:
```tsx
                <span className="text-lg">🚀</span>
                Campaign OS
```

**Step 4: Verify the route loads**

Run: `npm run dev`
Navigate to: `http://localhost:5173/campaigns`
Expected: See "Campaign OS" header with three tabs (Dashboard, New Campaign, Library). Each tab shows a placeholder. URL updates with `?tab=new` etc.

**Step 5: Commit**

```bash
git add src/pages/CampaignOS.tsx src/main.tsx src/components/Layout.tsx
git commit -m "feat(campaign-os): add route shell with tab navigation"
```

---

## Task 6: StageShell Component

The shared wrapper for all wizard stages. Handles the idle → executing → success → error state machine.

**Files:**
- Create: `src/components/campaign-os/StageShell.tsx`

**Step 1: Build the StageShell**

```tsx
// src/components/campaign-os/StageShell.tsx

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { StageStatus } from '../../types/campaign';

interface StageShellProps {
  title: string;
  description: string;
  status: StageStatus;
  confirmLabel?: string;
  onExecute: () => Promise<void>;
  result?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}

export function StageShell({
  title,
  description,
  status: externalStatus,
  confirmLabel = 'Confirm & Execute',
  onExecute,
  result,
  error: externalError,
  children,
}: StageShellProps) {
  const [status, setStatus] = useState<StageStatus>(externalStatus);
  const [error, setError] = useState<string | null>(externalError || null);

  const handleExecute = async () => {
    setStatus('executing');
    setError(null);
    try {
      await onExecute();
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>

      {/* Form content — hidden after success */}
      {status !== 'success' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          {children}
        </div>
      )}

      {/* Error banner */}
      <AnimatePresence>
        {status === 'error' && error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-50 border border-red-200 rounded-xl p-4"
          >
            <p className="text-sm text-red-800 font-medium">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success result */}
      <AnimatePresence>
        {status === 'success' && result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 border border-green-200 rounded-xl p-4"
          >
            {result}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action button */}
      <div className="flex gap-3">
        {(status === 'idle' || status === 'error') && (
          <button
            onClick={handleExecute}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {status === 'error' ? 'Retry' : confirmLabel}
          </button>
        )}
        {status === 'executing' && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Executing...
          </div>
        )}
        {status === 'success' && (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <span>✓</span> Complete
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify it renders**

Temporarily render `<StageShell>` in the WizardTab stub in CampaignOS.tsx to verify. Then revert.

**Step 3: Commit**

```bash
git add src/components/campaign-os/StageShell.tsx
git commit -m "feat(campaign-os): add StageShell component with state machine"
```

---

## Task 7: Pipeline Wizard

**Files:**
- Create: `src/components/campaign-os/Wizard.tsx`
- Create: `src/components/campaign-os/stages/AudienceStage.tsx`
- Create: `src/components/campaign-os/stages/ListStage.tsx`
- Create: `src/components/campaign-os/stages/KnockAudienceStage.tsx`
- Create: `src/components/campaign-os/stages/TemplateStage.tsx`
- Create: `src/components/campaign-os/stages/WorkflowStage.tsx`
- Modify: `src/pages/CampaignOS.tsx`

**Step 1: Create the Wizard shell**

```tsx
// src/components/campaign-os/Wizard.tsx

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Campaign, StageName } from '../../types/campaign';
import { createCampaign, updateCampaign } from '../../services/campaignClient';
import { AudienceStage } from './stages/AudienceStage';
import { ListStage } from './stages/ListStage';
import { KnockAudienceStage } from './stages/KnockAudienceStage';
import { TemplateStage } from './stages/TemplateStage';
import { WorkflowStage } from './stages/WorkflowStage';

const STAGES: { key: StageName; label: string; number: number }[] = [
  { key: 'audience', label: 'Audience', number: 1 },
  { key: 'list', label: 'HubSpot List', number: 2 },
  { key: 'knock_audience', label: 'Knock Audience', number: 3 },
  { key: 'template', label: 'Template', number: 4 },
  { key: 'workflow', label: 'Workflow & Preset', number: 5 },
];

interface WizardProps {
  onComplete: (campaign: Campaign) => void;
}

export function Wizard({ onComplete }: WizardProps) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [currentStage, setCurrentStage] = useState(0);
  const [campaignName, setCampaignName] = useState('');
  const [channel, setChannel] = useState<'marketing' | 'outreach'>('marketing');

  // Pre-wizard: name + channel
  if (!campaign) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Name your campaign</h3>
          <p className="text-sm text-gray-500 mt-1">This will be used for list names, workflow keys, and presets.</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g., Public Sector Webinar - March 2026"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
            <div className="flex gap-3">
              {(['marketing', 'outreach'] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    channel === ch
                      ? ch === 'marketing' ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {ch === 'marketing' ? 'Marketing (Knock)' : 'Outreach (Smartlead)'}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={async () => {
              if (!campaignName.trim()) return;
              const c = await createCampaign({ name: campaignName, channel });
              setCampaign(c);
            }}
            disabled={!campaignName.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Start Building
          </button>
        </div>
      </div>
    );
  }

  const handleStageComplete = async (stageKey: StageName, result: Record<string, unknown>) => {
    const updatedPipeline = campaign.pipeline.map((s) =>
      s.stage === stageKey ? { ...s, status: 'success' as const, result, completedAt: new Date().toISOString() } : s
    );

    const updates: Partial<Campaign> = { pipeline: updatedPipeline };

    // Merge stage-specific results into campaign
    if (stageKey === 'audience' && result.count) {
      updates.audience = { ...campaign.audience, count: result.count as number, hubspotListId: '' };
    }
    if (stageKey === 'list' && result.listId) {
      updates.audience = { ...campaign.audience, hubspotListId: result.listId as string };
      updates.status = 'building';
    }
    if (stageKey === 'knock_audience' && result.audienceKey) {
      updates.audience = { ...campaign.audience, knockAudienceKey: result.audienceKey as string };
    }
    if (stageKey === 'template' && result.templateId) {
      updates.template = { sendgridTemplateId: result.templateId as string, name: result.templateName as string || '' };
    }
    if (stageKey === 'workflow' && result.workflowKey) {
      updates.workflow = { knockWorkflowKey: result.workflowKey as string };
      if (result.presetKey) {
        updates.preset = { key: result.presetKey as string, batchSize: 245, delayMinutes: 4 };
      }
      updates.status = 'ready';
    }

    const updated = await updateCampaign(campaign.id, updates);
    setCampaign(updated);

    // Auto-advance to next stage
    if (currentStage < STAGES.length - 1) {
      setCurrentStage(currentStage + 1);
    }
  };

  const stageProps = {
    campaign,
    onComplete: handleStageComplete,
  };

  return (
    <div className="flex gap-8">
      {/* Stage sidebar */}
      <div className="w-48 flex-shrink-0">
        <div className="space-y-1">
          {STAGES.map((stage, i) => {
            const pipelineStage = campaign.pipeline.find((s) => s.stage === stage.key);
            const isComplete = pipelineStage?.status === 'success';
            const isCurrent = i === currentStage;
            const isError = pipelineStage?.status === 'error';

            return (
              <button
                key={stage.key}
                onClick={() => i <= currentStage && setCurrentStage(i)}
                disabled={i > currentStage && !isComplete}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isCurrent
                    ? 'bg-blue-50 text-blue-700'
                    : isComplete
                      ? 'text-green-700 hover:bg-green-50'
                      : isError
                        ? 'text-red-700 hover:bg-red-50'
                        : 'text-gray-400'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isComplete ? 'bg-green-100 text-green-700' :
                  isCurrent ? 'bg-blue-100 text-blue-700' :
                  isError ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {isComplete ? '✓' : stage.number}
                </span>
                {stage.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stage content */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {currentStage === 0 && <AudienceStage {...stageProps} />}
            {currentStage === 1 && <ListStage {...stageProps} />}
            {currentStage === 2 && <KnockAudienceStage {...stageProps} />}
            {currentStage === 3 && <TemplateStage {...stageProps} />}
            {currentStage === 4 && (
              <WorkflowStage {...stageProps} onCampaignReady={(c) => onComplete(c)} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Footer status */}
        <div className="mt-6 pt-4 border-t border-gray-200 flex items-center gap-4 text-sm text-gray-500">
          <span>Stage {currentStage + 1} of {STAGES.length}</span>
          {campaign.audience?.count > 0 && (
            <span>~{campaign.audience.count.toLocaleString()} contacts</span>
          )}
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            channel === 'marketing' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
          }`}>
            {channel === 'marketing' ? 'Marketing' : 'Outreach'}
          </span>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create AudienceStage**

```tsx
// src/components/campaign-os/stages/AudienceStage.tsx

import { useState } from 'react';
import type { Campaign, StageName } from '../../../types/campaign';
import { StageShell } from '../StageShell';

interface StageProps {
  campaign: Campaign;
  onComplete: (stage: StageName, result: Record<string, unknown>) => Promise<void>;
}

export function AudienceStage({ campaign, onComplete }: StageProps) {
  const [query, setQuery] = useState('');
  const [minOpens, setMinOpens] = useState(0);
  const [minClicks, setMinClicks] = useState(0);
  const [excludeCustomers, setExcludeCustomers] = useState(true);
  const [contacts, setContacts] = useState<Array<{ email: string; firstname: string; lastname: string; company: string }>>([]);
  const [totalCount, setTotalCount] = useState(0);

  const pipelineStage = campaign.pipeline.find((s) => s.stage === 'audience');

  const handleExecute = async () => {
    const body = {
      filters: [] as Array<{ property: string; operator: string; value: unknown }>,
      properties: ['email', 'firstname', 'lastname', 'company', 'hs_email_open', 'hs_email_click', 'lifecyclestage'],
      limit: 100,
    };

    if (minOpens > 0) {
      body.filters.push({ property: 'hs_email_open', operator: 'GT', value: minOpens });
    }
    if (minClicks > 0) {
      body.filters.push({ property: 'hs_email_click', operator: 'GT', value: minClicks });
    }
    if (query.trim()) {
      body.filters.push({ property: 'company', operator: 'CONTAINS_TOKEN', value: query.trim() });
    }

    const res = await fetch('/api/list-builder/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const data = await res.json();

    let results = data.contacts || [];

    // Client-side filter: exclude customers
    if (excludeCustomers) {
      const excluded = ['customer', 'opportunity', 'evangelist', 'advocate', 'disqualified'];
      results = results.filter((c: { lifecyclestage?: string }) =>
        !excluded.includes((c.lifecyclestage || '').toLowerCase())
      );
    }

    setContacts(results.slice(0, 20));
    setTotalCount(results.length);

    await onComplete('audience', {
      count: results.length,
      contactIds: results.map((c: { hs_object_id?: string; vid?: string }) => c.hs_object_id || c.vid),
      filterConfig: { filters: body.filters, excludeCustomers },
    });
  };

  return (
    <StageShell
      title="Audience Query"
      description="Search HubSpot for contacts matching your campaign criteria."
      status={pipelineStage?.status || 'idle'}
      confirmLabel="Search HubSpot"
      onExecute={handleExecute}
      error={pipelineStage?.error}
      result={
        totalCount > 0 ? (
          <div>
            <p className="text-sm font-medium text-green-800 mb-3">
              Found {totalCount.toLocaleString()} contacts
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-green-200">
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Company</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.slice(0, 10).map((c, i) => (
                    <tr key={i} className="border-b border-green-100">
                      <td className="py-1.5 text-green-900">{c.email}</td>
                      <td className="py-1.5 text-green-800">{c.firstname} {c.lastname}</td>
                      <td className="py-1.5 text-green-700">{c.company}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalCount > 10 && (
                <p className="text-xs text-green-600 mt-2">Showing 10 of {totalCount}</p>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search (optional)</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Company name, vertical, etc."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Email Opens</label>
            <input
              type="number"
              value={minOpens}
              onChange={(e) => setMinOpens(Number(e.target.value))}
              min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Email Clicks</label>
            <input
              type="number"
              value={minClicks}
              onChange={(e) => setMinClicks(Number(e.target.value))}
              min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={excludeCustomers}
            onChange={(e) => setExcludeCustomers(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-gray-700">Exclude customers, opportunities, and disqualified</span>
        </label>
      </div>
    </StageShell>
  );
}
```

**Step 3: Create ListStage**

```tsx
// src/components/campaign-os/stages/ListStage.tsx

import { useState } from 'react';
import type { Campaign, StageName } from '../../../types/campaign';
import { StageShell } from '../StageShell';

interface StageProps {
  campaign: Campaign;
  onComplete: (stage: StageName, result: Record<string, unknown>) => Promise<void>;
}

export function ListStage({ campaign, onComplete }: StageProps) {
  const [listName, setListName] = useState(campaign.name);
  const pipelineStage = campaign.pipeline.find((s) => s.stage === 'list');

  const handleExecute = async () => {
    const contactIds = (campaign.pipeline.find((s) => s.stage === 'audience')?.result?.contactIds as string[]) || [];

    const res = await fetch('/api/list-builder/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: listName, contactIds }),
    });

    if (!res.ok) throw new Error(`List creation failed: ${res.status}`);
    const data = await res.json();

    await onComplete('list', {
      listId: data.listId || data.list?.listId,
      listName,
      contactCount: contactIds.length,
    });
  };

  return (
    <StageShell
      title="Create HubSpot List"
      description="Create a static list in HubSpot with the matched contacts."
      status={pipelineStage?.status || 'idle'}
      confirmLabel="Create List"
      onExecute={handleExecute}
      error={pipelineStage?.error}
      result={
        pipelineStage?.result ? (
          <div className="text-sm text-green-800">
            <p className="font-medium">List created: {listName}</p>
            <p className="mt-1">
              ID: {String(pipelineStage.result.listId)} &middot; {String(pipelineStage.result.contactCount)} contacts
            </p>
            <a
              href={`https://app.hubspot.com/contacts/19933594/lists/${pipelineStage.result.listId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 underline mt-1 inline-block"
            >
              View in HubSpot ↗
            </a>
          </div>
        ) : undefined
      }
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">List Name</label>
        <input
          type="text"
          value={listName}
          onChange={(e) => setListName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Will add {campaign.audience?.count || 0} contacts to this list.
        </p>
      </div>
    </StageShell>
  );
}
```

**Step 4: Create KnockAudienceStage**

```tsx
// src/components/campaign-os/stages/KnockAudienceStage.tsx

import { useState } from 'react';
import type { Campaign, StageName } from '../../../types/campaign';
import { StageShell } from '../StageShell';

interface StageProps {
  campaign: Campaign;
  onComplete: (stage: StageName, result: Record<string, unknown>) => Promise<void>;
}

const KNOCK_WRAPPER_URL = 'https://knock-wrapper.vercel.app';

export function KnockAudienceStage({ campaign, onComplete }: StageProps) {
  const audienceKey = campaign.id; // use campaign slug as audience key
  const pipelineStage = campaign.pipeline.find((s) => s.stage === 'knock_audience');
  const [memberCount, setMemberCount] = useState(0);

  const handleExecute = async () => {
    const listId = campaign.audience?.hubspotListId;
    if (!listId) throw new Error('No HubSpot list ID — complete the previous stage first.');

    // Push HubSpot list to Knock via knock-wrapper
    const res = await fetch(`${KNOCK_WRAPPER_URL}/api/audiences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audienceKey,
        hubspotListId: listId,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Knock audience push failed: ${errText}`);
    }

    const data = await res.json();
    setMemberCount(data.memberCount || campaign.audience?.count || 0);

    await onComplete('knock_audience', {
      audienceKey,
      memberCount: data.memberCount || campaign.audience?.count || 0,
    });
  };

  return (
    <StageShell
      title="Push to Knock"
      description="Sync the HubSpot list to Knock as an audience for sending."
      status={pipelineStage?.status || 'idle'}
      confirmLabel="Push Audience"
      onExecute={handleExecute}
      error={pipelineStage?.error}
      result={
        memberCount > 0 ? (
          <div className="text-sm text-green-800">
            <p className="font-medium">Audience synced to Knock</p>
            <p className="mt-1">
              Key: <code className="bg-green-100 px-1.5 py-0.5 rounded">{audienceKey}</code> &middot; {memberCount} members
            </p>
          </div>
        ) : undefined
      }
    >
      <div className="text-sm text-gray-600">
        <p>
          This will push {campaign.audience?.count || 0} contacts from HubSpot list{' '}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{campaign.audience?.hubspotListId}</code>{' '}
          to Knock audience{' '}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{audienceKey}</code>.
        </p>
        <p className="mt-2 text-gray-500">
          Uses email as the Knock user ID for cross-campaign compatibility.
        </p>
      </div>
    </StageShell>
  );
}
```

**Step 5: Create TemplateStage**

```tsx
// src/components/campaign-os/stages/TemplateStage.tsx

import { useState, useEffect } from 'react';
import type { Campaign, StageName } from '../../../types/campaign';
import { StageShell } from '../StageShell';
import { listBlocks } from '../../../services/campaignClient';
import type { BuildingBlock, TemplateConfig } from '../../../types/campaign';

interface StageProps {
  campaign: Campaign;
  onComplete: (stage: StageName, result: Record<string, unknown>) => Promise<void>;
}

export function TemplateStage({ campaign, onComplete }: StageProps) {
  const [templateId, setTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<BuildingBlock[]>([]);
  const pipelineStage = campaign.pipeline.find((s) => s.stage === 'template');

  useEffect(() => {
    listBlocks('template').then(setSavedTemplates).catch(() => {});
  }, []);

  const loadFromBlock = (block: BuildingBlock) => {
    const config = block.config as TemplateConfig;
    setTemplateId(config.sendgridTemplateId);
    setTemplateName(block.name);
  };

  const handleExecute = async () => {
    if (!templateId.trim()) throw new Error('Enter a SendGrid template ID');

    // Verify template exists via preview endpoint
    const res = await fetch(`/api/email-template-preview?templateId=${templateId}`);
    if (!res.ok) throw new Error(`Template ${templateId} not found or invalid`);
    const data = await res.json();

    await onComplete('template', {
      templateId,
      templateName: templateName || data.name || templateId,
      subject: data.subject || '',
    });
  };

  return (
    <StageShell
      title="Email Template"
      description="Select the SendGrid template to use for this campaign."
      status={pipelineStage?.status || 'idle'}
      confirmLabel="Confirm Template"
      onExecute={handleExecute}
      error={pipelineStage?.error}
      result={
        pipelineStage?.result ? (
          <div className="text-sm text-green-800">
            <p className="font-medium">{templateName || 'Template selected'}</p>
            <p className="mt-1">
              SendGrid ID: <code className="bg-green-100 px-1.5 py-0.5 rounded">{templateId}</code>
            </p>
            <a
              href={`https://mc.sendgrid.com/dynamic-templates/${templateId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 underline mt-1 inline-block"
            >
              View in SendGrid ↗
            </a>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {savedTemplates.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Library</label>
            <div className="flex flex-wrap gap-2">
              {savedTemplates.map((block) => (
                <button
                  key={block.id}
                  onClick={() => loadFromBlock(block)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors"
                >
                  {block.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g., Webinar Invite - Dark Hero"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SendGrid Template ID</label>
          <input
            type="text"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            placeholder="d-abc123..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </StageShell>
  );
}
```

**Step 6: Create WorkflowStage**

```tsx
// src/components/campaign-os/stages/WorkflowStage.tsx

import { useState } from 'react';
import type { Campaign, StageName } from '../../../types/campaign';
import { StageShell } from '../StageShell';

const KNOCK_WRAPPER_URL = 'https://knock-wrapper.vercel.app';

interface StageProps {
  campaign: Campaign;
  onComplete: (stage: StageName, result: Record<string, unknown>) => Promise<void>;
  onCampaignReady: (campaign: Campaign) => void;
}

export function WorkflowStage({ campaign, onComplete, onCampaignReady }: StageProps) {
  const [senderEmail, setSenderEmail] = useState('insights@email.truv.com');
  const [senderName, setSenderName] = useState('Truv');
  const [asmGroupId, setAsmGroupId] = useState(29127);
  const [batchSize, setBatchSize] = useState(245);
  const [delayMinutes, setDelayMinutes] = useState(4);
  const pipelineStage = campaign.pipeline.find((s) => s.stage === 'workflow');

  const workflowKey = campaign.id;
  const presetKey = campaign.id;

  const handleExecute = async () => {
    if (!campaign.template?.sendgridTemplateId) {
      throw new Error('No template selected — complete the previous stage first.');
    }
    if (!campaign.audience?.knockAudienceKey) {
      throw new Error('No Knock audience — complete stage 3 first.');
    }

    // Create preset (which also creates/references the workflow)
    const res = await fetch(`${KNOCK_WRAPPER_URL}/api/presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: presetKey,
        name: campaign.name,
        workflowKey,
        audienceKey: campaign.audience.knockAudienceKey,
        communicationType: campaign.channel,
        batchSize,
        delayMinutes,
        senderEmail,
        senderName,
        asmGroupId,
        templateId: campaign.template.sendgridTemplateId,
        createdBy: 'campaign-os',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Preset creation failed: ${errText}`);
    }

    await onComplete('workflow', {
      workflowKey,
      presetKey,
      senderEmail,
      senderName,
      asmGroupId,
    });

    onCampaignReady(campaign);
  };

  return (
    <StageShell
      title="Workflow & Preset"
      description="Create the Knock workflow and Drip Sender preset for this campaign."
      status={pipelineStage?.status || 'idle'}
      confirmLabel="Create Workflow & Preset"
      onExecute={handleExecute}
      error={pipelineStage?.error}
      result={
        pipelineStage?.result ? (
          <div className="text-sm text-green-800 space-y-2">
            <p className="font-medium">Campaign ready to send</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Workflow: <code className="bg-green-100 px-1 rounded">{workflowKey}</code></div>
              <div>Preset: <code className="bg-green-100 px-1 rounded">{presetKey}</code></div>
              <div>Sender: {senderName} &lt;{senderEmail}&gt;</div>
              <div>ASM: {asmGroupId}</div>
            </div>
            <div className="flex gap-2 mt-3">
              <a
                href={`https://dashboard.knock.app/truvhq/development/workflows/${workflowKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 underline text-xs"
              >
                Knock workflow ↗
              </a>
              <a
                href="https://knock-wrapper.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 underline text-xs"
              >
                Drip Sender ↗
              </a>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sender Email</label>
            <input
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sender Name</label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ASM Unsubscribe Group</label>
          <select
            value={asmGroupId}
            onChange={(e) => setAsmGroupId(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={29127}>29127 — Marketing Communications</option>
            <option value={29746}>29746 — Product Changelog</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Batch Size</label>
            <input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delay (minutes)</label>
            <input
              type="number"
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(Number(e.target.value))}
              min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </StageShell>
  );
}
```

**Step 7: Wire wizard into CampaignOS**

In `src/pages/CampaignOS.tsx`, replace the `WizardTab` stub:

```tsx
import { Wizard } from '../components/campaign-os/Wizard';
import type { Campaign } from '../types/campaign';

// Inside CampaignOS component:
function WizardTab({ onComplete }: { onComplete: (campaign: Campaign) => void }) {
  return <Wizard onComplete={onComplete} />;
}

// In the tab rendering, pass callback that switches to dashboard:
{tab === 'new' && <WizardTab onComplete={() => setTab('dashboard')} />}
```

**Step 8: Verify wizard renders**

Run: `npm run dev`
Navigate to: `http://localhost:5173/campaigns?tab=new`
Expected: See campaign name input, then 5-stage sidebar with stage content area.

**Step 9: Commit**

```bash
git add src/components/campaign-os/Wizard.tsx src/components/campaign-os/stages/ src/pages/CampaignOS.tsx
git commit -m "feat(campaign-os): add 5-stage pipeline wizard with all stages"
```

---

## Task 8: Campaign Dashboard

**Files:**
- Create: `src/components/campaign-os/Dashboard.tsx`
- Create: `src/components/campaign-os/CampaignCalendar.tsx`
- Create: `src/components/campaign-os/CampaignTable.tsx`
- Modify: `src/pages/CampaignOS.tsx`

**Step 1: Create CampaignTable**

```tsx
// src/components/campaign-os/CampaignTable.tsx

import type { CampaignListItem } from '../../types/campaign';

interface CampaignTableProps {
  campaigns: CampaignListItem[];
  onSelect: (id: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  building: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-blue-100 text-blue-700',
  sending: 'bg-purple-100 text-purple-700',
  sent: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

export function CampaignTable({ campaigns, onSelect }: CampaignTableProps) {
  if (campaigns.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No campaigns yet. Create one to get started.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-500 border-b border-gray-200">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Channel</th>
            <th className="px-4 py-3 font-medium">Audience</th>
            <th className="px-4 py-3 font-medium">Sends</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {campaigns.map((c) => (
            <tr
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  c.channel === 'marketing' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {c.channel}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600">{c.audienceCount.toLocaleString()}</td>
              <td className="px-4 py-3 text-gray-600">{c.sendCount}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[c.status] || ''}`}>
                  {c.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(c.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: Create CampaignCalendar**

```tsx
// src/components/campaign-os/CampaignCalendar.tsx

import { useState } from 'react';
import type { CampaignListItem } from '../../types/campaign';

interface CampaignCalendarProps {
  campaigns: CampaignListItem[];
  onSelect: (id: string) => void;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function CampaignCalendar({ campaigns, onSelect }: CampaignCalendarProps) {
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Build a map of date → campaigns
  const dateMap = new Map<string, CampaignListItem[]>();
  for (const c of campaigns) {
    const dateStr = c.sentAt || c.nextSendAt;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate().toString();
      const existing = dateMap.get(key) || [];
      existing.push(c);
      dateMap.set(key, existing);
    }
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="px-2 py-1 text-gray-500 hover:text-gray-700 text-sm">&larr;</button>
        <h3 className="font-medium text-gray-900">{monthName}</h3>
        <button onClick={nextMonth} className="px-2 py-1 text-gray-500 hover:text-gray-700 text-sm">&rarr;</button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
        {days.map((d) => (
          <div key={d} className="bg-gray-50 px-2 py-1.5 text-center text-xs font-medium text-gray-500">
            {d}
          </div>
        ))}

        {/* Empty cells before first day */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-white p-2 min-h-[60px]" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayCampaigns = dateMap.get(day.toString()) || [];

          return (
            <div key={day} className="bg-white p-2 min-h-[60px]">
              <span className="text-xs text-gray-500">{day}</span>
              <div className="mt-1 space-y-0.5">
                {dayCampaigns.slice(0, 2).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className={`block w-full text-left px-1 py-0.5 rounded text-xs truncate ${
                      c.channel === 'marketing'
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
                {dayCampaigns.length > 2 && (
                  <span className="text-xs text-gray-400">+{dayCampaigns.length - 2} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 3: Create Dashboard**

```tsx
// src/components/campaign-os/Dashboard.tsx

import { useState, useEffect } from 'react';
import { listCampaigns } from '../../services/campaignClient';
import type { CampaignListItem } from '../../types/campaign';
import { CampaignTable } from './CampaignTable';
import { CampaignCalendar } from './CampaignCalendar';

interface DashboardProps {
  onNewCampaign: () => void;
  onSelectCampaign: (id: string) => void;
}

export function Dashboard({ onNewCampaign, onSelectCampaign }: DashboardProps) {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCampaigns()
      .then(setCampaigns)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const activeCampaigns = campaigns.filter((c) =>
    ['building', 'ready', 'sending'].includes(c.status)
  );

  if (loading) {
    return <div className="text-gray-400 text-sm py-12 text-center">Loading campaigns...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
        Failed to load campaigns: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onNewCampaign}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          New Campaign
        </button>
        <span className="text-sm text-gray-500">
          {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} total
        </span>
      </div>

      {/* Active campaigns strip */}
      {activeCampaigns.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Active</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {activeCampaigns.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectCampaign(c.id)}
                className="flex-shrink-0 bg-white border border-gray-200 rounded-xl p-4 w-64 text-left hover:border-blue-300 transition-colors"
              >
                <p className="font-medium text-gray-900 text-sm truncate">{c.name}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    c.channel === 'marketing' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {c.channel}
                  </span>
                  <span className="text-xs text-gray-500">
                    {c.audienceCount.toLocaleString()} contacts
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  {['audience', 'list', 'knock_audience', 'template', 'workflow'].map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${
                        i < c.sendCount ? 'bg-green-400' : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Calendar */}
      <CampaignCalendar campaigns={campaigns} onSelect={onSelectCampaign} />

      {/* Recent campaigns table */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">All Campaigns</h3>
        <CampaignTable campaigns={campaigns} onSelect={onSelectCampaign} />
      </div>
    </div>
  );
}
```

**Step 4: Wire Dashboard into CampaignOS**

Update `src/pages/CampaignOS.tsx` — replace the `DashboardTab` stub with the real component. Add a `selectedCampaignId` state for the detail view (Task 9).

**Step 5: Verify**

Navigate to: `http://localhost:5173/campaigns`
Expected: Dashboard with "New Campaign" button, empty table, and calendar grid.

**Step 6: Commit**

```bash
git add src/components/campaign-os/Dashboard.tsx src/components/campaign-os/CampaignCalendar.tsx src/components/campaign-os/CampaignTable.tsx src/pages/CampaignOS.tsx
git commit -m "feat(campaign-os): add dashboard with calendar and campaign table"
```

---

## Task 9: Campaign Detail View

**Files:**
- Create: `src/components/campaign-os/Detail.tsx`
- Create: `src/components/campaign-os/SendTimeline.tsx`
- Create: `src/components/campaign-os/AddSendDrawer.tsx`
- Create: `src/components/campaign-os/CampaignAnalytics.tsx`
- Create: `src/components/campaign-os/CampaignHealth.tsx`
- Create: `src/hooks/useCampaign.ts`
- Modify: `src/pages/CampaignOS.tsx`

**Step 1: Create useCampaign hook**

```tsx
// src/hooks/useCampaign.ts

import { useState, useEffect, useRef } from 'react';
import { getCampaign } from '../services/campaignClient';
import type { Campaign } from '../types/campaign';

export function useCampaign(id: string | null) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getCampaign(id);
      setCampaign(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [id]);

  // Poll every 30s when campaign is sending
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (campaign?.status === 'sending') {
      intervalRef.current = setInterval(load, 30_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [campaign?.status]);

  return { campaign, loading, error, refresh: load };
}
```

**Step 2: Create SendTimeline**

```tsx
// src/components/campaign-os/SendTimeline.tsx

import type { Send } from '../../types/campaign';

interface SendTimelineProps {
  sends: Send[];
  onCancel: (sendId: string) => void;
  onAddSend: () => void;
}

const STATUS_ICONS: Record<string, { icon: string; color: string }> = {
  draft: { icon: '○', color: 'text-gray-400' },
  scheduled: { icon: '⏳', color: 'text-blue-600' },
  sending: { icon: '●', color: 'text-purple-600' },
  sent: { icon: '✓', color: 'text-green-600' },
  error: { icon: '✗', color: 'text-red-600' },
  cancelled: { icon: '—', color: 'text-gray-400' },
};

export function SendTimeline({ sends, onCancel, onAddSend }: SendTimelineProps) {
  const sorted = [...sends].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">
          Send Timeline &middot; {sends.length} send{sends.length !== 1 ? 's' : ''}
        </h3>
        <button
          onClick={onAddSend}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          + Add Send
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No sends scheduled yet.</p>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

          <div className="space-y-4">
            {sorted.map((send) => {
              const { icon, color } = STATUS_ICONS[send.status] || STATUS_ICONS.draft;
              const date = send.scheduledAt ? new Date(send.scheduledAt) : null;

              return (
                <div key={send.id} className="relative flex items-start gap-4 pl-8">
                  {/* Node */}
                  <span className={`absolute left-2.5 top-1 text-lg ${color}`}>{icon}</span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm">{send.name}</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        send.status === 'sent' ? 'bg-green-100 text-green-700' :
                        send.status === 'error' ? 'bg-red-100 text-red-700' :
                        send.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {send.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {date ? date.toLocaleString() : 'Not scheduled'}
                      {send.recipientCount ? ` · ${send.recipientCount.toLocaleString()} recipients` : ''}
                      {send.audienceFilter.type !== 'all' ? ` · ${send.audienceFilter.type.replace('_', '-')}` : ''}
                    </p>
                    {send.error && (
                      <p className="text-xs text-red-600 mt-1">{send.error}</p>
                    )}
                  </div>

                  {send.status === 'scheduled' && (
                    <button
                      onClick={() => onCancel(send.id)}
                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create AddSendDrawer**

```tsx
// src/components/campaign-os/AddSendDrawer.tsx

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { AudienceFilterType, Send } from '../../types/campaign';

interface AddSendDrawerProps {
  existingSends: Send[];
  onAdd: (send: Partial<Send>) => Promise<void>;
  onClose: () => void;
}

export function AddSendDrawer({ existingSends, onAdd, onClose }: AddSendDrawerProps) {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [filterType, setFilterType] = useState<AudienceFilterType>('all');
  const [relativeTo, setRelativeTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sentSends = existingSends.filter((s) => s.status === 'sent');

  const handleSubmit = async () => {
    if (!name || !scheduledDate) return;
    setSubmitting(true);
    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      await onAdd({
        name,
        templateId,
        templateName,
        scheduledAt,
        audienceFilter: { type: filterType, relativeTo: relativeTo || undefined },
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col"
    >
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Add Send</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Send Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., 24hr Reminder"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SendGrid Template ID</label>
          <input
            type="text"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            placeholder="d-abc123..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Optional display name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Audience Filter</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as AudienceFilterType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All recipients</option>
            <option value="non_openers">Non-openers of a previous send</option>
            <option value="non_clickers">Non-clickers of a previous send</option>
          </select>
        </div>

        {(filterType === 'non_openers' || filterType === 'non_clickers') && sentSends.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Relative to</label>
            <select
              value={relativeTo}
              onChange={(e) => setRelativeTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a send...</option>
              {sentSends.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleSubmit}
          disabled={!name || !scheduledDate || submitting}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {submitting ? 'Adding...' : 'Add Send'}
        </button>
      </div>
    </motion.div>
  );
}
```

**Step 4: Create CampaignAnalytics**

```tsx
// src/components/campaign-os/CampaignAnalytics.tsx

import { useState, useEffect } from 'react';
import { getCampaignAnalytics, type CampaignAnalytics as AnalyticsData } from '../../services/campaignClient';

interface CampaignAnalyticsProps {
  campaignId: string;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export function CampaignAnalyticsPanel({ campaignId }: CampaignAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCampaignAnalytics(campaignId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <div className="text-sm text-gray-400 py-4">Loading analytics...</div>;
  if (!data || data.sends.length === 0) return <div className="text-sm text-gray-400 py-4">No send data yet.</div>;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Campaign Analytics</h3>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-5 gap-4 p-4 border-b border-gray-100">
        {[
          { label: 'Recipients', value: data.totals.recipients.toLocaleString() },
          { label: 'Delivered', value: data.totals.delivered.toLocaleString() },
          { label: 'Open Rate', value: pct(data.totals.openRate) },
          { label: 'Click Rate', value: pct(data.totals.clickRate) },
          { label: 'Bounces', value: data.totals.bounces.toLocaleString() },
        ].map((m) => (
          <div key={m.label} className="text-center">
            <p className="text-lg font-semibold text-gray-900">{m.value}</p>
            <p className="text-xs text-gray-500">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Per-send breakdown */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="px-4 py-2 font-medium">Send</th>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium text-right">Recipients</th>
            <th className="px-4 py-2 font-medium text-right">Opens</th>
            <th className="px-4 py-2 font-medium text-right">Clicks</th>
            <th className="px-4 py-2 font-medium text-right">Bounces</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.sends.map((s) => (
            <tr key={s.sendId}>
              <td className="px-4 py-2 font-medium text-gray-900">{s.name}</td>
              <td className="px-4 py-2 text-gray-500">{new Date(s.sentAt).toLocaleDateString()}</td>
              <td className="px-4 py-2 text-right text-gray-600">{s.recipients.toLocaleString()}</td>
              <td className="px-4 py-2 text-right text-gray-600">{s.opens} ({pct(s.openRate)})</td>
              <td className="px-4 py-2 text-right text-gray-600">{s.clicks} ({pct(s.clickRate)})</td>
              <td className="px-4 py-2 text-right text-gray-600">{s.bounces}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 5: Create CampaignHealth**

```tsx
// src/components/campaign-os/CampaignHealth.tsx

import { useState, useEffect } from 'react';
import { getCampaignHealth, type CampaignHealth as HealthData } from '../../services/campaignClient';

interface CampaignHealthProps {
  campaignId: string;
}

export function CampaignHealthPanel({ campaignId }: CampaignHealthProps) {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCampaignHealth(campaignId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <div className="text-sm text-gray-400 py-4">Loading health data...</div>;
  if (!data) return null;

  const hasPipelineErrors = data.pipelineErrors.length > 0;
  const hasDeliveryErrors = data.deliveryErrors.length > 0;

  if (!hasPipelineErrors && !hasDeliveryErrors) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
        No errors detected. Campaign is healthy.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Pipeline errors */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-3 bg-gray-50 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900">Pipeline Errors ({data.pipelineErrors.length})</h4>
        </div>
        {data.pipelineErrors.length === 0 ? (
          <p className="p-3 text-xs text-gray-400">None</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.pipelineErrors.map((e, i) => (
              <div key={i} className="p-3">
                <p className="text-xs font-medium text-red-700">Stage: {e.stage}</p>
                <p className="text-xs text-red-600 mt-0.5">{e.error}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery errors */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-3 bg-gray-50 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900">Delivery Errors ({data.deliveryErrors.length})</h4>
        </div>
        {data.deliveryErrors.length === 0 ? (
          <p className="p-3 text-xs text-gray-400">None</p>
        ) : (
          <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {data.deliveryErrors.map((e, i) => (
              <div key={i} className="p-3 flex items-center justify-between">
                <span className="text-xs text-gray-800">{e.email}</span>
                <span className="text-xs text-red-600">{e.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 6: Create Detail view**

```tsx
// src/components/campaign-os/Detail.tsx

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useCampaign } from '../../hooks/useCampaign';
import { createSend, cancelSend } from '../../services/campaignClient';
import type { Send } from '../../types/campaign';
import { SendTimeline } from './SendTimeline';
import { AddSendDrawer } from './AddSendDrawer';
import { CampaignAnalyticsPanel } from './CampaignAnalytics';
import { CampaignHealthPanel } from './CampaignHealth';

interface DetailProps {
  campaignId: string;
  onBack: () => void;
}

export function Detail({ campaignId, onBack }: DetailProps) {
  const { campaign, loading, error, refresh } = useCampaign(campaignId);
  const [showAddSend, setShowAddSend] = useState(false);

  if (loading) return <div className="text-gray-400 text-sm py-12 text-center">Loading...</div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">{error}</div>;
  if (!campaign) return null;

  const handleAddSend = async (data: Partial<Send>) => {
    await createSend(campaignId, data);
    refresh();
  };

  const handleCancel = async (sendId: string) => {
    await cancelSend(campaignId, sendId);
    refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-sm">&larr; Back</button>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{campaign.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              campaign.channel === 'marketing' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
            }`}>
              {campaign.channel}
            </span>
            <span className="text-sm text-gray-500">
              {campaign.audience?.count?.toLocaleString()} contacts
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              campaign.status === 'sent' ? 'bg-green-100 text-green-700' :
              campaign.status === 'error' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {campaign.status}
            </span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <SendTimeline
        sends={campaign.sends || []}
        onCancel={handleCancel}
        onAddSend={() => setShowAddSend(true)}
      />

      {/* Analytics */}
      <CampaignAnalyticsPanel campaignId={campaignId} />

      {/* Health */}
      <CampaignHealthPanel campaignId={campaignId} />

      {/* Add Send Drawer */}
      <AnimatePresence>
        {showAddSend && (
          <AddSendDrawer
            existingSends={campaign.sends || []}
            onAdd={handleAddSend}
            onClose={() => setShowAddSend(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
```

**Step 7: Wire Detail into CampaignOS**

Add a `selectedCampaignId` state to `CampaignOS.tsx`. When set, render `<Detail>` instead of the tab content. Dashboard's `onSelectCampaign` sets this state.

**Step 8: Commit**

```bash
git add src/components/campaign-os/Detail.tsx src/components/campaign-os/SendTimeline.tsx src/components/campaign-os/AddSendDrawer.tsx src/components/campaign-os/CampaignAnalytics.tsx src/components/campaign-os/CampaignHealth.tsx src/hooks/useCampaign.ts src/pages/CampaignOS.tsx
git commit -m "feat(campaign-os): add campaign detail view with timeline, analytics, and health"
```

---

## Task 10: Building Blocks Library

**Files:**
- Create: `src/components/campaign-os/Library.tsx`
- Create: `src/components/campaign-os/BlockCard.tsx`
- Modify: `src/pages/CampaignOS.tsx`

**Step 1: Create BlockCard**

```tsx
// src/components/campaign-os/BlockCard.tsx

import type { BuildingBlock, TemplateConfig, WorkflowConfig, AudienceConfig } from '../../types/campaign';

interface BlockCardProps {
  block: BuildingBlock;
  onUse: (block: BuildingBlock) => void;
  onDelete: (block: BuildingBlock) => void;
}

export function BlockCard({ block, onUse, onDelete }: BlockCardProps) {
  const subtitle = () => {
    if (block.type === 'template') {
      const c = block.config as TemplateConfig;
      return c.sendgridTemplateId;
    }
    if (block.type === 'workflow') {
      const c = block.config as WorkflowConfig;
      return `${c.senderName} <${c.senderEmail}>`;
    }
    if (block.type === 'audience') {
      const c = block.config as AudienceConfig;
      return `${c.filters?.length || 0} filters`;
    }
    return '';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-gray-900 text-sm">{block.name}</p>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">{subtitle()}</p>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          block.type === 'audience' ? 'bg-purple-100 text-purple-700' :
          block.type === 'template' ? 'bg-blue-100 text-blue-700' :
          'bg-green-100 text-green-700'
        }`}>
          {block.type}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
        {block.usedCount > 0 && <span>Used {block.usedCount}x</span>}
        {block.lastUsed && <span>Last: {new Date(block.lastUsed).toLocaleDateString()}</span>}
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onUse(block)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          Use in Campaign
        </button>
        <button
          onClick={() => onDelete(block)}
          className="px-3 py-1.5 text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Create Library**

```tsx
// src/components/campaign-os/Library.tsx

import { useState, useEffect } from 'react';
import { listBlocks, deleteBlock } from '../../services/campaignClient';
import type { BuildingBlock, BlockType } from '../../types/campaign';
import { BlockCard } from './BlockCard';

interface LibraryProps {
  onUseBlock: (block: BuildingBlock) => void;
}

export function Library({ onUseBlock }: LibraryProps) {
  const [blocks, setBlocks] = useState<BuildingBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<BlockType>('audience');
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    listBlocks()
      .then(setBlocks)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (block: BuildingBlock) => {
    if (!confirm(`Delete "${block.name}"?`)) return;
    await deleteBlock(block.id);
    load();
  };

  const tabs: { id: BlockType; label: string }[] = [
    { id: 'audience', label: 'Audiences' },
    { id: 'template', label: 'Templates' },
    { id: 'workflow', label: 'Workflows' },
  ];

  const filtered = blocks
    .filter((b) => b.type === tab)
    .filter((b) => !search || b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t.label} ({blocks.filter((b) => b.type === t.id).length})
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-gray-400 py-12 text-center">
          No {tab} blocks saved yet. Complete a campaign to save reusable blocks.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((block) => (
            <BlockCard key={block.id} block={block} onUse={onUseBlock} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Wire Library into CampaignOS**

Replace the `LibraryTab` stub in `CampaignOS.tsx` with the real `Library` component. The `onUseBlock` callback should switch to the wizard tab with pre-filled data.

**Step 4: Commit**

```bash
git add src/components/campaign-os/Library.tsx src/components/campaign-os/BlockCard.tsx src/pages/CampaignOS.tsx
git commit -m "feat(campaign-os): add building blocks library with card grid"
```

---

## Task 11: Final Wiring & Polish

**Files:**
- Modify: `src/pages/CampaignOS.tsx` (final assembly)

**Step 1: Assemble the complete CampaignOS page**

Wire all sub-components together in `CampaignOS.tsx`:
- Dashboard tab renders `<Dashboard>` with callbacks
- New Campaign tab renders `<Wizard>` with completion callback
- Library tab renders `<Library>` with use-block callback
- Detail view renders `<Detail>` when a campaign is selected
- Tab switching clears selected campaign

**Step 2: Add "Save to Library" buttons in wizard stages**

After each wizard stage completes successfully, show a small "Save to Library" link that calls `createBlock()` with the stage's config.

**Step 3: Verify end-to-end flow**

1. Navigate to `/campaigns` — see empty dashboard
2. Click "New Campaign" — enter name, start building
3. Walk through all 5 stages (will need HubSpot/Knock APIs available)
4. After completion, see campaign in dashboard
5. Click campaign → detail view with timeline
6. Add a send with a scheduled date
7. Check Library tab — verify blocks appear

**Step 4: Commit**

```bash
git add src/pages/CampaignOS.tsx
git commit -m "feat(campaign-os): wire all components together with final polish"
```

---

## Summary

| Task | What | Files | Estimated Steps |
|------|------|-------|-----------------|
| 1 | Types & service client | 2 new | 4 |
| 2 | Campaign CRUD API | 3 new | 5 |
| 3 | Sends & blocks API | 3 new | 5 |
| 4 | Cron, health, analytics API | 3 new, 1 modified | 5 |
| 5 | Route shell & nav | 1 new, 2 modified | 5 |
| 6 | StageShell component | 1 new | 3 |
| 7 | Pipeline wizard (5 stages) | 6 new, 1 modified | 9 |
| 8 | Dashboard + calendar | 3 new, 1 modified | 6 |
| 9 | Detail view (timeline, analytics, health) | 6 new, 1 modified | 8 |
| 10 | Building blocks library | 2 new, 1 modified | 4 |
| 11 | Final wiring | 1 modified | 4 |
| **Total** | | **~30 files** | **~58 steps** |
