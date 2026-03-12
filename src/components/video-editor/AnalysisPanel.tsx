import { useMemo } from 'react';
import { useVideoEditor } from '../../hooks/useVideoEditor';
import { useGeminiAnalysis } from '../../hooks/useGeminiAnalysis';
import { PersonaFilter } from './PersonaFilter';
import { SegmentCard } from './SegmentCard';
import type { PersonaKey } from '../../types/videoEditor';

export function AnalysisPanel() {
  const {
    sourceFile,
    analysis,
    isAnalyzing,
    analysisError,
    approvedSegments,
    selectedIndex,
    activePersonas,
    approveSegment,
    rejectSegment,
    editSegment,
    approveAll,
    selectSegment,
    setCurrentTime,
  } = useVideoEditor();

  const { analyze, stage, uploadProgress } = useGeminiAnalysis();

  const filteredSegments = useMemo(() => {
    if (!analysis) return [];
    if (activePersonas.length === 0) return analysis.segments;
    return analysis.segments.filter((seg) =>
      seg.personas.some((p) => activePersonas.includes(p as PersonaKey))
    );
  }, [analysis, activePersonas]);

  const getApprovedIndex = (seg: { start: string; end: string }) =>
    approvedSegments.findIndex((a) => a.start === seg.start && a.end === seg.end);

  if (!sourceFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm p-4">
        Upload a video to get started
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Segments</h3>
          {analysis && (
            <div className="flex gap-2">
              <button
                onClick={approveAll}
                className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
              >
                Approve All
              </button>
              <span className="text-xs text-gray-400 self-center">
                {approvedSegments.length}/{analysis.segments.length}
              </span>
            </div>
          )}
        </div>
        <PersonaFilter />
        {!analysis && !isAnalyzing && (
          <button
            onClick={() => analyze(activePersonas.length > 0 ? activePersonas : undefined)}
            className="w-full py-2 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Analyze with Gemini
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
            {stage === 'uploading' && (
              <>
                <p className="text-sm">Uploading video...</p>
                <div className="w-48 h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{uploadProgress}%</p>
              </>
            )}
            {stage === 'processing' && (
              <>
                <p className="text-sm">Processing video on Gemini...</p>
                <p className="text-xs text-gray-400 mt-1">Waiting for file to be ready</p>
              </>
            )}
            {stage === 'analyzing' && (
              <>
                <p className="text-sm">Analyzing with Gemini AI...</p>
                <p className="text-xs text-gray-400 mt-1">Identifying clips and personas</p>
              </>
            )}
            {stage !== 'uploading' && stage !== 'processing' && stage !== 'analyzing' && (
              <>
                <p className="text-sm">Starting analysis...</p>
                <p className="text-xs text-gray-400 mt-1">This may take a few minutes</p>
              </>
            )}
          </div>
        )}

        {analysisError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{analysisError}</p>
            <button
              onClick={() => analyze(activePersonas.length > 0 ? activePersonas : undefined)}
              className="text-xs text-red-600 hover:text-red-800 mt-2 underline"
            >
              Retry
            </button>
          </div>
        )}

        {filteredSegments.map((segment, i) => {
          const approvedIdx = getApprovedIndex(segment);
          return (
            <SegmentCard
              key={`${segment.start}-${segment.end}`}
              segment={segment}
              index={i}
              isApproved={approvedIdx >= 0}
              isSelected={selectedIndex === approvedIdx && approvedIdx >= 0}
              onApprove={() => approveSegment(segment)}
              onReject={() => {
                if (approvedIdx >= 0) rejectSegment(approvedIdx);
              }}
              onEdit={(updates) => {
                if (approvedIdx >= 0) editSegment(approvedIdx, updates);
              }}
              onSelect={() => {
                // Auto-approve if not already, then select by approved index
                if (approvedIdx < 0) {
                  approveSegment(segment);
                  // After approving, it'll be the last item in approvedSegments
                  selectSegment(approvedSegments.length);
                } else {
                  selectSegment(approvedIdx);
                }
              }}
              onSeek={setCurrentTime}
            />
          );
        })}

        {analysis && filteredSegments.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            No segments match the selected personas
          </p>
        )}
      </div>
    </div>
  );
}
