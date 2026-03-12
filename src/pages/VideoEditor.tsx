import { useState } from 'react';
import { VideoUpload } from '../components/video-editor/VideoUpload';
import { AnalysisPanel } from '../components/video-editor/AnalysisPanel';
import { PreviewPlayer } from '../components/video-editor/PreviewPlayer';
import { Timeline } from '../components/video-editor/Timeline';
import { ExportModal } from '../components/video-editor/ExportModal';
import { CaptionEditor } from '../components/video-editor/CaptionEditor';
import { useVideoEditor } from '../hooks/useVideoEditor';
import { useProjectPersistence } from '../hooks/useProjectPersistence';
import type { TranscriptEntry } from '../utils/srtFormatter';

export function VideoEditor() {
  const { sourceFile, approvedSegments, analysis } = useVideoEditor();
  const [showExport, setShowExport] = useState(false);
  const [captions, setCaptions] = useState<TranscriptEntry[]>([]);
  const [rightPanel, setRightPanel] = useState<'details' | 'captions'>('details');

  // Auto-save to IndexedDB
  useProjectPersistence();

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="px-4 lg:px-6 py-3 lg:py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg lg:text-xl font-semibold text-gray-900">Video Editor</h1>
            <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">
              Upload a webinar, analyze with Gemini, export persona-tailored clips
            </p>
          </div>
          <div className="flex items-center gap-2 lg:gap-3">
            {approvedSegments.length > 0 && (
              <>
                <span className="text-xs lg:text-sm text-gray-600 hidden sm:inline">
                  {approvedSegments.length} clip{approvedSegments.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setShowExport(true)}
                  className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg bg-blue-600 text-white text-xs lg:text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Export
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main content - responsive: stacked on mobile, side-by-side on desktop */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left panel: Upload + Segments */}
        <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-gray-200 bg-white flex flex-col overflow-hidden max-h-[40vh] lg:max-h-none">
          <div className="p-3 border-b border-gray-200">
            <VideoUpload />
          </div>
          <div className="flex-1 overflow-hidden">
            <AnalysisPanel />
          </div>
        </div>

        {/* Center: Preview + Timeline */}
        <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
          <div className="flex-1 flex items-center justify-center p-3 lg:p-6">
            <div className="w-full max-w-3xl">
              <PreviewPlayer captions={captions} />
            </div>
          </div>

          {/* Timeline */}
          {sourceFile && <Timeline />}
        </div>

        {/* Right panel: Details or Captions */}
        {sourceFile && (
          <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white flex flex-col overflow-hidden max-h-[30vh] lg:max-h-none">
            {/* Panel tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setRightPanel('details')}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                  rightPanel === 'details'
                    ? 'text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setRightPanel('captions')}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                  rightPanel === 'captions'
                    ? 'text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Captions
                {captions.length > 0 && (
                  <span className="ml-1 text-[10px] px-1 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    {captions.length}
                  </span>
                )}
              </button>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-hidden">
              {rightPanel === 'details' ? (
                <div className="p-4 overflow-y-auto h-full">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Details</h3>
                  {analysis ? (
                    <div className="space-y-3 text-xs text-gray-600">
                      <div>
                        <p className="text-gray-400">Source</p>
                        <p className="font-medium text-gray-900">{analysis.source}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Duration</p>
                        <p className="font-medium text-gray-900">{analysis.duration}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Total Segments</p>
                        <p className="font-medium text-gray-900">{analysis.segments.length}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Approved</p>
                        <p className="font-medium text-green-700">{approvedSegments.length}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Captions</p>
                        <p className="font-medium text-gray-900">
                          {captions.length > 0 ? `${captions.length} entries` : 'None'}
                        </p>
                      </div>

                      {/* Keyboard shortcuts help */}
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-gray-400 mb-2">Keyboard Shortcuts</p>
                        <div className="space-y-1 text-[10px]">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Play/Pause</span>
                            <kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono">Space</kbd>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Rewind 5s</span>
                            <kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono">J</kbd>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Forward 5s</span>
                            <kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono">L</kbd>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Frame step</span>
                            <kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono">Arrow</kbd>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Zoom timeline</span>
                            <kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono">Ctrl+Scroll</kbd>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">
                      Run Gemini analysis to see segment details
                    </p>
                  )}
                </div>
              ) : (
                <CaptionEditor captions={captions} onChange={setCaptions} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        captions={captions}
      />
    </div>
  );
}
