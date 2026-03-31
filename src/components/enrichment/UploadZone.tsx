import { useState, useRef } from 'react';

interface UploadZoneProps {
  onFileUpload: (file: File) => void;
  onUrlSubmit?: (url: string) => void;
}

export function UploadZone({ onFileUpload, onUrlSubmit }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<'csv' | 'url'>('csv');
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      onFileUpload(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleUrlSubmit = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    onUrlSubmit?.(trimmed);
  };

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setMode('csv')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mode === 'csv'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Upload CSV / Excel
        </button>
        <button
          onClick={() => setMode('url')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mode === 'url'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Enrich by URL
        </button>
      </div>

      {mode === 'csv' ? (
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="text-gray-600">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="mt-2 text-sm font-medium">Drop your CSV or Excel file here</p>
            <p className="mt-1 text-xs text-gray-500">or click to browse</p>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-8">
          <p className="text-sm text-gray-600 mb-4">
            Enter a company domain or website URL to enrich a single company
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
              placeholder="e.g., flagstar.com"
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim()}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
            >
              Enrich
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
