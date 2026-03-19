import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useCampaign } from '../../hooks/useCampaign';
import { createSend, cancelSend, updateCampaign } from '../../services/campaignClient';
import type { Send } from '../../types/campaign';
import { SendTimeline } from './SendTimeline';
import { AddSendDrawer } from './AddSendDrawer';
import { CampaignResources } from './CampaignResources';
import { CampaignAnalyticsPanel } from './CampaignAnalytics';
import { CampaignHealthPanel } from './CampaignHealth';
import { DeliveryStatus } from './DeliveryStatus';
import { SendDialog } from './SendDialog';
import { DeleteDialog } from './DeleteDialog';
import { exportCampaignOsPdf } from '../../utils/exportCampaignOsPdf';

interface DetailProps {
  campaignId: string;
  onBack: () => void;
}

export function Detail({ campaignId, onBack }: DetailProps) {
  const { campaign, loading, error, refresh } = useCampaign(campaignId);
  const [showAddSend, setShowAddSend] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ triggered: number; error?: string; isTest?: boolean } | null>(null);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [customTestEmail, setCustomTestEmail] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

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

  const handleDeleteConfirm = async (options: { deleteCampaign: boolean }) => {
    if (options.deleteCampaign) {
      onBack();
    } else {
      setShowDeleteDialog(false);
      refresh();
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
          {campaign.workflow?.knockWorkflowKey && campaign.audience?.knockAudienceKey && campaign.status !== 'sent' && (
            <button
              onClick={() => setShowSendDialog(true)}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Send
            </button>
          )}
          {campaign.workflow?.knockWorkflowKey && (
            <button
              onClick={() => { setShowTestDialog(true); setCustomTestEmail(''); }}
              disabled={testSending}
              className="px-3 py-1.5 border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:bg-gray-100 disabled:text-gray-400 text-xs font-medium rounded-lg transition-colors"
            >
              {testSending ? 'Sending...' : 'Test Send'}
            </button>
          )}
          {campaign.status === 'sent' && campaign.workflow?.knockWorkflowKey && (
            <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-medium rounded-lg">Sent</span>
          )}
          <button
            onClick={async () => {
              setExporting(true);
              setExportProgress('');
              try {
                await exportCampaignOsPdf(campaign, setExportProgress);
              } catch (e: any) {
                setExportProgress(`Export failed: ${e.message}`);
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting}
            className="px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:text-gray-300 text-xs font-medium rounded-lg transition-colors border border-gray-200"
          >
            {exporting ? exportProgress || 'Exporting...' : '📄 Export PDF'}
          </button>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="px-3 py-1.5 text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg transition-colors border border-red-200"
          >
            Delete Campaign
          </button>
        </div>
      </div>

      {sendResult && (
        <div className={`rounded-xl p-4 text-sm ${sendResult.error ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
          {sendResult.error
            ? `${sendResult.isTest ? 'Test send' : 'Send'} failed: ${sendResult.error}`
            : `${sendResult.isTest ? 'Test sent' : 'Sent'} to ${sendResult.triggered} recipients${sendResult.isTest ? ' (cameron.wolf@truv.com + 3 test addresses)' : ''}`}
        </div>
      )}

      <CampaignResources campaign={campaign} onRefresh={refresh} />

      <SendTimeline sends={campaign.sends || []} onCancel={handleCancel} onAddSend={() => setShowAddSend(true)} />

      <DeliveryStatus workflowKey={campaign.workflow?.knockWorkflowKey} />

      <CampaignAnalyticsPanel campaignId={campaignId} />

      <CampaignHealthPanel campaignId={campaignId} />

      <AnimatePresence>
        {showAddSend && (
          <AddSendDrawer existingSends={campaign.sends || []} onAdd={handleAddSend} onClose={() => setShowAddSend(false)} />
        )}
      </AnimatePresence>

      {showSendDialog && campaign && (
        <SendDialog
          campaign={campaign}
          onSendNow={async (batchSize, delaySeconds) => {
            setSendResult(null);
            try {
              const res = await fetch('/api/campaigns/trigger-send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId, batchSize, delaySeconds }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || `Failed: ${res.status}`);
              setSendResult({ triggered: data.triggered });
              setShowSendDialog(false);
              refresh();
            } catch (err) {
              throw err;
            }
          }}
          onSchedule={async (scheduledAt) => {
            try {
              await createSend(campaignId, {
                name: `${campaign.name} - Scheduled`,
                templateId: campaign.template?.sendgridTemplateId || '',
                templateName: campaign.template?.name || '',
                scheduledAt,
                audienceFilter: { type: 'all' },
                recipientCount: campaign.audience?.count || 0,
                workflowKey: campaign.workflow?.knockWorkflowKey || '',
                presetKey: campaign.preset?.key || '',
              });
              setShowSendDialog(false);
              refresh();
            } catch (err) {
              throw err;
            }
          }}
          onCancel={() => setShowSendDialog(false)}
        />
      )}

      {showDeleteDialog && (
        <DeleteDialog campaign={campaign} onConfirm={handleDeleteConfirm} onCancel={() => setShowDeleteDialog(false)} />
      )}

      {showTestDialog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowTestDialog(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900">Test Send</h3>
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                Sends to your 4 default test addresses. Optionally add a custom email below.
              </p>
              <input
                type="email"
                value={customTestEmail}
                onChange={(e) => setCustomTestEmail(e.target.value)}
                placeholder="Add a custom email (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !testSending) {
                    e.preventDefault();
                    document.getElementById('test-send-btn')?.click();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowTestDialog(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                id="test-send-btn"
                disabled={testSending}
                onClick={async () => {
                  setTestSending(true);
                  setSendResult(null);
                  try {
                    const body: Record<string, unknown> = {
                      workflowKey: campaign.workflow?.knockWorkflowKey,
                    };
                    if (customTestEmail.trim()) {
                      body.extraEmails = [customTestEmail.trim()];
                    }
                    const res = await fetch('/api/campaigns/test-send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || `Failed: ${res.status}`);
                    setSendResult({ triggered: data.count, isTest: true });
                    setShowTestDialog(false);
                  } catch (err) {
                    setSendResult({ triggered: 0, error: err instanceof Error ? err.message : 'Test failed', isTest: true });
                    setShowTestDialog(false);
                  }
                  setTestSending(false);
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {testSending ? 'Sending...' : 'Send Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
