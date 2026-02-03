import { useState, useRef } from 'react';

interface EmailContent {
  subject: string;
  preview_text: string;
  hero_date: string;
  intro_text: string;
  highlights: string[];
  sections: Array<{
    title: string;
    image?: string;
    bullets: string[];
  }>;
  outro_text: string;
  images: string[];
}

interface ConversionResult {
  success: boolean;
  content: EmailContent;
  html: string;
  sourceUrl: string;
}

export function UrlToEmail() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleConvert = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setEditMode(false);

    try {
      const response = await fetch('/api/url-to-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Conversion failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyHtml = async () => {
    let htmlToCopy = result?.html || '';

    // If in edit mode, get the edited content from the preview div
    if (editMode && previewRef.current) {
      htmlToCopy = previewRef.current.innerHTML;
    }

    try {
      await navigator.clipboard.writeText(htmlToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = htmlToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setUrl('');
    setIsLoading(false);
    setError(null);
    setResult(null);
    setEditMode(false);
  };

  return (
    <div className="h-full flex">
      {/* Left Panel - Input & Controls */}
      <div className="w-96 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">URL to Email</h1>
          <p className="mt-1 text-sm text-gray-600">
            Convert blog posts into SendGrid-ready email HTML
          </p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* URL Input */}
          <div className="mb-6">
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
              Blog/Article URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://truv.com/blog/..."
              disabled={isLoading}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
            />
          </div>

          {/* Convert Button */}
          <button
            onClick={handleConvert}
            disabled={!url.trim() || isLoading}
            className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Converting...
              </span>
            ) : (
              'Convert to Email'
            )}
          </button>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
              <button onClick={handleReset} className="mt-2 text-sm text-red-600 hover:text-red-800 underline">
                Try again
              </button>
            </div>
          )}

          {/* Extracted Content Summary */}
          {result && !isLoading && (
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">Conversion complete!</p>
                <p className="text-xs text-green-600 mt-1">Click "Edit Mode" to make changes directly in the preview</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Subject Line
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                    {result.content.subject}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Date
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                    {result.content.hero_date}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Sections ({result.content.sections.length})
                  </label>
                  <ul className="text-sm text-gray-700 bg-gray-50 p-2 rounded space-y-1">
                    {result.content.sections.map((section, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="text-gray-400">{idx + 1}.</span>
                        <span className="truncate">{section.title}</span>
                        {section.image && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex-shrink-0">
                            img
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {result.content.images.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Extracted Images ({result.content.images.length})
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {result.content.images.slice(0, 4).map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`Extracted ${idx + 1}`}
                          className="w-12 h-12 object-cover rounded border border-gray-200"
                        />
                      ))}
                      {result.content.images.length > 4 && (
                        <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded border border-gray-200 text-xs text-gray-500">
                          +{result.content.images.length - 4}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleReset}
                className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Convert Another URL
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Email Preview */}
      <div className="flex-1 bg-gray-100 flex flex-col">
        {/* Preview Header */}
        <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-medium text-gray-900">Email Preview</h2>
            {result && !isLoading && (
              <button
                onClick={() => setEditMode(!editMode)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  editMode
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {editMode ? '✏️ Editing' : 'Edit Mode'}
              </button>
            )}
          </div>
          {result && !isLoading && (
            <button
              onClick={handleCopyHtml}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {copied ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </span>
              ) : (
                'Copy HTML'
              )}
            </button>
          )}
        </div>

        {/* Edit Mode Banner */}
        {editMode && result && !isLoading && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800">
            <strong>Edit Mode:</strong> Click any text below to edit. Changes are saved when you copy.
          </div>
        )}

        {/* Preview Content */}
        <div className="flex-1 overflow-auto p-6 flex justify-center">
          {!result && !isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-lg font-medium">Paste a URL and click Convert</p>
                <p className="mt-1">to preview your email</p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="animate-spin mx-auto h-12 w-12 text-blue-600 mb-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-lg font-medium text-gray-700">Converting...</p>
                <p className="text-sm text-gray-500 mt-1">Scraping and extracting content</p>
              </div>
            </div>
          )}

          {result && !isLoading && (
            <div
              ref={previewRef}
              className={`bg-white shadow-lg rounded-lg overflow-hidden ${editMode ? 'ring-2 ring-amber-400' : ''}`}
              style={{ width: '700px', maxWidth: '100%' }}
              contentEditable={editMode}
              suppressContentEditableWarning={true}
              dangerouslySetInnerHTML={{ __html: result.html }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
