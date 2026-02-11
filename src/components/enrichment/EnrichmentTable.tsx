import type { EnrichmentResult } from '../../types/enrichment';

interface HubSpotMatch {
  lifecycleStage: string;
  firstName?: string;
  lastName?: string;
  company?: string;
}

interface EnrichmentTableProps {
  results: EnrichmentResult[];
  selectedFields: string[];
  onSourceClick?: (url: string) => void;
  hubspotMatches?: Record<string, HubSpotMatch>;
}

export function EnrichmentTable({ results, selectedFields, onSourceClick, hubspotMatches }: EnrichmentTableProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No results yet. Upload a CSV to begin enrichment.
      </div>
    );
  }

  const getConfidenceColor = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return 'bg-green-50 text-green-700';
      case 'medium':
        return 'bg-yellow-50 text-yellow-700';
      case 'low':
        return 'bg-red-50 text-red-700';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Email
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            {hubspotMatches && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                HubSpot
              </th>
            )}
            {selectedFields.map(field => (
              <th
                key={field}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
              >
                {field.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {results.map((result, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-900">
                {result.email}
              </td>
              <td className="px-4 py-3 text-sm">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    result.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : result.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : result.status === 'processing'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {result.status}
                </span>
              </td>
              {hubspotMatches && (
                <td className="px-4 py-3 text-sm">
                  {(() => {
                    // Check both the original email and any discovered work_email
                    const emailKey = result.email?.toLowerCase();
                    const discoveredEmail = result.enriched_data?.work_email?.value?.toString().toLowerCase();
                    const match = (emailKey && hubspotMatches[emailKey]) || (discoveredEmail && hubspotMatches[discoveredEmail]);
                    return match ? (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                        {match.lifecycleStage || 'Unknown'}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    );
                  })()}
                </td>
              )}
              {selectedFields.map(field => {
                const enrichedField = result.enriched_data[field];
                const originalValue = result.original_data[field];

                return (
                  <td key={field} className="px-4 py-3 text-sm">
                    {result.status === 'processing' && !enrichedField ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                        <span className="text-gray-400">Loading...</span>
                      </div>
                    ) : enrichedField ? (
                      <div className="space-y-1">
                        <div
                          className={`inline-flex px-2 py-1 rounded text-xs ${getConfidenceColor(
                            enrichedField.confidence
                          )}`}
                        >
                          {enrichedField.value || 'N/A'}
                        </div>
                        {enrichedField.source_url && (
                          <button
                            onClick={() => onSourceClick?.(enrichedField.source_url)}
                            className="block text-xs text-blue-600 hover:underline"
                          >
                            View Source
                          </button>
                        )}
                      </div>
                    ) : originalValue ? (
                      <span className="text-gray-600">{originalValue}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
