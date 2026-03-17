import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useCampaign } from '../../hooks/useCampaign';
import { createSend, cancelSend, updateCampaign, deleteCampaign } from '../../services/campaignClient';
import type { Send } from '../../types/campaign';
import { SendTimeline } from './SendTimeline';
import { AddSendDrawer } from './AddSendDrawer';
import { CampaignResources } from './CampaignResources';
import { CampaignAnalyticsPanel } from './CampaignAnalytics';
import { CampaignHealthPanel } from './CampaignHealth';

interface DetailProps {
  campaignId: string;
  onBack: () => void;
}

export function Detail({ campaignId, onBack }: DetailProps) {
  const { campaign, loading, error, refresh } = useCampaign(campaignId);
  const [showAddSend, setShowAddSend] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!confirm(`Delete "${campaign.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteCampaign(campaignId);
      onBack();
    } catch {
      setDeleting(false);
    }
  };

  const handleSaveName = async () => {
    if (!editName.trim() || editName === campaign.name) {
      setEditing(false);
      return;
    }
    await updateCampaign(campaignId, { name: editName.trim() });
    setEditing(false);
    refresh();
  };

  const startEditing = () => {
    setEditName(campaign.name);
    setEditing(true);
  };

  return (
    <div className="space-y-6">
      {/* Header with edit/delete */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-sm">&larr; Back</button>
          <div>
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  autoFocus
                  className="text-xl font-semibold text-gray-900 border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={handleSaveName} className="text-xs text-blue-600 hover:text-blue-800">Save</button>
                <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-900">{campaign.name}</h2>
                <button onClick={startEditing} className="text-gray-300 hover:text-gray-500 text-sm" title="Edit name">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${campaign.channel === 'marketing' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{campaign.channel}</span>
              <span className="text-sm text-gray-500">{campaign.audience?.count?.toLocaleString()} contacts</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                campaign.status === 'sent' ? 'bg-green-100 text-green-700' :
                campaign.status === 'error' ? 'bg-red-100 text-red-700' :
                campaign.status === 'ready' ? 'bg-blue-100 text-blue-700' :
                campaign.status === 'sending' ? 'bg-purple-100 text-purple-700' :
                'bg-gray-100 text-gray-600'
              }`}>{campaign.status}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg transition-colors border border-red-200"
          >
            {deleting ? 'Deleting...' : 'Delete Campaign'}
          </button>
        </div>
      </div>

      <CampaignResources campaign={campaign} onRefresh={refresh} />

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
