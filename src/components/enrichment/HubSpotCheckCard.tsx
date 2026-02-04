interface HubSpotCheckCardProps {
  total: number;
  matched: number;
  byStage: Record<string, number>;
  isChecking: boolean;
}

export function HubSpotCheckCard({ total, matched, byStage, isChecking }: HubSpotCheckCardProps) {
  if (isChecking) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <div className="animate-spin h-5 w-5 border-2 border-purple-600 border-t-transparent rounded-full" />
          <span className="text-sm text-gray-600">Checking HubSpot...</span>
        </div>
      </div>
    );
  }

  if (matched === 0) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center space-x-2">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-gray-600">
            No contacts found in HubSpot
          </span>
        </div>
      </div>
    );
  }

  const stageLabels: Record<string, string> = {
    lead: 'Leads',
    marketingqualifiedlead: 'MQLs',
    salesqualifiedlead: 'SQLs',
    opportunity: 'Opportunities',
    customer: 'Customers',
    subscriber: 'Subscribers',
    evangelist: 'Evangelists',
    other: 'Other',
  };

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-gray-900">
            {matched} of {total} contacts found in HubSpot
          </span>
        </div>
      </div>
      {Object.keys(byStage).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(byStage).map(([stage, count]) => (
            <span
              key={stage}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700"
            >
              {count} {stageLabels[stage] || stage}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
