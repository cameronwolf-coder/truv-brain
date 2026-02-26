import type { CampaignSummary } from '../../types/emailPerformance';

interface CampaignTableProps {
  campaigns: CampaignSummary[];
  onSelect: (workflowKey: string) => void;
}

function formatDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function CampaignTable({ campaigns, onSelect }: CampaignTableProps) {
  if (campaigns.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-500">No campaigns found. Events will appear here once SendGrid starts sending webhook data.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Campaign</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Sends</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Delivered</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Opens</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Clicks</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Bounces</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Open Rate</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Click Rate</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr
                key={c.workflow_key}
                onClick={() => onSelect(c.workflow_key)}
                className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{c.workflow_key}</p>
                </td>
                <td className="text-right px-4 py-3 text-gray-700">{c.metrics.processed.toLocaleString()}</td>
                <td className="text-right px-4 py-3 text-gray-700">{c.metrics.delivered.toLocaleString()}</td>
                <td className="text-right px-4 py-3 text-gray-700">{c.metrics.unique_opens.toLocaleString()}</td>
                <td className="text-right px-4 py-3 text-gray-700">{c.metrics.unique_clicks.toLocaleString()}</td>
                <td className="text-right px-4 py-3 text-gray-700">{c.metrics.bounces.toLocaleString()}</td>
                <td className="text-right px-4 py-3">
                  <span className={c.metrics.open_rate > 0.2 ? 'text-green-700' : 'text-gray-700'}>
                    {pct(c.metrics.open_rate)}
                  </span>
                </td>
                <td className="text-right px-4 py-3">
                  <span className={c.metrics.click_rate > 0.02 ? 'text-green-700' : 'text-gray-700'}>
                    {pct(c.metrics.click_rate)}
                  </span>
                </td>
                <td className="text-right px-4 py-3 text-gray-500">{formatDate(c.last_event)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
