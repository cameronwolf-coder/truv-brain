import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Campaign } from '../../types/campaign';

interface DeleteDialogProps {
  campaign: Campaign;
  onConfirm: (options: DeleteOptions) => Promise<void>;
  onCancel: () => void;
}

export interface DeleteOptions {
  deleteCampaign: boolean;
  deleteTemplate: boolean;
  deleteWorkflow: boolean;
  deleteAudience: boolean;
  deleteHubspotList: boolean;
}

export function DeleteDialog({ campaign, onConfirm, onCancel }: DeleteDialogProps) {
  const [options, setOptions] = useState<DeleteOptions>({
    deleteCampaign: true,
    deleteTemplate: false,
    deleteWorkflow: false,
    deleteAudience: false,
    deleteHubspotList: false,
  });
  const [deleting, setDeleting] = useState(false);
  const [results, setResults] = useState<Array<{ resource: string; status: string; error?: string }> | null>(null);

  const toggle = (key: keyof DeleteOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hasTemplate = !!campaign.template?.sendgridTemplateId;
  const hasWorkflow = !!campaign.workflow?.knockWorkflowKey;
  const hasAudience = !!campaign.audience?.knockAudienceKey;
  const hasList = !!campaign.audience?.hubspotListId;
  const anythingSelected = Object.values(options).some(Boolean);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      const res = await fetch('/api/campaigns/delete-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id, ...options }),
      });
      const data = await res.json();

      if (data.campaignDeleted) {
        await onConfirm(options);
        return;
      }

      // Show results, then refresh
      setResults(data.results || []);
      setTimeout(() => onConfirm(options), 1500);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Delete Campaign Resources</h3>
          <p className="text-sm text-gray-500 mt-1">
            Choose what to delete for <strong>{campaign.name}</strong>. Unchecked resources will be kept.
          </p>
        </div>

        {results ? (
          <div className="p-5 space-y-2">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-2 text-sm ${r.status === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                <span>{r.status === 'deleted' || r.status === 'updated' ? '✓' : '✗'}</span>
                <span className="capitalize">{r.resource.replace(/-/g, ' ')}</span>
                {r.error && <span className="text-xs text-red-400">({r.error})</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 space-y-3">
            {/* Campaign record */}
            <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
              <input type="checkbox" checked={options.deleteCampaign} onChange={() => toggle('deleteCampaign')} className="mt-0.5 rounded border-gray-300" />
              <div>
                <p className="text-sm font-medium text-gray-900">Campaign record</p>
                <p className="text-xs text-gray-500">Remove from Campaign OS dashboard</p>
              </div>
            </label>

            {/* SendGrid Template */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${hasTemplate ? 'border-gray-200 hover:bg-gray-50 cursor-pointer' : 'border-gray-100 opacity-40 cursor-not-allowed'}`}>
              <input type="checkbox" checked={options.deleteTemplate} onChange={() => hasTemplate && toggle('deleteTemplate')} disabled={!hasTemplate} className="mt-0.5 rounded border-gray-300" />
              <div>
                <p className="text-sm font-medium text-gray-900">SendGrid template</p>
                {hasTemplate ? (
                  <p className="text-xs text-gray-500">{campaign.template.name} ({campaign.template.sendgridTemplateId})</p>
                ) : (
                  <p className="text-xs text-gray-400">None set</p>
                )}
              </div>
            </label>

            {/* Knock Workflow */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${hasWorkflow ? 'border-gray-200 hover:bg-gray-50 cursor-pointer' : 'border-gray-100 opacity-40 cursor-not-allowed'}`}>
              <input type="checkbox" checked={options.deleteWorkflow} onChange={() => hasWorkflow && toggle('deleteWorkflow')} disabled={!hasWorkflow} className="mt-0.5 rounded border-gray-300" />
              <div>
                <p className="text-sm font-medium text-gray-900">Knock workflow</p>
                {hasWorkflow ? (
                  <p className="text-xs text-gray-500">{campaign.workflow.knockWorkflowKey}</p>
                ) : (
                  <p className="text-xs text-gray-400">None created</p>
                )}
              </div>
            </label>

            {/* Knock Audience */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${hasAudience ? 'border-gray-200 hover:bg-gray-50 cursor-pointer' : 'border-gray-100 opacity-40 cursor-not-allowed'}`}>
              <input type="checkbox" checked={options.deleteAudience} onChange={() => hasAudience && toggle('deleteAudience')} disabled={!hasAudience} className="mt-0.5 rounded border-gray-300" />
              <div>
                <p className="text-sm font-medium text-gray-900">Knock audience</p>
                {hasAudience ? (
                  <p className="text-xs text-gray-500">{campaign.audience.knockAudienceKey} ({campaign.audience.count} members)</p>
                ) : (
                  <p className="text-xs text-gray-400">Not synced</p>
                )}
              </div>
            </label>

            {/* HubSpot List */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${hasList ? 'border-gray-200 hover:bg-gray-50 cursor-pointer' : 'border-gray-100 opacity-40 cursor-not-allowed'}`}>
              <input type="checkbox" checked={options.deleteHubspotList} onChange={() => hasList && toggle('deleteHubspotList')} disabled={!hasList} className="mt-0.5 rounded border-gray-300" />
              <div>
                <p className="text-sm font-medium text-gray-900">HubSpot list</p>
                {hasList ? (
                  <p className="text-xs text-gray-500">List #{campaign.audience.hubspotListId} ({campaign.audience.count} contacts)</p>
                ) : (
                  <p className="text-xs text-gray-400">None set</p>
                )}
              </div>
            </label>
          </div>
        )}

        {!results && (
          <div className="p-5 border-t border-gray-200 flex items-center justify-between">
            <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!anythingSelected || deleting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {deleting ? 'Deleting...' : `Delete${options.deleteCampaign ? ' & Remove' : ' Selected'}`}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
