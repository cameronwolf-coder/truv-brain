import type { CampaignListItem } from '../../types/campaign';

interface CampaignTableProps {
  campaigns: CampaignListItem[];
  onSelect: (id: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  building: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-blue-100 text-blue-700',
  sending: 'bg-purple-100 text-purple-700',
  sent: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

export function CampaignTable({ campaigns, onSelect }: CampaignTableProps) {
  if (campaigns.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No campaigns yet. Create one to get started.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-500 border-b border-gray-200">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Channel</th>
            <th className="px-4 py-3 font-medium">Audience</th>
            <th className="px-4 py-3 font-medium">Sends</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {campaigns.map((c) => (
            <tr key={c.id} onClick={() => onSelect(c.id)} className="hover:bg-gray-50 cursor-pointer transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.channel === 'marketing' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{c.channel}</span>
              </td>
              <td className="px-4 py-3 text-gray-600">{c.audienceCount.toLocaleString()}</td>
              <td className="px-4 py-3 text-gray-600">{c.sendCount}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[c.status] || ''}`}>{c.status}</span>
              </td>
              <td className="px-4 py-3 text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
