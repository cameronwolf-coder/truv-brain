import type { SmartleadCampaign } from '../../types/emailPerformance';

interface SmartleadCampaignTableProps {
  campaigns: SmartleadCampaign[];
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function statusBadge(status: string): { text: string; className: string } {
  switch (status) {
    case 'ACTIVE':
      return { text: 'Active', className: 'bg-green-100 text-green-800' };
    case 'COMPLETED':
      return { text: 'Completed', className: 'bg-blue-100 text-blue-800' };
    case 'PAUSED':
      return { text: 'Paused', className: 'bg-yellow-100 text-yellow-800' };
    default:
      return { text: status, className: 'bg-gray-100 text-gray-700' };
  }
}

export function SmartleadCampaignTable({ campaigns }: SmartleadCampaignTableProps) {
  if (campaigns.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-500">No outreach campaigns found. Active Smartlead campaigns will appear here.</p>
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
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Leads</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Sent</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Opens</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Clicks</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Replies</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Bounces</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Reply Rate</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Created</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const badge = statusBadge(c.status);
              return (
                <tr
                  key={c.campaign_id}
                  className="border-b border-gray-100 hover:bg-blue-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">ID: {c.campaign_id}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                      {badge.text}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 text-gray-700">{c.total_leads.toLocaleString()}</td>
                  <td className="text-right px-4 py-3 text-gray-700">{c.metrics.sent.toLocaleString()}</td>
                  <td className="text-right px-4 py-3 text-gray-700">{c.metrics.opened.toLocaleString()}</td>
                  <td className="text-right px-4 py-3 text-gray-700">{c.metrics.clicked.toLocaleString()}</td>
                  <td className="text-right px-4 py-3">
                    <span className={c.metrics.replied > 0 ? 'text-green-700 font-medium' : 'text-gray-700'}>
                      {c.metrics.replied.toLocaleString()}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 text-gray-700">{c.metrics.bounced.toLocaleString()}</td>
                  <td className="text-right px-4 py-3">
                    <span className={c.metrics.reply_rate > 0.02 ? 'text-green-700 font-medium' : 'text-gray-700'}>
                      {pct(c.metrics.reply_rate)}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 text-gray-500">{formatDate(c.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
