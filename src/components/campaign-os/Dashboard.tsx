import { useState, useEffect } from 'react';
import { listCampaigns } from '../../services/campaignClient';
import type { CampaignListItem } from '../../types/campaign';
import { CampaignTable } from './CampaignTable';
import { CampaignCalendar } from './CampaignCalendar';

interface DashboardProps {
  onNewCampaign: () => void;
  onSelectCampaign: (id: string) => void;
}

export function Dashboard({ onNewCampaign, onSelectCampaign }: DashboardProps) {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCampaigns()
      .then(setCampaigns)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const activeCampaigns = campaigns.filter((c) =>
    ['building', 'ready', 'sending'].includes(c.status)
  );

  if (loading) {
    return <div className="text-gray-400 text-sm py-12 text-center">Loading campaigns...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
        Failed to load campaigns: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onNewCampaign} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">New Campaign</button>
        <span className="text-sm text-gray-500">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} total</span>
      </div>

      {activeCampaigns.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Active</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {activeCampaigns.map((c) => (
              <button key={c.id} onClick={() => onSelectCampaign(c.id)} className="flex-shrink-0 bg-white border border-gray-200 rounded-xl p-4 w-64 text-left hover:border-blue-300 transition-colors">
                <p className="font-medium text-gray-900 text-sm truncate">{c.name}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.channel === 'marketing' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{c.channel}</span>
                  <span className="text-xs text-gray-500">{c.audienceCount.toLocaleString()} contacts</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <CampaignCalendar campaigns={campaigns} onSelect={onSelectCampaign} />

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">All Campaigns</h3>
        <CampaignTable campaigns={campaigns} onSelect={onSelectCampaign} />
      </div>
    </div>
  );
}
