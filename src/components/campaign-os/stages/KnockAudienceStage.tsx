import type { Campaign, StageName } from '../../../types/campaign';
import { useState } from 'react';
import { StageShell } from '../StageShell';

interface StageProps {
  campaign: Campaign;
  onComplete: (stage: StageName, result: Record<string, unknown>) => Promise<void>;
}

export function KnockAudienceStage({ campaign, onComplete }: StageProps) {
  const audienceKey = campaign.id;
  const pipelineStage = campaign.pipeline.find((s) => s.stage === 'knock_audience');
  const [memberCount, setMemberCount] = useState(0);

  const handleExecute = async () => {
    const listId = campaign.audience?.hubspotListId;
    if (!listId) throw new Error('No HubSpot list ID — complete the previous stage first.');

    const res = await fetch('/api/campaigns/sync-audience', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: campaign.id }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Sync failed: ${res.status}`);
    }

    const data = await res.json();
    setMemberCount(data.memberCount || campaign.audience?.count || 0);

    await onComplete('knock_audience', {
      audienceKey: data.audienceKey || audienceKey,
      memberCount: data.memberCount || campaign.audience?.count || 0,
    });
  };

  return (
    <StageShell
      title="Push to Knock"
      description="Sync the HubSpot list to Knock as an audience for sending."
      status={pipelineStage?.status || 'idle'}
      confirmLabel="Push Audience"
      onExecute={handleExecute}
      error={pipelineStage?.error}
      result={
        memberCount > 0 ? (
          <div className="text-sm text-green-800">
            <p className="font-medium">Audience synced to Knock</p>
            <p className="mt-1">Key: <code className="bg-green-100 px-1.5 py-0.5 rounded">{audienceKey}</code> &middot; {memberCount} members</p>
          </div>
        ) : undefined
      }
    >
      <div className="text-sm text-gray-600">
        <p>This will push {campaign.audience?.count || 0} contacts from HubSpot list <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{campaign.audience?.hubspotListId}</code> to Knock audience <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{audienceKey}</code>.</p>
        <p className="mt-2 text-gray-500">Uses email as the Knock user ID for cross-campaign compatibility.</p>
      </div>
    </StageShell>
  );
}
