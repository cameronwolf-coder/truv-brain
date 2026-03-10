import type { CampaignSummary, CampaignDetailResponse } from '../types/emailPerformance';

export async function getCampaigns(): Promise<CampaignSummary[]> {
  const res = await fetch('/api/email-performance');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function syncCampaigns(): Promise<void> {
  const res = await fetch('/api/email-performance-backfill', { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function getCampaignDetail(
  workflow: string,
  limit = 100,
  offset = 0,
): Promise<CampaignDetailResponse> {
  const params = new URLSearchParams({
    workflow,
    limit: String(limit),
    offset: String(offset),
  });
  const res = await fetch(`/api/email-performance-detail?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface TemplatePreview {
  name: string;
  subject: string;
  html_content: string;
}

export interface ClickAnalytics {
  template_id: string;
  total_messages: number;
  messages_with_clicks: number;
  sample_size: number;
  link_clicks: Array<{
    url: string;
    clicks: number;
    unique_clickers: number;
    sample_clicks: number;
  }>;
  utm_breakdown: Record<string, Array<{ value: string; clicks: number }>>;
}

export async function getClickAnalytics(templateId: string): Promise<ClickAnalytics> {
  const res = await fetch(`/api/email-click-analytics?template_id=${encodeURIComponent(templateId)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getTemplatePreview(templateId: string): Promise<TemplatePreview> {
  const res = await fetch(`/api/email-template-preview?template_id=${encodeURIComponent(templateId)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
