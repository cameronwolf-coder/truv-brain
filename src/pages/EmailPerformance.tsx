import { useState, useEffect } from 'react';
import { getCampaigns, syncCampaigns } from '../services/emailPerformanceClient';
import type { CampaignSummary } from '../types/emailPerformance';
import { MetricCard } from '../components/email-performance/MetricCard';
import { CampaignTable } from '../components/email-performance/CampaignTable';
import { CampaignDetail } from '../components/email-performance/CampaignDetail';

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function EmailPerformance() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadCampaigns = () => {
    setLoading(true);
    setError(null);
    getCampaigns()
      .then(setCampaigns)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncCampaigns();
      loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const selectedCampaign = campaigns.find((c) => c.workflow_key === selectedKey) ?? null;

  // Aggregate metrics across all campaigns
  const totals = campaigns.reduce(
    (acc, c) => ({
      sends: acc.sends + c.metrics.processed,
      delivered: acc.delivered + c.metrics.delivered,
      opens: acc.opens + c.metrics.unique_opens,
      clicks: acc.clicks + c.metrics.unique_clicks,
    }),
    { sends: 0, delivered: 0, opens: 0, clicks: 0 }
  );

  const avgOpenRate =
    totals.delivered > 0 ? totals.opens / totals.delivered : 0;

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Email Performance</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          Loading campaign data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Email Performance</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-sm text-red-700">
          Failed to load campaigns: {error}
        </div>
      </div>
    );
  }

  // Detail view
  if (selectedCampaign) {
    return (
      <div className="p-8">
        <CampaignDetail
          campaign={selectedCampaign}
          onBack={() => setSelectedKey(null)}
        />
      </div>
    );
  }

  // Campaign list view
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Email Performance</h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Sends" value={totals.sends.toLocaleString()} subtitle={`${campaigns.length} campaigns`} />
        <MetricCard label="Total Opens" value={totals.opens.toLocaleString()} subtitle="Unique opens" />
        <MetricCard label="Total Clicks" value={totals.clicks.toLocaleString()} subtitle="Unique clicks" />
        <MetricCard label="Avg Open Rate" value={pct(avgOpenRate)} subtitle="Across all campaigns" />
      </div>

      {/* Campaign Table */}
      <CampaignTable campaigns={campaigns} onSelect={setSelectedKey} />
    </div>
  );
}
