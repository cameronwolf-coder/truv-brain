import { useState, useRef } from 'react';

interface UploadZoneProps {
  onFileUpload: (file: File) => void;
  onUrlSubmit?: (url: string) => void;
  onManualSubmit?: (entries: Record<string, string>[]) => void;
  onHubSpotImport?: (contacts: Record<string, string>[]) => void;
}

export function UploadZone({ onFileUpload, onUrlSubmit, onManualSubmit, onHubSpotImport }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<'csv' | 'url' | 'manual' | 'hubspot'>('csv');
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual entry state
  const [manualEmail, setManualEmail] = useState('');
  const [manualFirstName, setManualFirstName] = useState('');
  const [manualLastName, setManualLastName] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualEntries, setManualEntries] = useState<Record<string, string>[]>([]);

  // HubSpot search state
  const [hubspotQuery, setHubspotQuery] = useState('');
  const [hubspotSearchType, setHubspotSearchType] = useState<'contacts' | 'companies'>('contacts');
  const [hubspotResults, setHubspotResults] = useState<Record<string, string>[]>([]);
  const [hubspotSelected, setHubspotSelected] = useState<Set<number>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      onFileUpload(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileUpload(file);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleUrlSubmit = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    onUrlSubmit?.(trimmed);
  };

  // Manual entry handlers
  const addManualEntry = () => {
    if (!manualEmail && !manualFirstName && !manualCompany) return;
    const entry: Record<string, string> = {};
    if (manualEmail) entry.email = manualEmail;
    if (manualFirstName) entry.first_name = manualFirstName;
    if (manualLastName) entry.last_name = manualLastName;
    if (manualCompany) entry.company = manualCompany;
    setManualEntries(prev => [...prev, entry]);
    setManualEmail('');
    setManualFirstName('');
    setManualLastName('');
    setManualCompany('');
  };

  const removeManualEntry = (idx: number) => {
    setManualEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const submitManualEntries = () => {
    if (manualEntries.length === 0) return;
    onManualSubmit?.(manualEntries);
  };

  // HubSpot search handlers
  const searchHubSpot = async () => {
    if (!hubspotQuery.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    setHubspotResults([]);
    setHubspotSelected(new Set());
    try {
      const response = await fetch('/api/hubspot-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: hubspotQuery.trim(), type: hubspotSearchType }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Search failed');
      }
      const data = await response.json();
      setHubspotResults(data.results || []);
      if (data.results?.length === 0) {
        setSearchError('No results found');
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleHubspotSelect = (idx: number) => {
    setHubspotSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAllHubspot = () => {
    if (hubspotSelected.size === hubspotResults.length) {
      setHubspotSelected(new Set());
    } else {
      setHubspotSelected(new Set(hubspotResults.map((_, i) => i)));
    }
  };

  const importHubspotSelected = () => {
    const selected = hubspotResults.filter((_, i) => hubspotSelected.has(i));
    if (selected.length === 0) return;
    onHubSpotImport?.(selected);
  };

  const tabs = [
    { key: 'csv' as const, label: 'Upload Spreadsheet' },
    { key: 'manual' as const, label: 'Manual Entry' },
    { key: 'hubspot' as const, label: 'HubSpot Search' },
    { key: 'url' as const, label: 'Enrich by URL' },
  ];

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              mode === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CSV Upload */}
      {mode === 'csv' && (
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="text-gray-600">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mt-2 text-sm font-medium">Drop your CSV or Excel file here</p>
            <p className="mt-1 text-xs text-gray-500">or click to browse</p>
          </div>
        </div>
      )}

      {/* URL mode */}
      {mode === 'url' && (
        <div className="border rounded-lg p-8">
          <p className="text-sm text-gray-600 mb-4">
            Enter a company domain or website URL to enrich a single company
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
              placeholder="e.g., flagstar.com"
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim()}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
            >
              Enrich
            </button>
          </div>
        </div>
      )}

      {/* Manual Entry */}
      {mode === 'manual' && (
        <div className="border rounded-lg p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Enter contact or company details manually. Add multiple entries, then enrich all at once.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={manualFirstName}
              onChange={(e) => setManualFirstName(e.target.value)}
              placeholder="First name"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={manualLastName}
              onChange={(e) => setManualLastName(e.target.value)}
              placeholder="Last name"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              placeholder="Email (optional)"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={manualCompany}
              onChange={(e) => setManualCompany(e.target.value)}
              placeholder="Company"
              onKeyDown={(e) => e.key === 'Enter' && addManualEntry()}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={addManualEntry}
            disabled={!manualEmail && !manualFirstName && !manualCompany}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Entry
          </button>

          {manualEntries.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">{manualEntries.length} {manualEntries.length === 1 ? 'entry' : 'entries'} added</div>
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {manualEntries.map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-gray-700">
                      {[entry.first_name, entry.last_name].filter(Boolean).join(' ')}
                      {entry.email && <span className="text-gray-400 ml-2">{entry.email}</span>}
                      {entry.company && <span className="text-gray-400 ml-2">@ {entry.company}</span>}
                    </span>
                    <button onClick={() => removeManualEntry(idx)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                  </div>
                ))}
              </div>
              <button
                onClick={submitManualEntries}
                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm"
              >
                Enrich {manualEntries.length} {manualEntries.length === 1 ? 'Entry' : 'Entries'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* HubSpot Search */}
      {mode === 'hubspot' && (
        <div className="border rounded-lg p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Search HubSpot for contacts or companies and import them for enrichment.
          </p>
          <div className="flex gap-3">
            <select
              value={hubspotSearchType}
              onChange={(e) => setHubspotSearchType(e.target.value as 'contacts' | 'companies')}
              className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="contacts">Contacts</option>
              <option value="companies">Companies</option>
            </select>
            <input
              type="text"
              value={hubspotQuery}
              onChange={(e) => setHubspotQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchHubSpot()}
              placeholder={hubspotSearchType === 'contacts' ? 'Search by name, email, or company...' : 'Search by company name or domain...'}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={searchHubSpot}
              disabled={!hubspotQuery.trim() || isSearching}
              className="px-6 py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {searchError && (
            <p className="text-sm text-red-600">{searchError}</p>
          )}

          {hubspotResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{hubspotResults.length} results</span>
                <button onClick={selectAllHubspot} className="text-sm text-blue-600 hover:text-blue-800">
                  {hubspotSelected.size === hubspotResults.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {hubspotResults.map((result, idx) => (
                  <label key={idx} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hubspotSelected.has(idx)}
                      onChange={() => toggleHubspotSelect(idx)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 text-sm">
                      <span className="font-medium text-gray-900">
                        {result.first_name || result.name || result.email || result.domain || 'Unknown'}
                        {result.last_name ? ` ${result.last_name}` : ''}
                      </span>
                      {result.email && <span className="text-gray-400 ml-2">{result.email}</span>}
                      {result.company && <span className="text-gray-400 ml-2">@ {result.company}</span>}
                      {result.domain && !result.email && <span className="text-gray-400 ml-2">{result.domain}</span>}
                      {result.lifecycle_stage && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600">{result.lifecycle_stage}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              {hubspotSelected.size > 0 && (
                <button
                  onClick={importHubspotSelected}
                  className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm"
                >
                  Import & Enrich {hubspotSelected.size} {hubspotSelected.size === 1 ? 'Record' : 'Records'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
