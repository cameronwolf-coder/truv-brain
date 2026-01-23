import { useState, useMemo, useCallback } from 'react';
import { parsePrompt, generateListName, type ParsedFilters } from '../utils/promptParser';
import segments from '../data/segments.json';

interface Contact {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  jobtitle: string;
  company: string;
  lifecyclestage: string;
  lastActivity: string | null;
  vertical: string;
}

interface SearchResult {
  success: boolean;
  contacts: Contact[];
  total: number;
  companies: number;
  personaBreakdown: Record<string, number>;
  error?: string;
}

// Persona labels for display
const PERSONA_LABELS: Record<string, string> = {
  coo: 'COO/Chief Operating',
  cfo: 'CFO/Finance',
  ceo: 'CEO/Founder',
  cto: 'CTO/VP Engineering',
  vp_lending: 'VP Lending',
  vp_underwriting: 'VP Underwriting',
  vp_product: 'VP Product',
  manager: 'Manager/Director',
  other_exec: 'Other Executive',
  other: 'Other',
};

// Default excluded stages
const DEFAULT_EXCLUDE_STAGES = [
  'opportunity',
  'customer',
  '268636562', // Live Customer
  '268636561', // Indirect Customer
  '268798101', // Advocate
  '268636560', // Disqualified
];

export function ListBuilder() {
  // Prompt input
  const [prompt, setPrompt] = useState('');
  const [parsedFilters, setParsedFilters] = useState<ParsedFilters | null>(null);

  // Manual filters
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [selectedVerticals, setSelectedVerticals] = useState<string[]>([]);
  const [excludeStages, setExcludeStages] = useState<string[]>(DEFAULT_EXCLUDE_STAGES);

  // Advanced filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [emailOpensWithin, setEmailOpensWithin] = useState<number | undefined>();
  const [noActivityDays, setNoActivityDays] = useState<number | undefined>();
  const [createdWithinDays, setCreatedWithinDays] = useState<number | undefined>();
  const [companySizeMin, setCompanySizeMin] = useState<number | undefined>();
  const [companySizeMax, setCompanySizeMax] = useState<number | undefined>();
  const [contactLimit, setContactLimit] = useState(500);
  const [requireTitle, setRequireTitle] = useState(true);

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [excludedContactIds, setExcludedContactIds] = useState<Set<string>>(new Set());
  const [excludedCompanies, setExcludedCompanies] = useState<Set<string>>(new Set());

  // List creation state
  const [listName, setListName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ success: boolean; listId?: string; count?: number; error?: string } | null>(null);

  // Parse prompt and populate filters
  const handleParsePrompt = useCallback(() => {
    if (!prompt.trim()) return;

    const parsed = parsePrompt(prompt);
    setParsedFilters(parsed);

    // Populate filters from parsed result
    if (parsed.personas.length > 0) {
      setSelectedPersonas(parsed.personas);
    }
    if (parsed.verticals.length > 0) {
      setSelectedVerticals(parsed.verticals);
    }
    if (parsed.excludeStages.length > 0) {
      setExcludeStages(parsed.excludeStages);
    }
    if (parsed.engagement.emailOpensWithin) {
      setEmailOpensWithin(parsed.engagement.emailOpensWithin);
      setShowAdvanced(true);
    }
    if (parsed.engagement.noActivityDays) {
      setNoActivityDays(parsed.engagement.noActivityDays);
      setShowAdvanced(true);
    }
    if (parsed.timeFilters.createdWithinDays) {
      setCreatedWithinDays(parsed.timeFilters.createdWithinDays);
      setShowAdvanced(true);
    }
    if (parsed.firmographic.companySizeMin) {
      setCompanySizeMin(parsed.firmographic.companySizeMin);
      setShowAdvanced(true);
    }

    // Auto-generate list name
    setListName(generateListName(parsed));
  }, [prompt]);

  // Build filters object for API
  const buildFilters = useCallback(() => {
    return {
      personas: selectedPersonas,
      verticals: selectedVerticals,
      excludeStages,
      engagement: {
        emailOpensWithin,
        noActivityDays,
      },
      firmographic: {
        companySizeMin,
        companySizeMax,
      },
      timeFilters: {
        createdWithinDays,
      },
      limit: contactLimit,
      requireTitle,
    };
  }, [selectedPersonas, selectedVerticals, excludeStages, emailOpensWithin, noActivityDays, createdWithinDays, companySizeMin, companySizeMax, contactLimit, requireTitle]);

  // Search contacts
  const handleSearch = useCallback(async () => {
    setIsSearching(true);
    setSearchResult(null);
    setExcludedContactIds(new Set());
    setExcludedCompanies(new Set());
    setCreateResult(null);

    try {
      const response = await fetch('/api/search-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildFilters()),
      });

      const data = await response.json();
      setSearchResult(data);

      // Generate list name if not set
      if (!listName && parsedFilters) {
        setListName(generateListName(parsedFilters));
      } else if (!listName) {
        const date = new Date().toISOString().split('T')[0];
        setListName(`List - ${date}`);
      }
    } catch (err) {
      setSearchResult({
        success: false,
        contacts: [],
        total: 0,
        companies: 0,
        personaBreakdown: {},
        error: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setIsSearching(false);
    }
  }, [buildFilters, listName, parsedFilters]);

  // Handle prompt submit
  const handlePromptSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleParsePrompt();
    handleSearch();
  }, [handleParsePrompt, handleSearch]);

  // Toggle contact exclusion
  const toggleContactExclusion = useCallback((contactId: string) => {
    setExcludedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  }, []);

  // Exclude all contacts from a company
  const excludeCompany = useCallback((company: string) => {
    if (!searchResult) return;

    setExcludedCompanies(prev => new Set(prev).add(company));

    const companyContactIds = searchResult.contacts
      .filter(c => c.company === company)
      .map(c => c.id);

    setExcludedContactIds(prev => {
      const next = new Set(prev);
      companyContactIds.forEach(id => next.add(id));
      return next;
    });
  }, [searchResult]);

  // Re-include company
  const includeCompany = useCallback((company: string) => {
    if (!searchResult) return;

    setExcludedCompanies(prev => {
      const next = new Set(prev);
      next.delete(company);
      return next;
    });

    const companyContactIds = searchResult.contacts
      .filter(c => c.company === company)
      .map(c => c.id);

    setExcludedContactIds(prev => {
      const next = new Set(prev);
      companyContactIds.forEach(id => next.delete(id));
      return next;
    });
  }, [searchResult]);

  // Get included contacts
  const includedContacts = useMemo(() => {
    if (!searchResult) return [];
    return searchResult.contacts.filter(c => !excludedContactIds.has(c.id));
  }, [searchResult, excludedContactIds]);

  // Get unique companies for exclusion dropdown
  const uniqueCompanies = useMemo(() => {
    if (!searchResult) return [];
    const companies = [...new Set(searchResult.contacts.map(c => c.company).filter(Boolean))];
    return companies.sort();
  }, [searchResult]);

  // Create HubSpot list
  const handleCreateList = useCallback(async () => {
    if (!listName.trim() || includedContacts.length === 0) return;

    setIsCreating(true);
    setCreateResult(null);

    try {
      const response = await fetch('/api/create-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: listName,
          contactIds: includedContacts.map(c => c.id),
        }),
      });

      const data = await response.json();
      setCreateResult(data);
    } catch (err) {
      setCreateResult({
        success: false,
        error: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setIsCreating(false);
    }
  }, [listName, includedContacts]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setPrompt('');
    setParsedFilters(null);
    setSelectedPersonas([]);
    setSelectedVerticals([]);
    setExcludeStages(DEFAULT_EXCLUDE_STAGES);
    setEmailOpensWithin(undefined);
    setNoActivityDays(undefined);
    setCreatedWithinDays(undefined);
    setCompanySizeMin(undefined);
    setCompanySizeMax(undefined);
    setContactLimit(500);
    setRequireTitle(true);
    setSearchResult(null);
    setListName('');
    setCreateResult(null);
  }, []);

  // Toggle persona selection
  const togglePersona = (personaId: string) => {
    setSelectedPersonas(prev =>
      prev.includes(personaId)
        ? prev.filter(p => p !== personaId)
        : [...prev, personaId]
    );
  };

  // Toggle vertical selection
  const toggleVertical = (verticalId: string) => {
    setSelectedVerticals(prev =>
      prev.includes(verticalId)
        ? prev.filter(v => v !== verticalId)
        : [...prev, verticalId]
    );
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">List Builder</h1>
        <p className="text-gray-500 mt-1">
          Build targeted HubSpot lists with natural language or manual filters
        </p>
      </div>

      {/* Natural Language Input */}
      <form onSubmit={handlePromptSubmit} className="mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., mortgage webinar audience, decision makers"
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {parsedFilters && (
              <div className="absolute left-0 right-0 top-full mt-1 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                Interpreted as: <span className="font-medium">{parsedFilters.interpretedAs}</span>
                {parsedFilters.confidence < 0.7 && (
                  <span className="ml-2 text-amber-600">(low confidence - adjust filters if needed)</span>
                )}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
          >
            {isSearching ? 'Searching...' : 'Build List'}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Filters */}
        <div className="space-y-4">
          {/* Quick Segments */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-medium text-gray-900 mb-4">Quick Segments</h2>

            {/* Personas */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">Personas</label>
              <div className="flex flex-wrap gap-2">
                {segments.personas.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => togglePersona(p.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      selectedPersonas.includes(p.id)
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Verticals */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">Verticals</label>
              <div className="flex flex-wrap gap-2">
                {segments.verticals.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => toggleVertical(v.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      selectedVerticals.includes(v.id)
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Exclusions */}
            <div>
              <label className="block text-sm text-gray-600 mb-2">Exclude Lifecycle Stages</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'opportunity', label: 'Opportunity' },
                  { id: 'customer', label: 'Customer' },
                  { id: '268636560', label: 'Disqualified' },
                ].map((stage) => (
                  <label key={stage.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={excludeStages.includes(stage.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setExcludeStages(prev => [...prev, stage.id]);
                        } else {
                          setExcludeStages(prev => prev.filter(s => s !== stage.id));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {stage.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Settings */}
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">Max Contacts</label>
                  <select
                    value={contactLimit}
                    onChange={(e) => setContactLimit(parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                    <option value={750}>750</option>
                    <option value={1000}>1,000</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireTitle}
                      onChange={(e) => setRequireTitle(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Require job title</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">Exclude contacts without titles</p>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900">Advanced Filters</span>
              <span className="text-gray-500">{showAdvanced ? '−' : '+'}</span>
            </button>

            {showAdvanced && (
              <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
                {/* Time-Based */}
                <div className="pt-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Time-Based</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Created within (days)</label>
                      <input
                        type="number"
                        value={createdWithinDays || ''}
                        onChange={(e) => setCreatedWithinDays(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="e.g., 30"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Engagement */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Engagement</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Email opened within (days)</label>
                      <input
                        type="number"
                        value={emailOpensWithin || ''}
                        onChange={(e) => setEmailOpensWithin(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="e.g., 60"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">No activity for (days)</label>
                      <input
                        type="number"
                        value={noActivityDays || ''}
                        onChange={(e) => setNoActivityDays(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="e.g., 90"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Firmographic */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Firmographic</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Company size (min)</label>
                      <input
                        type="number"
                        value={companySizeMin || ''}
                        onChange={(e) => setCompanySizeMin(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="e.g., 50"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Company size (max)</label>
                      <input
                        type="number"
                        value={companySizeMax || ''}
                        onChange={(e) => setCompanySizeMax(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="e.g., 1000"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleClearFilters}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium rounded-lg transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="space-y-4">
          {/* Results Header */}
          {searchResult && searchResult.success && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {searchResult.total} <span className="text-lg font-normal text-gray-500">contacts</span>
                  </p>
                  <p className="text-sm text-gray-500">from {searchResult.companies} companies</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{excludedContactIds.size} excluded</p>
                  <p className="text-sm font-medium text-blue-600">{includedContacts.length} selected</p>
                </div>
              </div>

              {/* Persona Breakdown */}
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(searchResult.personaBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([persona, count]) => (
                    <span key={persona} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                      {PERSONA_LABELS[persona] || persona}: {count}
                    </span>
                  ))}
              </div>

              {/* Exclude by Company */}
              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      excludeCompany(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Exclude by company...</option>
                  {uniqueCompanies
                    .filter(c => !excludedCompanies.has(c))
                    .map(company => (
                      <option key={company} value={company}>{company}</option>
                    ))}
                </select>
              </div>

              {/* Excluded Companies */}
              {excludedCompanies.size > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {[...excludedCompanies].map(company => (
                    <span
                      key={company}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded text-xs"
                    >
                      {company}
                      <button
                        onClick={() => includeCompany(company)}
                        className="hover:text-red-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Contact List */}
          {searchResult && searchResult.success && searchResult.contacts.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="w-10 px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={excludedContactIds.size === 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setExcludedContactIds(new Set());
                            } else {
                              setExcludedContactIds(new Set(searchResult.contacts.map(c => c.id)));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {searchResult.contacts.map((contact) => {
                      const isExcluded = excludedContactIds.has(contact.id);
                      return (
                        <tr
                          key={contact.id}
                          className={isExcluded ? 'bg-gray-50 opacity-50' : 'hover:bg-gray-50'}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={() => toggleContactExclusion(contact.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <p className={`text-sm font-medium ${isExcluded ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                              {contact.firstname} {contact.lastname}
                            </p>
                            <p className="text-xs text-gray-500">{contact.email}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{contact.jobtitle || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{contact.company || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{contact.lastActivity || 'No activity'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No Results */}
          {searchResult && searchResult.success && searchResult.contacts.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-gray-500">No contacts match these criteria.</p>
              <p className="text-sm text-gray-400 mt-1">Try broadening your filters.</p>
            </div>
          )}

          {/* Error */}
          {searchResult && !searchResult.success && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <p className="text-red-800 font-medium">Error searching contacts</p>
              <p className="text-sm text-red-600 mt-1">{searchResult.error}</p>
            </div>
          )}

          {/* Create List */}
          {searchResult && searchResult.success && includedContacts.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-medium text-gray-900 mb-3">Create HubSpot List</h3>

              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1">List Name</label>
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="Enter list name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Success */}
              {createResult?.success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-medium text-green-900">List Created!</p>
                  <p className="text-sm text-green-700 mt-1">
                    {createResult.count} contacts added to "{listName}"
                  </p>
                  <a
                    href={`https://app.hubspot.com/contacts/lists/${createResult.listId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-green-700 hover:text-green-800"
                  >
                    Open in HubSpot →
                  </a>
                </div>
              )}

              {/* Error */}
              {createResult && !createResult.success && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="font-medium text-red-900">Failed to create list</p>
                  <p className="text-sm text-red-600 mt-1">{createResult.error}</p>
                </div>
              )}

              <button
                onClick={handleCreateList}
                disabled={isCreating || !listName.trim()}
                className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                {isCreating ? 'Creating...' : `Create List with ${includedContacts.length} Contacts`}
              </button>
            </div>
          )}

          {/* Empty State */}
          {!searchResult && (
            <div className="bg-gray-50 border border-gray-200 border-dashed rounded-xl p-8 text-center">
              <p className="text-gray-500">Enter a prompt or select filters to preview contacts</p>
              <p className="text-sm text-gray-400 mt-1">
                Try: "mortgage webinar audience, decision makers"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
