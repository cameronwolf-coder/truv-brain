interface EnrichmentProgressProps {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  isRunning: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
}

export function EnrichmentProgress({
  total,
  completed,
  successful,
  failed,
  isRunning,
  onCancel,
}: EnrichmentProgressProps) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const successRate = completed > 0 ? (successful / completed) * 100 : 0;

  return (
    <div className="bg-white border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          {isRunning ? 'Enriching Contacts...' : 'Enrichment Complete'}
        </h3>
        {isRunning && onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-md"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Progress</span>
          <span>{completed} / {total}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-semibold text-gray-900">{completed}</div>
          <div className="text-xs text-gray-500">Processed</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-green-600">{successful}</div>
          <div className="text-xs text-gray-500">Successful</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-red-600">{failed}</div>
          <div className="text-xs text-gray-500">Failed</div>
        </div>
      </div>

      {completed > 0 && (
        <div className="pt-4 border-t text-center">
          <div className="text-sm text-gray-600">
            Success Rate: <span className="font-medium">{successRate.toFixed(1)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
