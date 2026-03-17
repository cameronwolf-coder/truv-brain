import { useState } from 'react';
import type { Campaign, StageName } from '../../../types/campaign';
import { StageShell } from '../StageShell';

interface StageProps {
  campaign: Campaign;
  onComplete: (stage: StageName, result: Record<string, unknown>) => Promise<void>;
}

export function AudienceStage({ campaign, onComplete }: StageProps) {
  const [query, setQuery] = useState('');
  const [minOpens, setMinOpens] = useState(0);
  const [minClicks, setMinClicks] = useState(0);
  const [excludeCustomers, setExcludeCustomers] = useState(true);
  const [contacts, setContacts] = useState<Array<{ email: string; firstname: string; lastname: string; company: string }>>([]);
  const [totalCount, setTotalCount] = useState(0);

  const pipelineStage = campaign.pipeline.find((s) => s.stage === 'audience');

  const handleExecute = async () => {
    const body: Record<string, unknown> = {
      limit: 100,
      requireTitle: false,
    };

    if (excludeCustomers) {
      body.excludeStages = ['customer', 'opportunity', 'evangelist', 'advocate', 'disqualified'];
    }

    const engagement: Record<string, number> = {};
    if (minOpens > 0) engagement.emailOpensWithin = minOpens;
    if (minClicks > 0) engagement.emailClicksWithin = minClicks;
    if (Object.keys(engagement).length > 0) body.engagement = engagement;

    if (query.trim()) {
      body.verticals = [query.trim()];
    }

    const res = await fetch('/api/search-contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Search failed (${res.status}): ${errText.slice(0, 200)}`);
    }
    const data = await res.json();

    const results = data.contacts || [];

    setContacts(results.slice(0, 20));
    setTotalCount(results.length);

    await onComplete('audience', {
      count: results.length,
      contactIds: results.map((c: { id?: string }) => c.id),
      filterConfig: { filters: [], excludeCustomers },
    });
  };

  return (
    <StageShell
      title="Audience Query"
      description="Search HubSpot for contacts matching your campaign criteria."
      status={pipelineStage?.status || 'idle'}
      confirmLabel="Search HubSpot"
      onExecute={handleExecute}
      error={pipelineStage?.error}
      result={
        totalCount > 0 ? (
          <div>
            <p className="text-sm font-medium text-green-800 mb-3">
              Found {totalCount.toLocaleString()} contacts
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-green-200">
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Company</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.slice(0, 10).map((c, i) => (
                    <tr key={i} className="border-b border-green-100">
                      <td className="py-1.5 text-green-900">{c.email}</td>
                      <td className="py-1.5 text-green-800">{c.firstname} {c.lastname}</td>
                      <td className="py-1.5 text-green-700">{c.company}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalCount > 10 && (
                <p className="text-xs text-green-600 mt-2">Showing 10 of {totalCount}</p>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search (optional)</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Company name, vertical, etc."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Email Opens</label>
            <input type="number" value={minOpens} onChange={(e) => setMinOpens(Number(e.target.value))} min={0} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Email Clicks</label>
            <input type="number" value={minClicks} onChange={(e) => setMinClicks(Number(e.target.value))} min={0} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={excludeCustomers} onChange={(e) => setExcludeCustomers(e.target.checked)} className="rounded border-gray-300" />
          <span className="text-gray-700">Exclude customers, opportunities, and disqualified</span>
        </label>
      </div>
    </StageShell>
  );
}
