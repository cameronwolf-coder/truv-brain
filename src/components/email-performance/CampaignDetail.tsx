import { useState, useEffect } from 'react';
import { getCampaignDetail } from '../../services/emailPerformanceClient';
import { exportCampaignPdf } from '../../utils/exportCampaignPdf';
import type { CampaignSummary, RecipientActivity } from '../../types/emailPerformance';
import { MetricCard } from './MetricCard';

interface CampaignDetailProps {
  campaign: CampaignSummary;
  onBack: () => void;
}

function formatTimestamp(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function statusColor(summary: RecipientActivity['summary']): string {
  if (summary.bounced) return 'bg-red-50';
  if (summary.clicked) return 'bg-green-50';
  if (summary.opened) return 'bg-yellow-50';
  if (summary.delivered) return 'bg-white';
  return 'bg-white';
}

function statusBadge(summary: RecipientActivity['summary']): { text: string; className: string } {
  if (summary.bounced) return { text: 'Bounced', className: 'bg-red-100 text-red-800' };
  if (summary.clicked) return { text: 'Clicked', className: 'bg-green-100 text-green-800' };
  if (summary.opened) return { text: 'Opened', className: 'bg-yellow-100 text-yellow-800' };
  if (summary.delivered) return { text: 'Delivered', className: 'bg-gray-100 text-gray-700' };
  return { text: 'Pending', className: 'bg-gray-100 text-gray-500' };
}

export function CampaignDetail({ campaign, onBack }: CampaignDetailProps) {
  const [recipients, setRecipients] = useState<RecipientActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    setError(null);
    getCampaignDetail(campaign.workflow_key, limit, offset)
      .then((data) => {
        setRecipients(data.recipients);
        setTotal(data.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [campaign.workflow_key, offset]);

  const m = campaign.metrics;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <span>&larr;</span> Back to campaigns
        </button>
        <h2 className="text-xl font-semibold text-gray-900">{campaign.name}</h2>
        <span className="text-xs text-gray-400 font-mono">{campaign.workflow_key}</span>
        <button
          onClick={async () => {
            setExporting(true);
            try {
              await exportCampaignPdf(campaign);
            } catch (err) {
              console.error('PDF export failed:', err);
            } finally {
              setExporting(false);
            }
          }}
          disabled={exporting}
          className="ml-auto px-4 py-2 text-sm font-medium rounded-lg bg-truv-blue text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {exporting ? 'Exporting...' : 'Export PDF'}
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <MetricCard label="Delivered" value={m.delivered.toLocaleString()} />
        <MetricCard label="Unique Opens" value={m.unique_opens.toLocaleString()} />
        <MetricCard label="Unique Clicks" value={m.unique_clicks.toLocaleString()} />
        <MetricCard label="Open Rate" value={pct(m.open_rate)} />
        <MetricCard label="Click Rate" value={pct(m.click_rate)} />
        <MetricCard label="Click-to-Open" value={pct(m.click_to_open)} />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Recipient Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">
            Recipients ({total.toLocaleString()} total)
          </p>
          {total > limit && (
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1 rounded border border-gray-200 text-gray-600 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-gray-500">
                {offset + 1}–{Math.min(offset + limit, total)}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-3 py-1 rounded border border-gray-200 text-gray-600 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading recipients...</div>
        ) : recipients.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No recipient data yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Delivered</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Opened</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Clicked</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => {
                  const badge = statusBadge(r.summary);
                  return (
                    <tr key={r.email} className={`border-b border-gray-100 ${statusColor(r.summary)}`}>
                      <td className="px-4 py-3 text-gray-900">{r.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                          {badge.text}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{r.summary.delivered ? 'Yes' : '—'}</td>
                      <td className="px-4 py-3 text-center">{r.summary.opened ? 'Yes' : '—'}</td>
                      <td className="px-4 py-3 text-center">{r.summary.clicked ? 'Yes' : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {formatTimestamp(r.summary.last_activity)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
