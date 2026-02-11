import { useState, useRef } from 'react';
import { UploadZone } from '../components/enrichment/UploadZone';
import { FilePreview } from '../components/enrichment/FilePreview';
import { FieldSelector } from '../components/enrichment/FieldSelector';
import { EnrichmentProgress } from '../components/enrichment/EnrichmentProgress';
import { EnrichmentTable } from '../components/enrichment/EnrichmentTable';
import { HubSpotCheckCard } from '../components/enrichment/HubSpotCheckCard';
import { SourceModal } from '../components/enrichment/SourceModal';
import { parseFile } from '../utils/csvParser';
import { exportToCSV, downloadCSV, copyToClipboard } from '../utils/csvExporter';
import { EnrichmentClient } from '../services/enrichmentClient';
import type { EnrichmentResult, StreamEventType } from '../types/enrichment';

export function DataEnrichment() {
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [emailColumn, setEmailColumn] = useState<string | null>(null);
  const [nameColumn, setNameColumn] = useState<string | null>(null);
  const [lastNameColumn, setLastNameColumn] = useState<string | null>(null);
  const [companyColumn, setCompanyColumn] = useState<string | null>(null);
  const [results, setResults] = useState<EnrichmentResult[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [stats, setStats] = useState({ completed: 0, successful: 0, failed: 0 });
  const [sourceModalUrl, setSourceModalUrl] = useState<string | null>(null);
  const [hubspotMatches, setHubspotMatches] = useState<Record<string, { lifecycleStage: string; firstName: string; lastName: string; company: string }>>({});
  const [isCheckingHubSpot, setIsCheckingHubSpot] = useState(false);
  const enrichmentClientRef = useRef<EnrichmentClient | null>(null);

  const findEmailMode = !emailColumn && !!(nameColumn && companyColumn);
  const canProceed = !!emailColumn || findEmailMode;

  // Include 'website' in display when in find-email mode (auto-populated by backend)
  const displayFields = findEmailMode
    ? [...new Set([...selectedFields, 'website'])]
    : selectedFields;

  const runHubSpotCheck = async (emails: string[]) => {
    if (emails.length === 0) return;
    setIsCheckingHubSpot(true);
    try {
      const response = await fetch('/api/hubspot-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      });
      if (response.ok) {
        const data = await response.json();
        setHubspotMatches(data.matches || {});
      }
    } catch (error) {
      console.error('HubSpot check failed:', error);
    } finally {
      setIsCheckingHubSpot(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    const parsed = await parseFile(file);

    setHeaders(parsed.headers);
    setCsvData(parsed.rows);
    setEmailColumn(parsed.emailColumn);
    setNameColumn(parsed.nameColumn);
    setLastNameColumn(parsed.lastNameColumn);
    setCompanyColumn(parsed.companyColumn);
    setResults([]);
    setStats({ completed: 0, successful: 0, failed: 0 });
    setHubspotMatches({});

    // Auto-trigger HubSpot check if we have emails
    if (parsed.emailColumn && parsed.rows.length > 0) {
      const emails = parsed.rows
        .map(row => row[parsed.emailColumn!])
        .filter(Boolean);
      runHubSpotCheck(emails);
    }

    // Auto-select work_email when in find-email mode
    if (!parsed.emailColumn && parsed.nameColumn && parsed.companyColumn) {
      setSelectedFields(prev =>
        prev.includes('work_email') ? prev : [...prev, 'work_email']
      );
    }
  };

  const handleReset = () => {
    setHeaders([]);
    setCsvData([]);
    setEmailColumn(null);
    setNameColumn(null);
    setLastNameColumn(null);
    setCompanyColumn(null);
    setResults([]);
    setSelectedFields([]);
    setHubspotMatches({});
    setStats({ completed: 0, successful: 0, failed: 0 });
  };

  const handleStartEnrichment = async () => {
    if (!canProceed || csvData.length === 0 || selectedFields.length === 0) {
      return;
    }

    setIsEnriching(true);
    setEnrichmentError(null);
    setResults([]);
    setStats({ completed: 0, successful: 0, failed: 0 });

    // Build contacts with explicit name and company fields for the backend
    const contacts = csvData.map(row => {
      const contact: Record<string, any> = { ...row };
      contact.email = emailColumn ? row[emailColumn] : '';

      // Combine first + last name and set explicit fields for the backend
      if (nameColumn) {
        const firstName = row[nameColumn] || '';
        const lastName = lastNameColumn ? (row[lastNameColumn] || '') : '';
        contact.name = [firstName, lastName].filter(Boolean).join(' ');
      }
      if (companyColumn) contact.company = row[companyColumn];

      return contact;
    });

    // Initialize results with pending status
    const initialResults: EnrichmentResult[] = contacts.map(contact => ({
      email: contact.email || contact.name || 'Unknown',
      original_data: contact,
      enriched_data: {},
      status: 'pending',
    }));
    setResults(initialResults);

    const client = new EnrichmentClient();
    enrichmentClientRef.current = client;

    await client.startEnrichment(
      { contacts, fields: selectedFields, source: 'csv' },
      (event: StreamEventType) => {
        handleStreamEvent(event);
      },
      (error) => {
        console.error('Enrichment error:', error);
        setEnrichmentError(error.message || 'Enrichment failed. Check that GEMINI_API_KEY and FIRECRAWL_API_KEY are configured.');
        setIsEnriching(false);
      }
    );

    enrichmentClientRef.current = null;
    setIsEnriching(false);
  };

  const handleStreamEvent = (event: StreamEventType) => {
    switch (event.type) {
      case 'start':
        setResults(prev =>
          prev.map((r, idx) => {
            const contactIdx = parseInt(event.contactId.split('-')[1]);
            return idx === contactIdx ? { ...r, status: 'processing' } : r;
          })
        );
        break;

      case 'progress':
        setResults(prev =>
          prev.map((r, idx) => {
            const contactIdx = parseInt(event.contactId.split('-')[1]);
            if (idx === contactIdx) {
              return {
                ...r,
                enriched_data: {
                  ...r.enriched_data,
                  [event.field]: {
                    value: event.value,
                    source_url: event.source,
                    confidence: event.confidence,
                    agent: event.agent,
                  },
                },
              };
            }
            return r;
          })
        );
        break;

      case 'complete':
        setResults(prev =>
          prev.map((r, idx) => {
            const contactIdx = parseInt(event.contactId.split('-')[1]);
            return idx === contactIdx ? { ...event.data, status: 'completed' } : r;
          })
        );
        setStats(prev => ({ ...prev, completed: prev.completed + 1, successful: prev.successful + 1 }));
        break;

      case 'error':
        setResults(prev =>
          prev.map((r, idx) => {
            const contactIdx = parseInt(event.contactId.split('-')[1]);
            if (idx === contactIdx) {
              return { ...r, status: 'failed', error: event.error };
            }
            return r;
          })
        );
        setStats(prev => ({ ...prev, completed: prev.completed + 1, failed: prev.failed + 1 }));
        break;

      case 'done': {
        console.log('Enrichment complete:', event);
        // If we were in find-email mode, run HubSpot check with discovered emails
        if (findEmailMode) {
          setResults(prev => {
            const foundEmails = prev
              .map(r => r.enriched_data?.work_email?.value)
              .filter((v): v is string => typeof v === 'string' && v.includes('@'));
            if (foundEmails.length > 0) {
              runHubSpotCheck(foundEmails);
            }
            return prev;
          });
        }
        break;
      }
    }
  };

  const handleLookupHubSpot = () => {
    // Collect all emails: original column + discovered work_email
    const allEmails = new Set<string>();
    results.forEach(r => {
      if (emailColumn && r.original_data[emailColumn]) {
        allEmails.add(r.original_data[emailColumn]);
      }
      const discoveredEmail = r.enriched_data?.work_email?.value;
      if (typeof discoveredEmail === 'string' && discoveredEmail.includes('@')) {
        allEmails.add(discoveredEmail);
      }
    });
    if (allEmails.size > 0) {
      runHubSpotCheck([...allEmails]);
    }
  };

  const handleCancelEnrichment = () => {
    enrichmentClientRef.current?.cancel();
    enrichmentClientRef.current = null;
    setIsEnriching(false);
  };

  const handleDownloadCSV = () => {
    const csv = exportToCSV(results);
    downloadCSV(csv, `enriched-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleCopyToClipboard = () => {
    copyToClipboard(results);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Data Enrichment</h1>
        <p className="mt-2 text-gray-600">
          Upload a CSV or Excel file with contacts and enrich with AI-powered company data
        </p>
      </div>

      {csvData.length === 0 ? (
        <UploadZone onFileUpload={handleFileUpload} />
      ) : (
        <div className="space-y-6">
          {/* File preview + column mapping */}
          <FilePreview
            headers={headers}
            rows={csvData}
            emailColumn={emailColumn}
            nameColumn={nameColumn}
            lastNameColumn={lastNameColumn}
            companyColumn={companyColumn}
            onEmailColumnChange={setEmailColumn}
            onNameColumnChange={setNameColumn}
            onLastNameColumnChange={setLastNameColumn}
            onCompanyColumnChange={setCompanyColumn}
            onReset={handleReset}
          />

          {canProceed && (
            <>
              {/* HubSpot check - only when we have emails */}
              {emailColumn && (
                <HubSpotCheckCard
                  total={csvData.length}
                  matched={Object.keys(hubspotMatches).length}
                  byStage={Object.values(hubspotMatches).reduce<Record<string, number>>((acc, match) => {
                    const stage = match.lifecycleStage || 'other';
                    acc[stage] = (acc[stage] || 0) + 1;
                    return acc;
                  }, {})}
                  isChecking={isCheckingHubSpot}
                />
              )}

              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Select Fields to Enrich
                </h3>
                <FieldSelector
                  selectedFields={selectedFields}
                  onFieldsChange={setSelectedFields}
                  nameColumn={nameColumn}
                  companyColumn={companyColumn}
                  findEmailMode={findEmailMode}
                />
              </div>

              {!isEnriching && results.length === 0 && (
                <div className="flex justify-center">
                  <button
                    onClick={handleStartEnrichment}
                    disabled={selectedFields.length === 0}
                    className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {findEmailMode ? 'Find Emails & Enrich' : 'Start Enrichment'}
                  </button>
                </div>
              )}

              {enrichmentError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800">Enrichment Failed</p>
                  <p className="text-sm text-red-700 mt-1">{enrichmentError}</p>
                </div>
              )}

              {(isEnriching || (results.length > 0 && !enrichmentError)) && (
                <>
                  <EnrichmentProgress
                    total={csvData.length}
                    completed={stats.completed}
                    successful={stats.successful}
                    failed={stats.failed}
                    isRunning={isEnriching}
                    onCancel={handleCancelEnrichment}
                  />

                  <div className="bg-white border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900">Results</h3>
                      {results.length > 0 && !isEnriching && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setResults([]);
                              setStats({ completed: 0, successful: 0, failed: 0 });
                              setEnrichmentError(null);
                            }}
                            className="px-4 py-2 text-sm border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50"
                          >
                            Enrich Further
                          </button>
                          <button
                            onClick={handleLookupHubSpot}
                            disabled={isCheckingHubSpot}
                            className="px-4 py-2 text-sm border border-purple-300 text-purple-700 rounded-md hover:bg-purple-50 disabled:opacity-50"
                          >
                            {isCheckingHubSpot ? 'Checking...' : 'Lookup in HubSpot'}
                          </button>
                          <button
                            onClick={handleCopyToClipboard}
                            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                          >
                            Copy to Clipboard
                          </button>
                          <button
                            onClick={handleDownloadCSV}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          >
                            Download CSV
                          </button>
                        </div>
                      )}
                    </div>
                    <EnrichmentTable
                      results={results}
                      selectedFields={displayFields}
                      onSourceClick={setSourceModalUrl}
                      hubspotMatches={Object.keys(hubspotMatches).length > 0 ? hubspotMatches : undefined}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      <SourceModal
        isOpen={!!sourceModalUrl}
        url={sourceModalUrl || ''}
        onClose={() => setSourceModalUrl(null)}
      />
    </div>
  );
}
