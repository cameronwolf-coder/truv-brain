import { useCallback, useRef, useState } from 'react';
import { useVideoEditor } from '../../hooks/useVideoEditor';

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function VideoUpload() {
  const { sourceFile, setSource } = useVideoEditor();
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        alert('Please select a video file (MP4, MOV, WebM, or MKV).');
        return;
      }
      setSource(file);
    },
    [setSource]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (sourceFile) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 rounded-lg border border-blue-200">
        <span className="text-blue-600 text-lg">🎬</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{sourceFile.name}</p>
          <p className="text-xs text-gray-500">{formatFileSize(sourceFile.size)}</p>
        </div>
        <button
          onClick={() => useVideoEditor.getState().clearSource()}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
        isDragging
          ? 'border-blue-400 bg-blue-50'
          : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
      }`}
    >
      <span className="text-3xl">🎥</span>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">
          Drop a video file here or click to browse
        </p>
        <p className="text-xs text-gray-500 mt-1">MP4, MOV, WebM, or MKV</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={onChange}
        className="hidden"
      />
    </div>
  );
}
