import { useState, useEffect } from 'react';
import { getCampaigns, syncCampaigns } from '../services/emailPerformanceClient';
import { getSmartleadCampaigns } from '../services/smartleadPerformanceClient';
import type { CampaignSummary, SmartleadCampaign } from '../types/emailPerformance';
import { MetricCard } from '../components/email-performance/MetricCard';
import { CampaignTable } from '../components/email-performance/CampaignTable';
import { CampaignDetail } from '../components/email-performance/CampaignDetail';
import { SmartleadCampaignTable } from '../components/email-performance/SmartleadCampaignTable';

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

type Tab = 'marketing' | 'outreach';

export function EmailPerformance() {
  const [tab, setTab] = useState<Tab>('marketing');

  // Marketing state
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Outreach state
  const [slCampaigns, setSlCampaigns] = useState<SmartleadCampaign[]>([]);
  const [slLoading, setSlLoading] = useState(false);
  const [slError, setSlError] = useState<string | null>(null);

  const loadCampaigns = () => {
    setLoading(true);
    setError(null);
    getCampaigns()
      .then(setCampaigns)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const loadSmartlead = () => {
    setSlLoading(true);
    setSlError(null);
    getSmartleadCampaigns()
      .then(setSlCampaigns)
      .catch((err) => setSlError(err.message))
      .finally(() => setSlLoading(false));
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (tab === 'outreach' && slCampaigns.length === 0 && !slLoading) {
      loadSmartlead();
    }
  }, [tab]);

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

  // Marketing aggregates
  const totals = campaigns.reduce(
    (acc, c) => ({
      sends: acc.sends + c.metrics.processed,
      delivered: acc.delivered + c.metrics.delivered,
      opens: acc.opens + c.metrics.unique_opens,
      clicks: acc.clicks + c.metrics.unique_clicks,
    }),
    { sends: 0, delivered: 0, opens: 0, clicks: 0 }
  );
  const avgOpenRate = totals.delivered > 0 ? totals.opens / totals.delivered : 0;

  // Outreach aggregates
  const slTotals = slCampaigns.reduce(
    (acc, c) => ({
      sent: acc.sent + c.metrics.sent,
      replied: acc.replied + c.metrics.replied,
      opened: acc.opened + c.metrics.opened,
      bounced: acc.bounced + c.metrics.bounced,
    }),
    { sent: 0, replied: 0, opened: 0, bounced: 0 }
  );
  const avgReplyRate = slTotals.sent > 0 ? slTotals.replied / slTotals.sent : 0;
  const avgBounceRate = slTotals.sent > 0 ? slTotals.bounced / slTotals.sent : 0;

  // Detail view (marketing only)
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Email Performance</h1>
        <div className="flex items-center gap-3">
          {tab === 'marketing' && (
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
          )}
          {tab === 'outreach' && (
            <button
              onClick={loadSmartlead}
              disabled={slLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className={`w-4 h-4 ${slLoading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {slLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('marketing')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'marketing'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Marketing (SendGrid)
        </button>
        <button
          onClick={() => setTab('outreach')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'outreach'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Outreach (Smartlead)
        </button>
      </div>

      {/* Marketing Tab */}
      {tab === 'marketing' && (
        <>
          {loading ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
              Loading campaign data...
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-sm text-red-700">
              Failed to load campaigns: {error}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <MetricCard label="Total Sends" value={totals.sends.toLocaleString()} subtitle={`${campaigns.length} campaigns`} />
                <MetricCard label="Total Opens" value={totals.opens.toLocaleString()} subtitle="Unique opens" />
                <MetricCard label="Total Clicks" value={totals.clicks.toLocaleString()} subtitle="Unique clicks" />
                <MetricCard label="Avg Open Rate" value={pct(avgOpenRate)} subtitle="Across all campaigns" />
              </div>
              <CampaignTable campaigns={campaigns} onSelect={setSelectedKey} />
            </>
          )}
        </>
      )}

      {/* Outreach Tab */}
      {tab === 'outreach' && (
        <>
          {slLoading ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
              Loading Smartlead campaigns...
            </div>
          ) : slError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-sm text-red-700">
              Failed to load Smartlead data: {slError}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <MetricCard label="Total Sent" value={slTotals.sent.toLocaleString()} subtitle={`${slCampaigns.length} campaigns`} />
                <MetricCard label="Total Replies" value={slTotals.replied.toLocaleString()} subtitle="Across all campaigns" />
                <MetricCard label="Reply Rate" value={pct(avgReplyRate)} subtitle="Key outreach metric" />
                <MetricCard label="Bounce Rate" value={pct(avgBounceRate)} subtitle={`${slTotals.bounced} bounces`} />
              </div>
              <SmartleadCampaignTable campaigns={slCampaigns} />
            </>
          )}
        </>
      )}
    </div>
  );
}
