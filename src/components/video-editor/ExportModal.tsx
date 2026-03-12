import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoEditor } from '../../hooks/useVideoEditor';
import { useFFmpeg } from '../../hooks/useFFmpeg';
import { slugify } from '../../utils/videoEditorUtils';
import { formatSrt } from '../../utils/srtFormatter';
import type { TranscriptEntry } from '../../utils/srtFormatter';
import { ExportProgress } from './ExportProgress';
import type { ExportSettings } from '../../types/videoEditor';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  captions?: TranscriptEntry[];
}

export function ExportModal({ isOpen, onClose, captions = [] }: ExportModalProps) {
  const { sourceFile, approvedSegments } = useVideoEditor();
  const { isLoading, isExporting, progress, results, error, exportAll, downloadResult, cleanup } =
    useFFmpeg();

  const [settings, setSettings] = useState<ExportSettings>({
    resolution: 1080,
    format: 'mp4',
    captions: false,
  });

  const handleExport = async () => {
    if (!sourceFile || approvedSegments.length === 0) return;

    const srtContent = settings.captions && captions.length > 0 ? formatSrt(captions) : undefined;

    const clips = approvedSegments.map((seg, i) => ({
      sourceFile,
      startTime: seg.start,
      endTime: seg.end,
      outputName: `${String(i + 1).padStart(2, '0')}-${slugify(seg.suggestedTitle)}`,
      resolution: settings.resolution,
      format: settings.format,
      srtContent,
    }));

    await exportAll(clips);
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Export Clips</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {approvedSegments.length} clip{approvedSegments.length !== 1 ? 's' : ''} ready to
                export
              </p>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Resolution */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Resolution
                </label>
                <div className="flex gap-2">
                  {([1080, 720, 480] as const).map((res) => (
                    <button
                      key={res}
                      onClick={() => setSettings((s) => ({ ...s, resolution: res }))}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        settings.resolution === res
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {res}p
                    </button>
                  ))}
                </div>
              </div>

              {/* Format */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Format</label>
                <div className="flex gap-2">
                  {(['mp4', 'mov'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setSettings((s) => ({ ...s, format: fmt }))}
                      className={`px-3 py-1.5 rounded-lg text-sm uppercase transition-colors ${
                        settings.format === fmt
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Captions toggle */}
              {captions.length > 0 && (
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Burn-in Captions</label>
                    <p className="text-xs text-gray-500">{captions.length} entries will be embedded</p>
                  </div>
                  <button
                    onClick={() => setSettings((s) => ({ ...s, captions: !s.captions }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.captions ? 'bg-purple-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.captions ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Export progress */}
              {(isLoading || isExporting || results.length > 0 || error) && (
                <ExportProgress
                  isLoading={isLoading}
                  isExporting={isExporting}
                  progress={progress}
                  results={results}
                  error={error}
                  totalClips={approvedSegments.length}
                  onDownload={downloadResult}
                />
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
              >
                {results.length > 0 ? 'Done' : 'Cancel'}
              </button>
              {!isExporting && results.length === 0 && (
                <button
                  onClick={handleExport}
                  disabled={isLoading || approvedSegments.length === 0}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Loading FFmpeg...' : 'Export All'}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
