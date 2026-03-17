import { useState, useEffect } from 'react';
import { getCampaignHealth, type CampaignHealth as HealthData } from '../../services/campaignClient';

interface CampaignHealthProps {
  campaignId: string;
}

export function CampaignHealthPanel({ campaignId }: CampaignHealthProps) {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCampaignHealth(campaignId).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <div className="text-sm text-gray-400 py-4">Loading health data...</div>;
  if (!data) return null;

  const hasPipelineErrors = data.pipelineErrors.length > 0;
  const hasDeliveryErrors = data.deliveryErrors.length > 0;

  if (!hasPipelineErrors && !hasDeliveryErrors) {
    return <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">No errors detected. Campaign is healthy.</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-3 bg-gray-50 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900">Pipeline Errors ({data.pipelineErrors.length})</h4>
        </div>
        {data.pipelineErrors.length === 0 ? (
          <p className="p-3 text-xs text-gray-400">None</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.pipelineErrors.map((e, i) => (
              <div key={i} className="p-3">
                <p className="text-xs font-medium text-red-700">Stage: {e.stage}</p>
                <p className="text-xs text-red-600 mt-0.5">{e.error}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-3 bg-gray-50 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900">Delivery Errors ({data.deliveryErrors.length})</h4>
        </div>
        {data.deliveryErrors.length === 0 ? (
          <p className="p-3 text-xs text-gray-400">None</p>
        ) : (
          <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {data.deliveryErrors.map((e, i) => (
              <div key={i} className="p-3 flex items-center justify-between">
                <span className="text-xs text-gray-800">{e.email}</span>
                <span className="text-xs text-red-600">{e.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
