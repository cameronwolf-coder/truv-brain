import { useState, useRef, useCallback } from 'react';
import { Editor } from '@tinymce/tinymce-react';

export function UrlToEmail() {
  const editorRef = useRef<any>(null);
  const [inputMode, setInputMode] = useState<'paste' | 'url'>('paste');
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [htmlWrapper, setHtmlWrapper] = useState<{ before: string; after: string } | null>(null);

  const loadHtmlIntoEditor = useCallback((fullHtml: string) => {
    if (!editorRef.current) return;

    // Extract body content to preserve full document structure (head, styles, etc.)
    const bodyMatch = fullHtml.match(/<body([^>]*)>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      const bodyAttrs = bodyMatch[1];
      const bodyContent = bodyMatch[2];
      const bodyTagStart = fullHtml.indexOf(bodyMatch[0]);
      const before = fullHtml.substring(0, bodyTagStart) + `<body${bodyAttrs}>`;
      const after = '</body>' + fullHtml.substring(bodyTagStart + bodyMatch[0].length);
      setHtmlWrapper({ before, after });
      editorRef.current.setContent(bodyContent);
    } else {
      setHtmlWrapper(null);
      editorRef.current.setContent(fullHtml);
    }
  }, []);

  const getFullHtml = useCallback((): string => {
    const content = editorRef.current?.getContent() || '';
    if (htmlWrapper) {
      return htmlWrapper.before + content + htmlWrapper.after;
    }
    return content;
  }, [htmlWrapper]);

  const handleScrapeUrl = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/url-to-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Scraping failed');
      loadHtmlIntoEditor(data.html);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteLoad = () => {
    if (pasteValue.trim()) {
      loadHtmlIntoEditor(pasteValue);
    }
    setShowPasteModal(false);
    setPasteValue('');
  };

  const handleCopyHtml = async () => {
    const html = getFullHtml();
    if (!html) return;
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = html;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">HTML Editor</h1>
        <button
          onClick={handleCopyHtml}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            copied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {copied ? 'Copied!' : 'Copy HTML'}
        </button>
      </div>

      {/* Input Strip */}
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-4">
        <div className="flex bg-white rounded-lg border border-gray-200 p-0.5">
          <button
            onClick={() => setInputMode('paste')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              inputMode === 'paste' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Paste HTML
          </button>
          <button
            onClick={() => setInputMode('url')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              inputMode === 'url' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Scrape URL
          </button>
        </div>

        {inputMode === 'paste' ? (
          <button
            onClick={() => setShowPasteModal(true)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Paste HTML...
          </button>
        ) : (
          <div className="flex-1 flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://truv.com/blog/..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              onKeyDown={(e) => e.key === 'Enter' && handleScrapeUrl()}
            />
            <button
              onClick={handleScrapeUrl}
              disabled={!url.trim() || isLoading}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Scraping...' : 'Scrape'}
            </button>
          </div>
        )}

        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {/* TinyMCE Editor */}
      <div className="flex-1">
        <Editor
          apiKey="kbt3o53whdx8njy7i1lufi22p7xdq79qw5qael7i1brzyme87"
          onInit={(_evt, editor) => { editorRef.current = editor; }}
          init={{
            height: '100%',
            menubar: true,
            plugins: [
              'lists', 'link', 'image', 'table', 'code',
              'fullscreen', 'help', 'wordcount',
              'searchreplace', 'visualblocks',
              'anchor', 'autolink', 'charmap', 'codesample', 'emoticons',
              'checklist', 'mediaembed', 'casechange', 'formatpainter', 'pageembed',
            ],
            toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist checklist | outdent indent | lineheight | link image table | searchreplace | casechange formatpainter | code fullscreen',
            valid_elements: '*[*]',
            valid_children: '+body[style],+head[style]',
            extended_valid_elements: '*[*]',
            entity_encoding: 'raw' as const,
            verify_html: false,
            remove_trailing_brs: false,
            content_style: 'body { margin: 0; padding: 16px; }',
            paste_data_images: true,
            image_advtab: true,
            table_advtab: true,
            table_appearance_options: true,
            link_default_target: '_blank',
            promotion: false,
            branding: false,
          }}
        />
      </div>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[800px] max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Paste HTML</h2>
              <button
                onClick={() => { setShowPasteModal(false); setPasteValue(''); }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-6 flex-1 overflow-hidden">
              <textarea
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
                placeholder="Paste your HTML here..."
                className="w-full h-[400px] px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowPasteModal(false); setPasteValue(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteLoad}
                disabled={!pasteValue.trim()}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Load into Editor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
