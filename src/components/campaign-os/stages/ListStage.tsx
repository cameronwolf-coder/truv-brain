import { useState } from 'react';
import type { Campaign, StageName } from '../../../types/campaign';
import { StageShell } from '../StageShell';

interface StageProps {
  campaign: Campaign;
  onComplete: (stage: StageName, result: Record<string, unknown>) => Promise<void>;
}

export function ListStage({ campaign, onComplete }: StageProps) {
  const [listName, setListName] = useState(campaign.name);
  const pipelineStage = campaign.pipeline.find((s) => s.stage === 'list');

  const handleExecute = async () => {
    const contactIds = (campaign.pipeline.find((s) => s.stage === 'audience')?.result?.contactIds as string[]) || [];

    const res = await fetch('/api/list-builder/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: listName, contactIds }),
    });

    if (!res.ok) throw new Error(`List creation failed: ${res.status}`);
    const data = await res.json();

    await onComplete('list', {
      listId: data.listId || data.list?.listId,
      listName,
      contactCount: contactIds.length,
    });
  };

  return (
    <StageShell
      title="Create HubSpot List"
      description="Create a static list in HubSpot with the matched contacts."
      status={pipelineStage?.status || 'idle'}
      confirmLabel="Create List"
      onExecute={handleExecute}
      error={pipelineStage?.error}
      result={
        pipelineStage?.result ? (
          <div className="text-sm text-green-800">
            <p className="font-medium">List created: {listName}</p>
            <p className="mt-1">ID: {String(pipelineStage.result.listId)} &middot; {String(pipelineStage.result.contactCount)} contacts</p>
            <a href={`https://app.hubspot.com/contacts/19933594/lists/${pipelineStage.result.listId}`} target="_blank" rel="noopener noreferrer" className="text-green-600 underline mt-1 inline-block">View in HubSpot ↗</a>
          </div>
        ) : undefined
      }
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">List Name</label>
        <input type="text" value={listName} onChange={(e) => setListName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <p className="text-xs text-gray-500 mt-1">Will add {campaign.audience?.count || 0} contacts to this list.</p>
      </div>
    </StageShell>
  );
}
