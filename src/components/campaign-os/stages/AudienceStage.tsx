import { useState, useEffect } from 'react';
import type { Campaign, StageName } from '../../../types/campaign';
import { StageShell } from '../StageShell';

interface StageProps {
  campaign: Campaign;
  onComplete: (stage: StageName, result: Record<string, unknown>) => Promise<void>;
}

interface HubSpotList {
  id: string;
  name: string;
  type: string;
  size: number;
  updatedAt: string | null;
}

type Mode = 'list' | 'search';

export function AudienceStage({ campaign, onComplete }: StageProps) {
  const [mode, setMode] = useState<Mode>('list');

  // List mode state
  const [lists, setLists] = useState<HubSpotList[]>([]);
  const [listQuery, setListQuery] = useState('');
  const [loadingLists, setLoadingLists] = useState(false);
  const [selectedList, setSelectedList] = useState<HubSpotList | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Search mode state
  const [query, setQuery] = useState('');
  const [minOpens, setMinOpens] = useState(0);
  const [minClicks, setMinClicks] = useState(0);
  const [excludeCustomers, setExcludeCustomers] = useState(true);

  // Shared
  const [contacts, setContacts] = useState<Array<{ email: string; firstname: string; lastname: string; company: string }>>([]);
  const [totalCount, setTotalCount] = useState(0);

  const pipelineStage = campaign.pipeline.find((s) => s.stage === 'audience');

  // Extract list ID from URL or raw input
  const extractListId = (input: string): string | null => {
    // URL format: https://app.hubspot.com/contacts/19933594/lists/9248
    const urlMatch = input.match(/lists\/(\d+)/);
    if (urlMatch) return urlMatch[1];
    // Pure numeric ID
    if (/^\d+$/.test(input.trim())) return input.trim();
    return null;
  };

  // Look up a single list by ID
  const lookupList = async (id: string) => {
    setLookupError(null);
    setLoadingLists(true);
    try {
      const res = await fetch(`/api/campaigns/hubspot-lists?listId=${id}`);
      if (!res.ok) throw new Error(`List ${id} not found`);
      const data = await res.json();
      if (data.list) {
        setSelectedList(data.list);
      } else {
        throw new Error(`List ${id} not found`);
      }
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Lookup failed');
    }
    setLoadingLists(false);
  };

  // Load HubSpot lists
  const loadLists = async () => {
    setLoadingLists(true);
    try {
      const params = listQuery ? `?q=${encodeURIComponent(listQuery)}` : '';
      const res = await fetch(`/api/campaigns/hubspot-lists${params}`);
      if (res.ok) {
        const data = await res.json();
        setLists(data.lists || []);
      }
    } catch { /* ignore */ }
    setLoadingLists(false);
  };

  useEffect(() => {
    if (mode === 'list') loadLists();
  }, [mode]);

  // Handle query changes — check for URL/ID, else debounced search
  useEffect(() => {
    if (mode !== 'list') return;
    const id = extractListId(listQuery);
    if (id) {
      lookupList(id);
      return;
    }
    const timer = setTimeout(loadLists, 300);
    return () => clearTimeout(timer);
  }, [listQuery]);

  const handleExecute = async () => {
    if (mode === 'list') {
      // Use existing list
      if (!selectedList) throw new Error('Select a HubSpot list first');

      await onComplete('audience', {
        count: selectedList.size,
        listId: selectedList.id,
        listName: selectedList.name,
        useExistingList: true,
      });
    } else {
      // Search contacts
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
    }
  };

  return (
    <StageShell
      title="Audience"
      description="Pick an existing HubSpot list or search for contacts."
      status={pipelineStage?.status || 'idle'}
      confirmLabel={mode === 'list' ? 'Use Selected List' : 'Search HubSpot'}
      onExecute={handleExecute}
      error={pipelineStage?.error}
      result={
        (mode === 'list' && selectedList) ? (
          <div className="text-sm text-green-800">
            <p className="font-medium">Using list: {selectedList.name}</p>
            <p className="mt-1">ID: {selectedList.id} &middot; {selectedList.size.toLocaleString()} contacts</p>
          </div>
        ) : totalCount > 0 ? (
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
        {/* Mode toggle */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setMode('list')}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Existing List
          </button>
          <button
            onClick={() => setMode('search')}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'search' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Search Contacts
          </button>
        </div>

        {mode === 'list' ? (
          <div className="space-y-3">
            <div>
              <input
                type="text"
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                placeholder="Search by name, paste a HubSpot list URL, or enter a list ID..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">e.g., "webinar" or https://app.hubspot.com/contacts/.../lists/9248 or just 9248</p>
            </div>

            {lookupError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{lookupError}</div>
            )}

            {loadingLists ? (
              <p className="text-xs text-gray-400 py-4 text-center">Loading lists...</p>
            ) : lists.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No lists found.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {lists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => setSelectedList(list)}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                      selectedList?.id === list.id
                        ? 'bg-blue-50 border-l-2 border-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{list.name}</span>
                      <span className="text-xs text-gray-500">{list.size.toLocaleString()} contacts</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        list.type === 'STATIC' ? 'bg-gray-100 text-gray-600' : 'bg-purple-100 text-purple-600'
                      }`}>{list.type.toLowerCase()}</span>
                      <span className="text-xs text-gray-400">ID: {list.id}</span>
                      {list.updatedAt && (
                        <span className="text-xs text-gray-400">{new Date(list.updatedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedList && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm">
                <p className="font-medium text-blue-800">Selected: {selectedList.name}</p>
                <p className="text-xs text-blue-600 mt-0.5">{selectedList.size.toLocaleString()} contacts &middot; ID: {selectedList.id}</p>
              </div>
            )}
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </StageShell>
  );
}
