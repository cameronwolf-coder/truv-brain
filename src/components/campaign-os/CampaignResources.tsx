import { useState, useEffect } from 'react';
import type { Campaign } from '../../types/campaign';

interface Recipient {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  title: string | null;
}

interface CampaignResourcesProps {
  campaign: Campaign;
}

export function CampaignResources({ campaign }: CampaignResourcesProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);

  useEffect(() => {
    fetch(`/api/campaigns/${campaign.id}/recipients`)
      .then((r) => r.json())
      .then((data) => setRecipients(data.recipients || []))
      .catch(() => {})
      .finally(() => setLoadingRecipients(false));
  }, [campaign.id]);

  const hubspotListId = campaign.audience?.hubspotListId;
  const knockAudienceKey = campaign.audience?.knockAudienceKey;
  const templateId = campaign.template?.sendgridTemplateId;
  const templateName = campaign.template?.name;
  const workflowKey = campaign.workflow?.knockWorkflowKey;
  const presetKey = campaign.preset?.key;

  const nextSend = (campaign.sends || [])
    .filter((s) => s.status === 'scheduled')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Campaign Resources</h3>
      </div>

      <div className="p-4 space-y-5">
        {/* Resource Links Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* HubSpot List */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">HubSpot List</p>
            {hubspotListId ? (
              <div>
                <a
                  href={`https://app.hubspot.com/contacts/19933594/lists/${hubspotListId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  List #{hubspotListId} ↗
                </a>
                <p className="text-xs text-gray-500 mt-0.5">{campaign.audience?.count || 0} contacts</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Not created</p>
            )}
          </div>

          {/* Knock Audience */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Knock Audience</p>
            {knockAudienceKey ? (
              <div>
                <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{knockAudienceKey}</code>
                <p className="text-xs text-gray-500 mt-0.5">{recipients.length || campaign.audience?.count || 0} members</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Not synced</p>
            )}
          </div>

          {/* SendGrid Template */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">SendGrid Template</p>
            {templateId ? (
              <div>
                <a
                  href={`https://mc.sendgrid.com/dynamic-templates/${templateId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  {templateName || templateId} ↗
                </a>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{templateId}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Not selected</p>
            )}
          </div>

          {/* Knock Workflow */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Knock Workflow</p>
            {workflowKey ? (
              <div>
                <a
                  href={`https://dashboard.knock.app/truvhq/development/workflows/${workflowKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  {workflowKey} ↗
                </a>
                {presetKey && (
                  <p className="text-xs text-gray-500 mt-0.5">Preset: <code className="bg-gray-100 px-1 rounded">{presetKey}</code></p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Not created</p>
            )}
          </div>
        </div>

        {/* Next Scheduled Send */}
        {nextSend && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className="text-blue-600">⏳</span>
              <div>
                <p className="text-sm font-medium text-blue-800">Next send: {nextSend.name}</p>
                <p className="text-xs text-blue-600">
                  {new Date(nextSend.scheduledAt).toLocaleString()} · {nextSend.recipientCount || campaign.audience?.count || 0} recipients
                  {nextSend.audienceFilter?.type !== 'all' && ` · ${nextSend.audienceFilter.type.replace('_', '-')}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline Status */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Pipeline Status</p>
          <div className="flex gap-1">
            {(campaign.pipeline || []).map((stage) => (
              <div key={stage.stage} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${
                  stage.status === 'success' ? 'bg-green-500' :
                  stage.status === 'error' ? 'bg-red-500' :
                  stage.status === 'executing' ? 'bg-yellow-500' :
                  'bg-gray-300'
                }`} />
                <span className={`text-xs ${
                  stage.status === 'success' ? 'text-green-700' :
                  stage.status === 'error' ? 'text-red-700' :
                  'text-gray-400'
                }`}>{stage.stage.replace('_', ' ')}</span>
                {stage !== campaign.pipeline[campaign.pipeline.length - 1] && (
                  <span className="text-gray-300 text-xs mx-0.5">→</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recipient Preview */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Recipients {recipients.length > 0 && `(${recipients.length})`}
          </p>
          {loadingRecipients ? (
            <p className="text-xs text-gray-400">Loading recipients...</p>
          ) : recipients.length === 0 ? (
            <p className="text-xs text-gray-400">No recipients found in Knock audience.</p>
          ) : (
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-3 py-1.5 text-left font-medium">Email</th>
                    <th className="px-3 py-1.5 text-left font-medium">Name</th>
                    <th className="px-3 py-1.5 text-left font-medium">Company</th>
                    <th className="px-3 py-1.5 text-left font-medium">Title</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recipients.slice(0, 20).map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-900">{r.email}</td>
                      <td className="px-3 py-1.5 text-gray-700">{r.name || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.company || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.title || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recipients.length > 20 && (
                <div className="px-3 py-1.5 bg-gray-50 text-xs text-gray-500 border-t border-gray-100">
                  Showing 20 of {recipients.length}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
