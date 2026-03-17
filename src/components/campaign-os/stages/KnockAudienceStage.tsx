import type { Campaign, StageName } from '../../../types/campaign';
import { useState } from 'react';
import { StageShell } from '../StageShell';

interface StageProps {
  campaign: Campaign;
  onComplete: (stage: StageName, result: Record<string, unknown>) => Promise<void>;
}

const KNOCK_WRAPPER_URL = 'https://knock-wrapper.vercel.app';

export function KnockAudienceStage({ campaign, onComplete }: StageProps) {
  const audienceKey = campaign.id;
  const pipelineStage = campaign.pipeline.find((s) => s.stage === 'knock_audience');
  const [memberCount, setMemberCount] = useState(0);

  const handleExecute = async () => {
    const listId = campaign.audience?.hubspotListId;
    if (!listId) throw new Error('No HubSpot list ID — complete the previous stage first.');

    const res = await fetch(`${KNOCK_WRAPPER_URL}/api/audiences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audienceKey, hubspotListId: listId }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Knock audience push failed: ${errText}`);
    }

    const data = await res.json();
    setMemberCount(data.memberCount || campaign.audience?.count || 0);

    await onComplete('knock_audience', {
      audienceKey,
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
