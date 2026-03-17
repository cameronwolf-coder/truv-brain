import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useCampaign } from '../../hooks/useCampaign';
import { createSend, cancelSend } from '../../services/campaignClient';
import type { Send } from '../../types/campaign';
import { SendTimeline } from './SendTimeline';
import { AddSendDrawer } from './AddSendDrawer';
import { CampaignAnalyticsPanel } from './CampaignAnalytics';
import { CampaignHealthPanel } from './CampaignHealth';

interface DetailProps {
  campaignId: string;
  onBack: () => void;
}

export function Detail({ campaignId, onBack }: DetailProps) {
  const { campaign, loading, error, refresh } = useCampaign(campaignId);
  const [showAddSend, setShowAddSend] = useState(false);

  if (loading) return <div className="text-gray-400 text-sm py-12 text-center">Loading...</div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">{error}</div>;
  if (!campaign) return null;

  const handleAddSend = async (data: Partial<Send>) => {
    await createSend(campaignId, data);
    refresh();
  };

  const handleCancel = async (sendId: string) => {
    await cancelSend(campaignId, sendId);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-sm">&larr; Back</button>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{campaign.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${campaign.channel === 'marketing' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{campaign.channel}</span>
            <span className="text-sm text-gray-500">{campaign.audience?.count?.toLocaleString()} contacts</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              campaign.status === 'sent' ? 'bg-green-100 text-green-700' :
              campaign.status === 'error' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-600'
            }`}>{campaign.status}</span>
          </div>
        </div>
      </div>

      <SendTimeline sends={campaign.sends || []} onCancel={handleCancel} onAddSend={() => setShowAddSend(true)} />

      <CampaignAnalyticsPanel campaignId={campaignId} />

      <CampaignHealthPanel campaignId={campaignId} />

      <AnimatePresence>
        {showAddSend && (
          <AddSendDrawer existingSends={campaign.sends || []} onAdd={handleAddSend} onClose={() => setShowAddSend(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
