import type { CampaignSummary, CampaignDetailResponse } from '../types/emailPerformance';

export async function getCampaigns(): Promise<CampaignSummary[]> {
  const res = await fetch('/api/email-performance');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
