import { useState, useEffect } from 'react';
import type { Campaign, StageName, BuildingBlock, TemplateConfig } from '../../../types/campaign';
import { StageShell } from '../StageShell';
import { listBlocks } from '../../../services/campaignClient';

interface StageProps {
  campaign: Campaign;
  onComplete: (stage: StageName, result: Record<string, unknown>) => Promise<void>;
}

export function TemplateStage({ campaign, onComplete }: StageProps) {
  const [templateId, setTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<BuildingBlock[]>([]);
  const pipelineStage = campaign.pipeline.find((s) => s.stage === 'template');

  useEffect(() => {
    listBlocks('template').then(setSavedTemplates).catch(() => {});
  }, []);

  const loadFromBlock = (block: BuildingBlock) => {
    const config = block.config as TemplateConfig;
    setTemplateId(config.sendgridTemplateId);
    setTemplateName(block.name);
  };

  const handleExecute = async () => {
    if (!templateId.trim()) throw new Error('Enter a SendGrid template ID');

    const res = await fetch(`/api/email-template-preview?templateId=${templateId}`);
    if (!res.ok) throw new Error(`Template ${templateId} not found or invalid`);
    const data = await res.json();

    await onComplete('template', {
      templateId,
      templateName: templateName || data.name || templateId,
      subject: data.subject || '',
    });
  };

  return (
    <StageShell
      title="Email Template"
      description="Select the SendGrid template to use for this campaign."
      status={pipelineStage?.status || 'idle'}
      confirmLabel="Confirm Template"
      onExecute={handleExecute}
      error={pipelineStage?.error}
      result={
        pipelineStage?.result ? (
          <div className="text-sm text-green-800">
            <p className="font-medium">{templateName || 'Template selected'}</p>
            <p className="mt-1">SendGrid ID: <code className="bg-green-100 px-1.5 py-0.5 rounded">{templateId}</code></p>
            <a href={`https://mc.sendgrid.com/dynamic-templates/${templateId}`} target="_blank" rel="noopener noreferrer" className="text-green-600 underline mt-1 inline-block">View in SendGrid ↗</a>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {savedTemplates.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Library</label>
            <div className="flex flex-wrap gap-2">
              {savedTemplates.map((block) => (
                <button key={block.id} onClick={() => loadFromBlock(block)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors">{block.name}</button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
          <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g., Webinar Invite - Dark Hero" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SendGrid Template ID</label>
          <input type="text" value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder="d-abc123..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
    </StageShell>
  );
}
