import { useState, useCallback, useEffect, useMemo } from 'react';

interface Filter {
  propertyName: string;
  operator: string;
  value?: string;
  values?: string[];
}

interface Clarification {
  id: string;
  question: string;
  options: string[];
}

interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  options?: Array<{ value: string; label: string }>;
}

interface HubSpotRecord {
  id: string;
  properties: Record<string, string>;
}

interface SearchResult {
  records: HubSpotRecord[];
  total: number;
  summary: {
    byProperty: Record<string, Record<string, number>>;
    dateRange: { oldest: string | null; newest: string | null };
  };
}

type Step = 'query' | 'clarify' | 'preview' | 'complete';

export function SmartListBuilder() {
  const [step, setStep] = useState<Step>('query');
  const [query, setQuery] = useState('');
  const [objectType, setObjectType] = useState<'companies' | 'contacts' | 'deals'>('companies');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse results
  const [filters, setFilters] = useState<Filter[]>([]);
  const [suggestedName, setSuggestedName] = useState('');
  const [canBeActiveList, setCanBeActiveList] = useState(true);
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [clarificationResponses, setClarificationResponses] = useState<Record<string, string>>({});

  // Properties for filter editing
  const [properties, setProperties] = useState<HubSpotProperty[]>([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [propertiesError, setPropertiesError] = useState<string | null>(null);

  // Filter editing state
  const [isEditingFilters, setIsEditingFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filter[]>([]);

  // Search results
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

  // List creation
  const [listName, setListName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [createdList, setCreatedList] = useState<{ listId: string; listUrl: string; listType: string } | null>(null);

  // Export
  const [isExporting, setIsExporting] = useState(false);
  const [exportedSheet, setExportedSheet] = useState<{ sheetUrl: string } | null>(null);

  const propertyByName = useMemo(() => {
    return properties.reduce<Record<string, HubSpotProperty>>((acc, prop) => {
      acc[prop.name] = prop;
      return acc;
    }, {});
  }, [properties]);

  const getPropertyLabel = useCallback((propertyName: string) => {
    return propertyByName[propertyName]?.label || propertyName;
  }, [propertyByName]);

  const getDefaultOperator = useCallback((property?: HubSpotProperty) => {
    if (!property) return 'EQ';
    if (property.type === 'enumeration') return 'EQ';
    return 'EQ';
  }, []);

  const getOperatorOptions = useCallback((property?: HubSpotProperty) => {
    const base = ['HAS_PROPERTY', 'NOT_HAS_PROPERTY'];
    if (!property) {
      return ['EQ', 'NEQ', 'IN', 'NOT_IN', 'CONTAINS', 'NOT_CONTAINS', 'GT', 'GTE', 'LT', 'LTE', ...base];
    }

    if (property.type === 'enumeration') {
      return ['EQ', 'NEQ', 'IN', 'NOT_IN', ...base];
    }

    if (property.type === 'number') {
      return ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', ...base];
    }

    if (property.type === 'date' || property.fieldType === 'date') {
      return ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', ...base];
    }

    if (property.type === 'bool' || property.fieldType === 'booleancheckbox') {
      return ['EQ', 'NEQ', ...base];
    }

    return ['EQ', 'NEQ', 'CONTAINS', 'NOT_CONTAINS', 'IN', 'NOT_IN', ...base];
  }, []);

  const formatFilterValue = useCallback((filter: Filter) => {
    if (filter.operator === 'HAS_PROPERTY') return 'has value';
    if (filter.operator === 'NOT_HAS_PROPERTY') return 'missing';
    if (filter.values && filter.values.length > 0) return filter.values.join(', ');
    if (filter.value !== undefined && filter.value !== '') return filter.value;
    return '—';
  }, []);

  const isFilterComplete = useCallback((filter: Filter) => {
    if (!filter.propertyName || !filter.operator) return false;
    if (filter.operator === 'HAS_PROPERTY' || filter.operator === 'NOT_HAS_PROPERTY') return true;
    if (filter.operator === 'IN' || filter.operator === 'NOT_IN') {
      return (filter.values || []).length > 0;
    }
    return !!filter.value;
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingProperties(true);
    setPropertiesError(null);

    fetch(`/api/list-builder/properties?objectType=${objectType}`)
      .then((response) => response.json())
      .then((data) => {
        if (!isMounted) return;
        if (!data.success) {
          setPropertiesError(data.error || 'Failed to load properties');
          setProperties([]);
          return;
        }
        setProperties(data.properties || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        setPropertiesError(err instanceof Error ? err.message : 'Failed to load properties');
        setProperties([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingProperties(false);
      });

    return () => {
      isMounted = false;
    };
  }, [objectType]);

  const handleSearch = useCallback(async (searchFilters: Filter[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/list-builder/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectType,
          filters: searchFilters,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Search failed');
        return;
      }

      setSearchResult({
        records: data.records,
        total: data.total,
        summary: data.summary,
      });
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsLoading(false);
    }
  }, [objectType]);

  const handleParse = useCallback(async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/list-builder/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          objectType,
          clarificationResponse: Object.keys(clarificationResponses).length > 0 ? clarificationResponses : undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to parse query');
        setIsLoading(false);
        return;
      }

      if (data.resolved) {
        setFilters(data.filters || []);
        setSuggestedName(data.suggestedName || '');
        setListName(data.suggestedName || '');
        setCanBeActiveList(data.canBeActiveList !== false);
        setClarifications([]);
        setIsEditingFilters(false);
        setDraftFilters([]);

        // Now search
        await handleSearch(data.filters);
      } else {
        setClarifications(data.clarifications || []);
        setStep('clarify');
        setIsLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setIsLoading(false);
    }
  }, [query, objectType, clarificationResponses, handleSearch]);

  const handleClarificationSubmit = useCallback(() => {
    // Check all clarifications have responses
    for (const c of clarifications) {
      if (!clarificationResponses[c.id]) {
        setError('Please answer all questions');
        return;
      }
    }
    handleParse();
  }, [clarifications, clarificationResponses, handleParse]);

  const handleExportToSheets = useCallback(async () => {
    if (!searchResult) return;

    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch('/api/list-builder/export-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: searchResult.records,
          name: listName || suggestedName,
          objectType,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Export failed');
        return;
      }

      setExportedSheet({ sheetUrl: data.sheetUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsExporting(false);
    }
  }, [searchResult, listName, suggestedName, objectType]);

  const handleCreateList = useCallback(async (type: 'static' | 'active') => {
    if (!searchResult || !listName.trim()) return;

    setIsCreatingList(true);
    setError(null);

    try {
      const body: {
        name: string;
        objectType: string;
        listType: 'static' | 'active';
        recordIds?: string[];
        filters?: Filter[];
      } = {
        name: listName,
        objectType,
        listType: type,
      };

      if (type === 'static') {
        body.recordIds = searchResult.records.map((r) => r.id);
      } else {
        body.filters = filters;
      }

      const response = await fetch('/api/list-builder/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to create list');
        return;
      }

      setCreatedList({ listId: data.listId, listUrl: data.listUrl, listType: data.listType });
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsCreatingList(false);
    }
  }, [searchResult, listName, objectType, filters]);

  const handleReset = () => {
    setStep('query');
    setQuery('');
    setFilters([]);
    setSuggestedName('');
    setCanBeActiveList(true);
    setClarifications([]);
    setClarificationResponses({});
    setSearchResult(null);
    setListName('');
    setCreatedList(null);
    setExportedSheet(null);
    setError(null);
    setIsEditingFilters(false);
    setDraftFilters([]);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Smart List Builder</h1>
            <p className="text-gray-500 mt-1">
              Describe what you need in plain English
            </p>
          </div>
          {step !== 'query' && (
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Start Over
            </button>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Step 1: Query Input */}
      {step === 'query' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Object Type
            </label>
            <div className="flex gap-2">
              {(['companies', 'contacts', 'deals'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setObjectType(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    objectType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Describe what you need
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., All government companies in California, Texas, and New York"
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleParse}
              disabled={!query.trim() || isLoading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
            >
              {isLoading ? 'Processing...' : 'Build Query'}
            </button>
          </div>

          {/* Example queries */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-3">Example queries:</p>
            <div className="flex flex-wrap gap-2">
              {[
                'All government companies in California',
                'Contacts with lifecycle stage lead',
                'Companies missing a state value',
                'Deals created in the last 30 days',
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => setQuery(example)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Clarifications */}
      {step === 'clarify' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            A few clarifying questions
          </h2>

          <div className="space-y-6">
            {clarifications.map((c) => (
              <div key={c.id}>
                <p className="text-sm font-medium text-gray-700 mb-2">{c.question}</p>
                <div className="flex flex-wrap gap-2">
                  {c.options.map((option) => (
                    <button
                      key={option}
                      onClick={() =>
                        setClarificationResponses((prev) => ({ ...prev, [c.id]: option }))
                      }
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        clarificationResponses[c.id] === option
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={() => {
                setStep('query');
                setClarifications([]);
                setClarificationResponses({});
              }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleClarificationSubmit}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
            >
              {isLoading ? 'Processing...' : 'Continue'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && searchResult && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-medium text-gray-900">Results Preview</h2>
                {!isEditingFilters && (
                  <button
                    onClick={() => {
                      setDraftFilters(filters.map((f) => ({ ...f })));
                      setIsEditingFilters(true);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Edit Filters
                  </button>
                )}
              </div>
              <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {searchResult.total.toLocaleString()} {objectType}
              </span>
            </div>

            {/* Applied Filters */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Applied Filters:</p>
                {!isEditingFilters && (
                  <button
                    onClick={() => {
                      setDraftFilters(filters.map((f) => ({ ...f })));
                      setIsEditingFilters(true);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Edit Filters
                  </button>
                )}
              </div>

              {!isEditingFilters && (
                <div className="flex flex-wrap gap-2">
                  {filters.map((f, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-white border border-gray-200 rounded text-sm text-gray-700"
                    >
                      {getPropertyLabel(f.propertyName)} {f.operator} {formatFilterValue(f)}
                    </span>
                  ))}
                </div>
              )}

              {isEditingFilters && (
                <div className="space-y-3">
                  {propertiesError && (
                    <div className="text-xs text-red-600">{propertiesError}</div>
                  )}
                  {isLoadingProperties && (
                    <div className="text-xs text-gray-500">Loading properties...</div>
                  )}

                  <div className="space-y-2">
                    {draftFilters.map((filter, index) => {
                      const property = propertyByName[filter.propertyName];
                      const operatorOptions = getOperatorOptions(property);
                      const isEnum = property?.type === 'enumeration' && (property.options?.length || 0) > 0;
                      const showMulti = filter.operator === 'IN' || filter.operator === 'NOT_IN';
                      const needsValue = filter.operator !== 'HAS_PROPERTY' && filter.operator !== 'NOT_HAS_PROPERTY';

                      return (
                        <div key={`${filter.propertyName}-${index}`} className="grid grid-cols-12 gap-2 items-center">
                          <select
                            value={filter.propertyName}
                            onChange={(event) => {
                              const nextPropertyName = event.target.value;
                              const nextProperty = propertyByName[nextPropertyName];
                              const nextOperator = getDefaultOperator(nextProperty);

                              setDraftFilters((prev) =>
                                prev.map((item, idx) =>
                                  idx === index
                                    ? {
                                      ...item,
                                      propertyName: nextPropertyName,
                                      operator: nextOperator,
                                      value: undefined,
                                      values: undefined,
                                    }
                                    : item
                                )
                              );
                            }}
                            className="col-span-4 px-2 py-2 border border-gray-300 rounded text-sm"
                          >
                            <option value="">Select property</option>
                            {properties.map((prop) => (
                              <option key={prop.name} value={prop.name}>
                                {prop.label || prop.name}
                              </option>
                            ))}
                          </select>

                          <select
                            value={filter.operator}
                            onChange={(event) => {
                              const nextOperator = event.target.value;
                              setDraftFilters((prev) =>
                                prev.map((item, idx) =>
                                  idx === index
                                    ? {
                                      ...item,
                                      operator: nextOperator,
                                      value: undefined,
                                      values: undefined,
                                    }
                                    : item
                                )
                              );
                            }}
                            className="col-span-3 px-2 py-2 border border-gray-300 rounded text-sm"
                          >
                            {operatorOptions.map((op) => (
                              <option key={op} value={op}>
                                {op}
                              </option>
                            ))}
                          </select>

                          <div className="col-span-4">
                            {!needsValue && (
                              <div className="px-2 py-2 text-xs text-gray-500">No value</div>
                            )}

                            {needsValue && isEnum && !showMulti && (
                              <select
                                value={filter.value || ''}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  setDraftFilters((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index
                                        ? { ...item, value: nextValue, values: undefined }
                                        : item
                                    )
                                  );
                                }}
                                className="w-full px-2 py-2 border border-gray-300 rounded text-sm"
                              >
                                <option value="">Select value</option>
                                {property?.options?.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            )}

                            {needsValue && isEnum && showMulti && (
                              <select
                                multiple
                                value={filter.values || []}
                                onChange={(event) => {
                                  const selected = Array.from(event.target.selectedOptions).map((opt) => opt.value);
                                  setDraftFilters((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index
                                        ? { ...item, values: selected, value: undefined }
                                        : item
                                    )
                                  );
                                }}
                                className="w-full px-2 py-2 border border-gray-300 rounded text-sm h-24"
                              >
                                {property?.options?.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            )}

                            {needsValue && !isEnum && showMulti && (
                              <input
                                type="text"
                                value={(filter.values || []).join(', ')}
                                onChange={(event) => {
                                  const nextValues = event.target.value
                                    .split(',')
                                    .map((v) => v.trim())
                                    .filter(Boolean);

                                  setDraftFilters((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index
                                        ? { ...item, values: nextValues, value: undefined }
                                        : item
                                    )
                                  );
                                }}
                                placeholder="Comma-separated values"
                                className="w-full px-2 py-2 border border-gray-300 rounded text-sm"
                              />
                            )}

                            {needsValue && !isEnum && !showMulti && (
                              <input
                                type="text"
                                value={filter.value || ''}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  setDraftFilters((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index
                                        ? { ...item, value: nextValue, values: undefined }
                                        : item
                                    )
                                  );
                                }}
                                placeholder="Value"
                                className="w-full px-2 py-2 border border-gray-300 rounded text-sm"
                              />
                            )}
                          </div>

                          <button
                            onClick={() =>
                              setDraftFilters((prev) => prev.filter((_, idx) => idx !== index))
                            }
                            className="col-span-1 text-xs text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const defaultProperty = properties[0];
                        setDraftFilters((prev) => [
                          ...prev,
                          {
                            propertyName: defaultProperty?.name || '',
                            operator: getDefaultOperator(defaultProperty),
                            value: undefined,
                            values: undefined,
                          },
                        ]);
                      }}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm"
                    >
                      Add Filter
                    </button>

                    <button
                      onClick={() => {
                        setIsEditingFilters(false);
                        setDraftFilters([]);
                      }}
                      className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={async () => {
                        const nextFilters = draftFilters.map((f) => ({
                          ...f,
                          value: f.value?.trim(),
                          values: f.values?.filter(Boolean),
                        }));

                        setFilters(nextFilters);
                        setIsEditingFilters(false);
                        setDraftFilters([]);
                        await handleSearch(nextFilters);
                      }}
                      disabled={
                        draftFilters.length === 0 ||
                        draftFilters.some((filter) => !isFilterComplete(filter))
                      }
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg text-sm"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              {Object.entries(searchResult.summary.byProperty).map(([prop, values]) => (
                <div key={prop} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                    {prop.replace(/_/g, ' ')}
                  </p>
                  <div className="space-y-1">
                    {Object.entries(values)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([value, count]) => (
                        <div key={value} className="flex justify-between text-sm">
                          <span className="text-gray-700 truncate">{value || 'Unknown'}</span>
                          <span className="text-gray-500 ml-2">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Date Range</p>
                <p className="text-sm text-gray-700">
                  {formatDate(searchResult.summary.dateRange.oldest)} → {formatDate(searchResult.summary.dateRange.newest)}
                </p>
              </div>
            </div>

            {/* Sample Records */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Sample Records ({Math.min(15, searchResult.records.length)} of {searchResult.total})
              </p>
              <div className="max-h-64 overflow-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      {objectType === 'contacts' && (
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Email
                        </th>
                      )}
                      {filters.slice(0, 2).map((f) => (
                        <th
                          key={f.propertyName}
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                        >
                          {f.propertyName.replace(/_/g, ' ')}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Modified
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {searchResult.records.slice(0, 15).map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">
                          {objectType === 'contacts'
                            ? `${record.properties.firstname || ''} ${record.properties.lastname || ''}`.trim() || '—'
                            : record.properties.name || record.properties.dealname || '—'}
                        </td>
                        {objectType === 'contacts' && (
                          <td className="px-3 py-2 text-gray-600">
                            {record.properties.email || '—'}
                          </td>
                        )}
                        {filters.slice(0, 2).map((f) => (
                          <td key={f.propertyName} className="px-3 py-2 text-gray-600">
                            {record.properties[f.propertyName] || '—'}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-gray-500">
                          {formatDate(record.properties.lastmodifieddate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Actions Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-medium text-gray-900 mb-4">Create List</h3>

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

            {/* Exported Sheet Link */}
            {exportedSheet && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">
                  Exported to Google Sheets:{' '}
                  <a
                    href={exportedSheet.sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    Open Sheet
                  </a>
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleExportToSheets}
                disabled={isExporting}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 font-medium rounded-lg transition-colors"
              >
                {isExporting ? 'Exporting...' : 'Export to Sheets'}
              </button>

              <button
                onClick={() => handleCreateList('static')}
                disabled={isCreatingList || !listName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
              >
                {isCreatingList ? 'Creating...' : 'Create Static List'}
              </button>

              <button
                onClick={() => handleCreateList('active')}
                disabled={isCreatingList || !listName.trim() || !canBeActiveList}
                title={!canBeActiveList ? 'This query cannot be converted to an active list' : ''}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
              >
                {isCreatingList ? 'Creating...' : 'Create Active List'}
              </button>
            </div>

            {!canBeActiveList && (
              <p className="mt-2 text-xs text-gray-500">
                Active list not available: this query uses filters or associations that can't be represented as an active list.
              </p>
            )}
          </div>

          <div className="flex justify-start">
            <button
              onClick={() => setStep('query')}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ← Modify Query
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 'complete' && createdList && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {createdList.listType === 'active' ? 'Active' : 'Static'} List Created!
          </h2>
          <p className="text-gray-600 mb-6">
            {searchResult?.total.toLocaleString()} {objectType} {createdList.listType === 'active' ? 'matching' : 'added to'} "{listName}"
          </p>

          <div className="flex justify-center gap-4">
            <a
              href={createdList.listUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Open in HubSpot
            </a>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Build Another List
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
