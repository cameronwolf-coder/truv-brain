import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_TOKEN = process.env.HUBSPOT_API_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

interface AdCampaignPerformance {
  adAccountId: string;
  adAccountName: string;
  adNetworkType: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  clicks: number;
  impressions: number;
}

interface PlatformSummary {
  name: string;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
}

const NETWORK_LABELS: Record<string, string> = {
  LINKEDIN: 'LinkedIn',
  GOOGLE: 'Google',
  FACEBOOK: 'Meta',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!HUBSPOT_API_TOKEN) {
    return res.status(500).json({ error: 'HubSpot API token not configured' });
  }

  try {
    // Get first day of current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch ad campaigns from HubSpot Ads API
    const response = await fetch(
      `${HUBSPOT_BASE_URL}/marketing/v3/campaigns?limit=100`,
      {
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      // If the Ads API isn't available, return empty data
      if (response.status === 403 || response.status === 404) {
        return res.status(200).json({
          totalSpend: 0,
          totalClicks: 0,
          totalImpressions: 0,
          avgCTR: 0,
          avgCPC: 0,
          byPlatform: [],
          period: { start: monthStart.toISOString(), end: now.toISOString() },
        });
      }
      const errorText = await response.text();
      throw new Error(`HubSpot Ads API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as {
      results?: AdCampaignPerformance[];
    };

    const campaigns = data.results || [];

    // Group by platform (ad network type)
    const platformMap = new Map<string, { spend: number; clicks: number; impressions: number }>();

    for (const campaign of campaigns) {
      const network = campaign.adNetworkType || 'OTHER';
      const existing = platformMap.get(network) || { spend: 0, clicks: 0, impressions: 0 };
      existing.spend += campaign.spend || 0;
      existing.clicks += campaign.clicks || 0;
      existing.impressions += campaign.impressions || 0;
      platformMap.set(network, existing);
    }

    let totalSpend = 0;
    let totalClicks = 0;
    let totalImpressions = 0;

    const byPlatform: PlatformSummary[] = [];

    for (const [network, metrics] of platformMap) {
      totalSpend += metrics.spend;
      totalClicks += metrics.clicks;
      totalImpressions += metrics.impressions;

      byPlatform.push({
        name: NETWORK_LABELS[network] || network,
        spend: Math.round(metrics.spend * 100) / 100,
        clicks: metrics.clicks,
        impressions: metrics.impressions,
        ctr: metrics.impressions > 0 ? metrics.clicks / metrics.impressions : 0,
        cpc: metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0,
      });
    }

    // Sort by spend descending
    byPlatform.sort((a, b) => b.spend - a.spend);

    return res.status(200).json({
      totalSpend: Math.round(totalSpend * 100) / 100,
      totalClicks,
      totalImpressions,
      avgCTR: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      avgCPC: totalClicks > 0 ? Math.round((totalSpend / totalClicks) * 100) / 100 : 0,
      byPlatform,
      period: { start: monthStart.toISOString(), end: now.toISOString() },
    });
  } catch (err) {
    console.error('Ad spend error:', err);
    return res.status(500).json({ error: 'Failed to fetch ad spend data' });
  }
}
