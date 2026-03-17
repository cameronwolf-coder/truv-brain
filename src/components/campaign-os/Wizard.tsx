import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Campaign, StageName } from '../../types/campaign';
import { createCampaign, updateCampaign } from '../../services/campaignClient';
import { AudienceStage } from './stages/AudienceStage';
import { ListStage } from './stages/ListStage';
import { KnockAudienceStage } from './stages/KnockAudienceStage';
import { TemplateStage } from './stages/TemplateStage';
import { WorkflowStage } from './stages/WorkflowStage';

const STAGES: { key: StageName; label: string; number: number }[] = [
  { key: 'audience', label: 'Audience', number: 1 },
  { key: 'list', label: 'HubSpot List', number: 2 },
  { key: 'knock_audience', label: 'Knock Audience', number: 3 },
  { key: 'template', label: 'Template', number: 4 },
  { key: 'workflow', label: 'Workflow & Preset', number: 5 },
];

interface WizardProps {
  onComplete: (campaign: Campaign) => void;
}

export function Wizard({ onComplete }: WizardProps) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [currentStage, setCurrentStage] = useState(0);
  const [campaignName, setCampaignName] = useState('');
  const [channel, setChannel] = useState<'marketing' | 'outreach'>('marketing');

  if (!campaign) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Name your campaign</h3>
          <p className="text-sm text-gray-500 mt-1">This will be used for list names, workflow keys, and presets.</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g., Public Sector Webinar - March 2026"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
            <div className="flex gap-3">
              {(['marketing', 'outreach'] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    channel === ch
                      ? ch === 'marketing' ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {ch === 'marketing' ? 'Marketing (Knock)' : 'Outreach (Smartlead)'}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={async () => {
              if (!campaignName.trim()) return;
              const c = await createCampaign({ name: campaignName, channel });
              setCampaign(c);
            }}
            disabled={!campaignName.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Start Building
          </button>
        </div>
      </div>
    );
  }

  const handleStageComplete = async (stageKey: StageName, result: Record<string, unknown>) => {
    const updatedPipeline = campaign.pipeline.map((s) =>
      s.stage === stageKey ? { ...s, status: 'success' as const, result, completedAt: new Date().toISOString() } : s
    );

    const updates: Partial<Campaign> = { pipeline: updatedPipeline };

    if (stageKey === 'audience' && result.count) {
      if (result.useExistingList && result.listId) {
        // Existing list selected — skip list creation stage, mark it done too
        updates.audience = { ...campaign.audience, count: result.count as number, hubspotListId: result.listId as string };
        updates.status = 'building';
        const listStageUpdate = updatedPipeline.map((s) =>
          s.stage === 'list' ? { ...s, status: 'success' as const, result: { listId: result.listId, listName: result.listName, contactCount: result.count, skipped: true }, completedAt: new Date().toISOString() } : s
        );
        updates.pipeline = listStageUpdate;
      } else {
        updates.audience = { ...campaign.audience, count: result.count as number, hubspotListId: '' };
      }
    }
    if (stageKey === 'list' && result.listId) {
      updates.audience = { ...campaign.audience, hubspotListId: result.listId as string };
      updates.status = 'building';
    }
    if (stageKey === 'knock_audience' && result.audienceKey) {
      updates.audience = { ...campaign.audience, knockAudienceKey: result.audienceKey as string };
    }
    if (stageKey === 'template' && result.templateId) {
      updates.template = { sendgridTemplateId: result.templateId as string, name: result.templateName as string || '' };
    }
    if (stageKey === 'workflow' && result.workflowKey) {
      updates.workflow = { knockWorkflowKey: result.workflowKey as string };
      if (result.presetKey) {
        updates.preset = { key: result.presetKey as string, batchSize: 245, delayMinutes: 4 };
      }
      updates.status = 'ready';
    }

    const updated = await updateCampaign(campaign.id, updates);
    setCampaign(updated);

    // Auto-advance — skip stage 2 (list) if existing list was used
    let nextStage = currentStage + 1;
    if (stageKey === 'audience' && result.useExistingList && nextStage === 1) {
      nextStage = 2; // jump to Knock Audience (stage index 2)
    }
    if (nextStage < STAGES.length) {
      setCurrentStage(nextStage);
    }
  };

  const stageProps = {
    campaign,
    onComplete: handleStageComplete,
  };

  return (
    <div className="flex gap-8">
      <div className="w-48 flex-shrink-0">
        <div className="space-y-1">
          {STAGES.map((stage, i) => {
            const pipelineStage = campaign.pipeline.find((s) => s.stage === stage.key);
            const isComplete = pipelineStage?.status === 'success';
            const isCurrent = i === currentStage;
            const isError = pipelineStage?.status === 'error';

            return (
              <button
                key={stage.key}
                onClick={() => i <= currentStage && setCurrentStage(i)}
                disabled={i > currentStage && !isComplete}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isCurrent
                    ? 'bg-blue-50 text-blue-700'
                    : isComplete
                      ? 'text-green-700 hover:bg-green-50'
                      : isError
                        ? 'text-red-700 hover:bg-red-50'
                        : 'text-gray-400'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isComplete ? 'bg-green-100 text-green-700' :
                  isCurrent ? 'bg-blue-100 text-blue-700' :
                  isError ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {isComplete ? '✓' : stage.number}
                </span>
                {stage.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {currentStage === 0 && <AudienceStage {...stageProps} />}
            {currentStage === 1 && <ListStage {...stageProps} />}
            {currentStage === 2 && <KnockAudienceStage {...stageProps} />}
            {currentStage === 3 && <TemplateStage {...stageProps} />}
            {currentStage === 4 && (
              <WorkflowStage {...stageProps} onCampaignReady={(c) => onComplete(c)} />
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 pt-4 border-t border-gray-200 flex items-center gap-4 text-sm text-gray-500">
          <span>Stage {currentStage + 1} of {STAGES.length}</span>
          {campaign.audience?.count > 0 && (
            <span>~{campaign.audience.count.toLocaleString()} contacts</span>
          )}
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            channel === 'marketing' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
          }`}>
            {channel === 'marketing' ? 'Marketing' : 'Outreach'}
          </span>
        </div>
      </div>
    </div>
  );
}
