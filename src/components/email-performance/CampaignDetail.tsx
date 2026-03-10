import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { getCampaignDetail, getClickAnalytics } from '../../services/emailPerformanceClient';
import type { ClickAnalytics } from '../../services/emailPerformanceClient';
import { exportCampaignPdf } from '../../utils/exportCampaignPdf';
import type { CampaignSummary, RecipientActivity } from '../../types/emailPerformance';

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

function rateColor(rate: number, thresholds: { good: number; ok: number }): string {
  if (rate >= thresholds.good) return 'text-green-600';
  if (rate >= thresholds.ok) return 'text-yellow-600';
  return 'text-red-500';
}

function statusBadge(summary: RecipientActivity['summary']): { text: string; className: string } {
  if (summary.bounced) return { text: 'Bounced', className: 'bg-red-100 text-red-800' };
  if (summary.clicked) return { text: 'Clicked', className: 'bg-green-100 text-green-800' };
  if (summary.opened) return { text: 'Opened', className: 'bg-yellow-100 text-yellow-800' };
  if (summary.delivered) return { text: 'Delivered', className: 'bg-gray-100 text-gray-700' };
  return { text: 'Pending', className: 'bg-gray-100 text-gray-500' };
}

function statusColor(summary: RecipientActivity['summary']): string {
  if (summary.bounced) return 'bg-red-50';
  if (summary.clicked) return 'bg-green-50';
  if (summary.opened) return 'bg-yellow-50';
  return 'bg-white';
}

const DONUT_COLORS = ['#dc2626', '#3b82f6', '#f59e0b', '#22c55e'];

function KpiCard({ label, value, subtitle, valueColor }: {
  label: string;
  value: string;
  subtitle?: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${valueColor || 'text-gray-900'}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

export function CampaignDetail({ campaign, onBack }: CampaignDetailProps) {
  const [recipients, setRecipients] = useState<RecipientActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [clickData, setClickData] = useState<ClickAnalytics | null>(null);
  const [clickLoading, setClickLoading] = useState(false);
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

  // Fetch click analytics when template_id is available
  useEffect(() => {
    if (!campaign.template_id) return;
    setClickLoading(true);
    getClickAnalytics(campaign.template_id)
      .then(setClickData)
      .catch(() => setClickData(null))
      .finally(() => setClickLoading(false));
  }, [campaign.template_id]);

  const m = campaign.metrics;

  // Funnel data
  const funnelData = useMemo(() => [
    { stage: 'Sent', value: m.processed, fill: '#6b7280' },
    { stage: 'Delivered', value: m.delivered, fill: '#3b82f6' },
    { stage: 'Opened', value: m.unique_opens, fill: '#f59e0b' },
    { stage: 'Clicked', value: m.unique_clicks, fill: '#22c55e' },
  ], [m]);

  // Engagement donut
  const donutData = useMemo(() => {
    const bounced = m.bounces;
    const deliveredOnly = Math.max(0, m.delivered - m.unique_opens);
    const openedOnly = Math.max(0, m.unique_opens - m.unique_clicks);
    const clicked = m.unique_clicks;
    return [
      { name: 'Bounced', value: bounced },
      { name: 'Delivered Only', value: deliveredOnly },
      { name: 'Opened Only', value: openedOnly },
      { name: 'Clicked', value: clicked },
    ].filter(d => d.value > 0);
  }, [m]);

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <KpiCard label="Sent" value={m.processed.toLocaleString()} />
        <KpiCard label="Delivered" value={m.delivered.toLocaleString()} subtitle={pct(m.delivered / (m.processed || 1))} />
        <KpiCard label="Unique Opens" value={m.unique_opens.toLocaleString()} />
        <KpiCard
          label="Open Rate"
          value={pct(m.open_rate)}
          valueColor={rateColor(m.open_rate, { good: 0.25, ok: 0.15 })}
          subtitle={m.open_rate >= 0.25 ? 'Above benchmark' : m.open_rate >= 0.15 ? 'Average' : 'Below benchmark'}
        />
        <KpiCard
          label="Click Rate"
          value={pct(m.click_rate)}
          valueColor={rateColor(m.click_rate, { good: 0.03, ok: 0.015 })}
          subtitle={m.click_rate >= 0.03 ? 'Above benchmark' : m.click_rate >= 0.015 ? 'Average' : 'Below benchmark'}
        />
        <KpiCard
          label="Click-to-Open"
          value={pct(m.click_to_open)}
          valueColor={rateColor(m.click_to_open, { good: 0.10, ok: 0.05 })}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Engagement Funnel */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Engagement Funnel</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 30, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
              <YAxis type="category" dataKey="stage" width={80} tick={{ fontSize: 13 }} />
              <Tooltip formatter={(value) => Number(value).toLocaleString()} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={36}>
                {funnelData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Engagement Breakdown Donut */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Engagement Breakdown</h3>
          {donutData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  paddingAngle={2}
                  label={(props) => `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => Number(value).toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-400 text-sm">
              No engagement data
            </div>
          )}
        </div>
      </div>

      {/* Bounce Rate Banner (if high) */}
      {m.bounce_rate > 0.05 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-800">High bounce rate: {pct(m.bounce_rate)}</p>
            <p className="text-xs text-red-600 mt-0.5">{m.bounces.toLocaleString()} bounces out of {m.processed.toLocaleString()} sent. Review list hygiene.</p>
          </div>
        </div>
      )}

      {/* Click Analytics */}
      {clickLoading && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 mb-6 text-center text-gray-400 text-sm">
          Loading click analytics...
        </div>
      )}
      {clickData && clickData.link_clicks.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Top Links - horizontal bar chart */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Top Clicked Links</h3>
              <span className="text-[10px] text-gray-400">
                Based on {clickData.sample_size} of {clickData.messages_with_clicks} clicked messages
              </span>
            </div>
            <ResponsiveContainer width="100%" height={Math.min(clickData.link_clicks.slice(0, 10).length * 40 + 20, 420)}>
              <BarChart
                data={clickData.link_clicks.slice(0, 10).map(l => ({
                  label: new URL(l.url).pathname === '/' ? l.url.replace(/^https?:\/\//, '') : new URL(l.url).pathname,
                  clicks: l.clicks,
                  unique: l.unique_clickers,
                  url: l.url,
                }))}
                layout="vertical"
                margin={{ left: 10, right: 30, top: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={200}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-xs">
                        <p className="font-medium text-gray-900 truncate mb-1">{d.url}</p>
                        <p className="text-gray-600">{d.clicks.toLocaleString()} total clicks</p>
                        <p className="text-gray-600">{d.unique.toLocaleString()} unique clickers</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="clicks" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* UTM Breakdown */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">UTM Parameters</h3>
            {Object.keys(clickData.utm_breakdown).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(clickData.utm_breakdown).map(([param, values]) => (
                  <div key={param}>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                      {param.replace('utm_', '')}
                    </p>
                    <div className="space-y-1.5">
                      {values.slice(0, 5).map(v => {
                        const maxClicks = values[0].clicks;
                        const pctWidth = maxClicks > 0 ? (v.clicks / maxClicks) * 100 : 0;
                        return (
                          <div key={v.value}>
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className="text-gray-700 truncate mr-2">{v.value}</span>
                              <span className="text-gray-500 shrink-0">{v.clicks.toLocaleString()}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-400 rounded-full"
                                style={{ width: `${pctWidth}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                No UTM parameters detected
              </div>
            )}
          </div>
        </div>
      )}

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
