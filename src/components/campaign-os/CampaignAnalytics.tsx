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
    getCampaignAnalytics(campaignId).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <div className="text-sm text-gray-400 py-4">Loading analytics...</div>;
  if (!data || data.sends.length === 0) return <div className="text-sm text-gray-400 py-4">No send data yet.</div>;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Campaign Analytics</h3>
      </div>
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
