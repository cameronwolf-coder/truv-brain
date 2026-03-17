import { useState } from 'react';
import type { Campaign, StageName } from '../../../types/campaign';
import { StageShell } from '../StageShell';

const KNOCK_WRAPPER_URL = 'https://knock-wrapper.vercel.app';

interface StageProps {
  campaign: Campaign;
  onComplete: (stage: StageName, result: Record<string, unknown>) => Promise<void>;
  onCampaignReady: (campaign: Campaign) => void;
}

export function WorkflowStage({ campaign, onComplete, onCampaignReady }: StageProps) {
  const [senderEmail, setSenderEmail] = useState('insights@email.truv.com');
  const [senderName, setSenderName] = useState('Truv');
  const [asmGroupId, setAsmGroupId] = useState(29127);
  const [batchSize, setBatchSize] = useState(245);
  const [delayMinutes, setDelayMinutes] = useState(4);
  const pipelineStage = campaign.pipeline.find((s) => s.stage === 'workflow');

  const workflowKey = campaign.id;
  const presetKey = campaign.id;

  const handleExecute = async () => {
    if (!campaign.template?.sendgridTemplateId) throw new Error('No template selected — complete the previous stage first.');
    if (!campaign.audience?.knockAudienceKey) throw new Error('No Knock audience — complete stage 3 first.');

    const res = await fetch(`${KNOCK_WRAPPER_URL}/api/presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: presetKey,
        name: campaign.name,
        workflowKey,
        audienceKey: campaign.audience.knockAudienceKey,
        communicationType: campaign.channel,
        batchSize,
        delayMinutes,
        senderEmail,
        senderName,
        asmGroupId,
        templateId: campaign.template.sendgridTemplateId,
        createdBy: 'campaign-os',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Preset creation failed: ${errText}`);
    }

    await onComplete('workflow', { workflowKey, presetKey, senderEmail, senderName, asmGroupId });
    onCampaignReady(campaign);
  };

  return (
    <StageShell
      title="Workflow & Preset"
      description="Create the Knock workflow and Drip Sender preset for this campaign."
      status={pipelineStage?.status || 'idle'}
      confirmLabel="Create Workflow & Preset"
      onExecute={handleExecute}
      error={pipelineStage?.error}
      result={
        pipelineStage?.result ? (
          <div className="text-sm text-green-800 space-y-2">
            <p className="font-medium">Campaign ready to send</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Workflow: <code className="bg-green-100 px-1 rounded">{workflowKey}</code></div>
              <div>Preset: <code className="bg-green-100 px-1 rounded">{presetKey}</code></div>
              <div>Sender: {senderName} &lt;{senderEmail}&gt;</div>
              <div>ASM: {asmGroupId}</div>
            </div>
            <div className="flex gap-2 mt-3">
              <a href={`https://dashboard.knock.app/truvhq/development/workflows/${workflowKey}`} target="_blank" rel="noopener noreferrer" className="text-green-600 underline text-xs">Knock workflow ↗</a>
              <a href="https://knock-wrapper.vercel.app" target="_blank" rel="noopener noreferrer" className="text-green-600 underline text-xs">Drip Sender ↗</a>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sender Email</label>
            <input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sender Name</label>
            <input type="text" value={senderName} onChange={(e) => setSenderName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ASM Unsubscribe Group</label>
          <select value={asmGroupId} onChange={(e) => setAsmGroupId(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value={29127}>29127 -- Marketing Communications</option>
            <option value={29746}>29746 -- Product Changelog</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Batch Size</label>
            <input type="number" value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} min={1} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delay (minutes)</label>
            <input type="number" value={delayMinutes} onChange={(e) => setDelayMinutes(Number(e.target.value))} min={1} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>
    </StageShell>
  );
}
