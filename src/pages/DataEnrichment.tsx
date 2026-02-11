import { useState } from 'react';
import { UploadZone } from '../components/enrichment/UploadZone';
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
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [emailColumn, setEmailColumn] = useState<string | null>(null);
  const [nameColumn, setNameColumn] = useState<string | null>(null);
  const [companyColumn, setCompanyColumn] = useState<string | null>(null);
  const [results, setResults] = useState<EnrichmentResult[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [stats, setStats] = useState({ completed: 0, successful: 0, failed: 0 });
  const [sourceModalUrl, setSourceModalUrl] = useState<string | null>(null);
  const [hubspotMatches, setHubspotMatches] = useState<Record<string, { lifecycleStage: string; firstName: string; lastName: string; company: string }>>({});
  const [isCheckingHubSpot, setIsCheckingHubSpot] = useState(false);

  const handleFileUpload = async (file: File) => {
    const parsed = await parseFile(file);

    setCsvData(parsed.rows);
    setEmailColumn(parsed.emailColumn);
    setNameColumn(parsed.nameColumn);
    setCompanyColumn(parsed.companyColumn);
    setResults([]);
    setStats({ completed: 0, successful: 0, failed: 0 });
    setHubspotMatches({});

    // Auto-trigger HubSpot check if we have emails
    if (parsed.emailColumn && parsed.rows.length > 0) {
      const emails = parsed.rows
        .map(row => row[parsed.emailColumn!])
        .filter(Boolean);

      if (emails.length > 0) {
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
      }
    }
  };

  const handleStartEnrichment = async () => {
    if (!emailColumn || csvData.length === 0 || selectedFields.length === 0) {
      return;
    }

    setIsEnriching(true);
    setResults([]);
    setStats({ completed: 0, successful: 0, failed: 0 });

    const contacts = csvData.map(row => ({
      email: row[emailColumn],
      ...row,
    }));

    // Initialize results with pending status
    const initialResults: EnrichmentResult[] = contacts.map(contact => ({
      email: contact.email,
      original_data: contact,
      enriched_data: {},
      status: 'pending',
    }));
    setResults(initialResults);

    const client = new EnrichmentClient();

    await client.startEnrichment(
      { contacts, fields: selectedFields, source: 'csv' },
      (event: StreamEventType) => {
        handleStreamEvent(event);
      },
      (error) => {
        console.error('Enrichment error:', error);
        setIsEnriching(false);
      }
    );

    setIsEnriching(false);
  };

  const handleStreamEvent = (event: StreamEventType) => {
    switch (event.type) {
      case 'start':
        setResults(prev =>
          prev.map(r =>
            r.email === event.email ? { ...r, status: 'processing' } : r
          )
        );
        break;

      case 'progress':
        setResults(prev =>
          prev.map(r => {
            const contactIdx = parseInt(event.contactId.split('-')[1]);
            if (prev.indexOf(r) === contactIdx) {
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
          prev.map(r =>
            r.email === event.data.email
              ? { ...event.data, status: 'completed' }
              : r
          )
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

      case 'done':
        console.log('Enrichment complete:', event);
        break;
    }
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
          Upload a CSV or Excel file with email addresses and enrich with AI-powered company data
        </p>
      </div>

      {csvData.length === 0 ? (
        <UploadZone onFileUpload={handleFileUpload} />
      ) : (
        <div className="space-y-8">
          <div className="bg-white border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">File Loaded</h3>
                <p className="text-sm text-gray-600">
                  {csvData.length} contacts found
                  {emailColumn && ` • Email column: ${emailColumn}`}
                </p>
              </div>
              <button
                onClick={() => {
                  setCsvData([]);
                  setEmailColumn(null);
                  setNameColumn(null);
                  setCompanyColumn(null);
                  setResults([]);
                  setHubspotMatches({});
                }}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Upload Different File
              </button>
            </div>
          </div>

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

          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Select Fields to Enrich
            </h3>
            <FieldSelector
              selectedFields={selectedFields}
              onFieldsChange={setSelectedFields}
              nameColumn={nameColumn}
              companyColumn={companyColumn}
            />
          </div>

          {!isEnriching && results.length === 0 && (
            <div className="flex justify-center">
              <button
                onClick={handleStartEnrichment}
                disabled={selectedFields.length === 0}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Start Enrichment
              </button>
            </div>
          )}

          {(isEnriching || results.length > 0) && (
            <>
              <EnrichmentProgress
                total={csvData.length}
                completed={stats.completed}
                successful={stats.successful}
                failed={stats.failed}
                isRunning={isEnriching}
              />

              <div className="bg-white border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Results</h3>
                  {results.length > 0 && !isEnriching && (
                    <div className="space-x-2">
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
                  selectedFields={selectedFields}
                  onSourceClick={setSourceModalUrl}
                  hubspotMatches={Object.keys(hubspotMatches).length > 0 ? hubspotMatches : undefined}
                />
              </div>
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
