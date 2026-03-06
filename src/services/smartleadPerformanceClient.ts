import type { SmartleadCampaign } from '../types/emailPerformance';

export async function getSmartleadCampaigns(): Promise<SmartleadCampaign[]> {
  const res = await fetch('/api/smartlead-performance');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
