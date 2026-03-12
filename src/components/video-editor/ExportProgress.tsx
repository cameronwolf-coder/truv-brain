interface ExportResult {
  filename: string;
  blob: Blob;
  url: string;
}

interface ExportProgressProps {
  isLoading: boolean;
  isExporting: boolean;
  progress: number;
  results: ExportResult[];
  error: string | null;
  totalClips: number;
  onDownload: (result: ExportResult) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExportProgress({
  isLoading,
  isExporting,
  progress,
  results,
  error,
  totalClips,
  onDownload,
}: ExportProgressProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-600">Loading FFmpeg WASM...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isExporting && (
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-blue-700">
              Exporting clip {results.length + 1} of {totalClips}...
            </span>
            <span className="text-xs text-blue-500">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((result) => (
            <div
              key={result.filename}
              className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{result.filename}</p>
                <p className="text-xs text-gray-500">{formatSize(result.blob.size)}</p>
              </div>
              <button
                onClick={() => onDownload(result)}
                className="ml-3 px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 transition-colors"
              >
                Download
              </button>
            </div>
          ))}

          {!isExporting && results.length === totalClips && (
            <button
              onClick={() => results.forEach((r) => onDownload(r))}
              className="w-full py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              Download All ({results.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
