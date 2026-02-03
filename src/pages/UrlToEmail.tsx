import { useState, useMemo, useRef } from 'react';

interface Section {
  title: string;
  intro?: string;
  image?: string;
  imagePosition?: 'top' | 'middle' | 'bottom'; // top=after title, middle=after intro, bottom=after bullets
  bullets: string[];
}

interface EmailContent {
  subject: string;
  preview_text: string;
  hero_title: string;
  hero_date: string;
  hero_image: string;
  intro_text: string;
  showHighlights: boolean;
  highlights: string[];
  sections: Section[];
  outro_text: string;
  images: string[];
}

// Icons
const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

// Convert **bold** markdown to <strong> tags
function formatText(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

// Convert HTML to markdown-like format
function htmlToMarkdown(html: string): string {
  return html
    .replace(/<strong>|<b>/gi, '**')
    .replace(/<\/strong>|<\/b>/gi, '**')
    .replace(/<em>|<i>/gi, '*')
    .replace(/<\/em>|<\/i>/gi, '*')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// WYSIWYG Rich Text Editor component
function RichTextEditor({
  value,
  onChange,
  rows = 3,
  placeholder = ''
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const displayHtml = formatText(value).replace(/\n/g, '<br>');

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      const markdown = htmlToMarkdown(html);
      onChange(markdown);
    }
  };

  const execCommand = (command: string) => {
    document.execCommand(command, false);
    editorRef.current?.focus();
    handleInput();
  };

  return (
    <div className="border border-gray-300 rounded overflow-hidden focus-within:ring-1 focus-within:ring-blue-500">
      <div className="flex gap-1 p-1 bg-gray-50 border-b border-gray-200">
        <button type="button" onClick={() => execCommand('bold')} className="px-2 py-1 text-xs font-bold bg-white hover:bg-gray-100 rounded border border-gray-300" title="Bold">B</button>
        <button type="button" onClick={() => execCommand('italic')} className="px-2 py-1 text-xs italic bg-white hover:bg-gray-100 rounded border border-gray-300" title="Italic">I</button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        dangerouslySetInnerHTML={{ __html: displayHtml || `<span class="text-gray-400">${placeholder}</span>` }}
        className="px-3 py-2 text-sm outline-none"
        style={{ minHeight: `${rows * 1.5}em` }}
      />
    </div>
  );
}

// Inline text input with delete button
function EditableItem({
  value,
  onChange,
  onDelete,
  placeholder,
  id
}: {
  value: string;
  onChange: (value: string) => void;
  onDelete: () => void;
  placeholder: string;
  id: string;
}) {
  return (
    <div className="flex gap-1 group">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={onDelete}
        className="px-2 text-gray-300 hover:text-red-500 transition-colors"
        title="Delete"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

interface ConversionResult {
  success: boolean;
  content: EmailContent;
  html: string;
  sourceUrl: string;
  usedAI?: boolean;
  rawMarkdown?: string;
  rawImages?: string[];
}

// Generate email HTML from content
function generateEmailHtml(content: EmailContent, sourceUrl: string): string {
  const hasHighlights = content.showHighlights && content.highlights.some(h => h.trim());

  const highlightsHtml = hasHighlights
    ? `<h4 style="margin-bottom: 10px;">Key Highlights:</h4>
                                <ul style="font-size: 16px; line-height: 160%; padding-left: 20px; margin-bottom: 10px;">
                                    ${content.highlights.filter(h => h.trim()).map(h => `<li>${formatText(h)}</li>`).join('\n                                    ')}
                                </ul>`
    : '';

  const sectionsHtml = content.sections
    .filter(s => s.title.trim() || s.intro?.trim() || s.bullets.some(b => b.trim()))
    .map((section) => {
      const titleHtml = section.title.trim()
        ? `<h3 style="font-family: Gilroy, sans-serif; font-size: 22px; font-weight: 600;">${formatText(section.title)}</h3>`
        : '';
      const introHtml = section.intro?.trim()
        ? `<p style="font-size: 16px; line-height: 150%; margin-bottom: 1em;">${formatText(section.intro)}</p>`
        : '';
      const imageHtml = section.image
        ? `<p style="margin-bottom: 1em;"><img src="${section.image}" width="100%" alt="" style="height: auto; max-width: 100%; border-radius: 8px;"></p>`
        : '';
      const bulletsHtml = section.bullets.filter(b => b.trim()).length > 0
        ? `<ul style="font-size: 16px; line-height: 160%; padding-left: 20px;">
                                    ${section.bullets.filter(b => b.trim()).map(b => `<li style="margin-bottom: 8px;">${formatText(b)}</li>`).join('\n                                    ')}
                                </ul>`
        : '';

      // Arrange based on image position
      const pos = section.imagePosition || 'top';
      if (pos === 'top') {
        return `<hr>${titleHtml}${imageHtml}${introHtml}${bulletsHtml}`;
      } else if (pos === 'bottom') {
        return `<hr>${titleHtml}${introHtml}${bulletsHtml}${imageHtml}`;
      } else {
        // middle (after intro, before bullets) - default behavior
        return `<hr>${titleHtml}${introHtml}${imageHtml}${bulletsHtml}`;
      }
    })
    .join('\n');

  const introHtml = content.intro_text.trim()
    ? `<div style="font-size: 16px; line-height: 140%; margin-bottom: 20px;">${formatText(content.intro_text)}</div>`
    : '';

  const outroHtml = content.outro_text.trim()
    ? `<hr><p style="margin-bottom: 1em; font-size: 16px; line-height: 140%;">${formatText(content.outro_text)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <title>${content.subject}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        @font-face { font-family: 'Gilroy'; src: url('https://hs-19933594.f.hubspotemail.net/hubfs/19933594/Truv/Font%20Gilroy/Gilroy-Medium.woff2') format('woff2'); font-weight: 500; }
        @font-face { font-family: 'Gilroy'; src: url('https://hs-19933594.f.hubspotemail.net/hubfs/19933594/Truv/Font%20Gilroy/Gilroy-Bold.woff2') format('woff2'); font-weight: 600; }
        body, * { font-family: Gilroy, sans-serif !important; }
        p { margin: 0; } a { color: #2c64e3; }
        hr { margin: 25px 0; border: none; border-top: 1px solid #e0e0e0; }
    </style>
</head>
<body bgcolor="#E0E0E0" style="margin: 0; padding: 0; font-family: Gilroy, sans-serif; background-color: #E0E0E0; font-size:16px; color: #171717;">
    <div style="display:none!important">${content.preview_text}</div>
    <div style="background-color:#E0E0E0">
        <table role="presentation" width="100%" bgcolor="#E0E0E0" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; padding: 40px 0;">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    <div style="max-width:660px; width:100%; margin:0 auto;">
                        <!-- HERO -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background-image: url(${content.hero_image || 'https://truv.com/wp-content/themes/twentytwentyone/assets_truv/images/letter/letter-product-bg.png'}); background-color: #f6f6f6; background-size: cover; background-position: center top; background-repeat: no-repeat; border-radius: 20px 20px 0 0;">
                            <tr><td style="padding: 20px;">
                                <a href="https://truv.com"><img src="https://truv.com/wp-content/themes/twentytwentyone/assets_truv/images/logo/logo-truv.png" width="65" alt="Truv"></a>
                            </td></tr>
                            <tr><td style="padding: 15px 35px 30px;">
                                <div style="max-width: 320px;">
                                    ${content.hero_title ? `<h1 style="font-size: 38px; margin: 0 0 10px; font-weight: 600; line-height: 1.1;">${formatText(content.hero_title).replace(/\n/g, '<br>')}</h1>` : ''}
                                    ${content.hero_date ? `<p style="font-size: 22px; margin: 0 0 30px; font-weight: 500;">${content.hero_date}</p>` : ''}
                                    <a href="${sourceUrl}" style="display:inline-block; background:#2C64E3; color:#fff; padding:16px 25px; border-radius:50px; text-decoration:none; font-weight:500;">Read Full Article</a>
                                </div>
                            </td></tr>
                        </table>
                        <!-- BODY -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;">
                            <tr><td style="padding: 40px 35px;">
                                <div style="font-size: 22px; font-weight: 600; margin-bottom: 16px;">Hi there,</div>
                                ${introHtml}
                                ${highlightsHtml}
                                ${sectionsHtml}
                                ${outroHtml}
                                <a href="${sourceUrl}" style="display:inline-block; background:#2C64E3; color:#fff; padding:16px 25px; border-radius:50px; text-decoration:none; font-weight:500; margin-top:15px;">Read Full Article</a>
                            </td></tr>
                        </table>
                        <!-- FOOTER -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5; border-radius: 0 0 20px 20px;">
                            <tr><td style="padding: 30px 35px; text-align:center;">
                                <p style="font-size: 14px; color:#878A92; margin-bottom:20px;">Stay up to date on the latest Truv features and product updates!</p>
                                <p style="font-size: 14px; margin-bottom:10px;">
                                    <a href="https://help.truv.com" style="color:#171717;text-decoration:none;">Help Center</a> |
                                    <a href="https://docs.truv.com/docs/quickstart-guide" style="color:#171717;text-decoration:none;">Quickstart</a> |
                                    <a href="https://truv.com/changelog" style="color:#171717;text-decoration:none;">Changelog</a> |
                                    <a href="https://truv.com/blog" style="color:#171717;text-decoration:none;">Blog</a>
                                </p>
                                <p style="font-size: 12px; color:#878A92; margin-top:20px;">Truv Inc., 218 NW 24th Street, Miami, FL 33127</p>
                                <p style="font-size: 13px; color:#8c9298; margin-top:10px;">
                                    <a href="{{{unsubscribe}}}" style="color:#8c9298;">Unsubscribe</a>
                                </p>
                            </td></tr>
                        </table>
                    </div>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>`;
}

const GEMINI_MODELS = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  { id: 'gemini-pro', name: 'Gemini Pro' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
];

export function UrlToEmail() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isReparsingWithAI, setIsReparsingWithAI] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [editedContent, setEditedContent] = useState<EmailContent | null>(null);

  const content = editedContent || result?.content;

  const currentHtml = useMemo(() => {
    if (!content || !result) return '';
    return generateEmailHtml(content, result.sourceUrl);
  }, [content, result]);

  const handleConvert = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    setEditedContent(null);

    try {
      const response = await fetch('/api/url-to-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Conversion failed');
      // Ensure showHighlights defaults to true for backwards compatibility
      if (data.content && data.content.showHighlights === undefined) {
        data.content.showHighlights = true;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyHtml = async () => {
    try {
      await navigator.clipboard.writeText(currentHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = currentHtml;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReparseWithAI = async () => {
    if (!result?.rawMarkdown || !result?.sourceUrl) return;
    setIsReparsingWithAI(true);
    setError(null);

    try {
      const response = await fetch('/api/url-to-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: result.sourceUrl,
          useAI: true,
          model: selectedModel,
          markdown: result.rawMarkdown,
          images: result.rawImages,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI parsing failed');
      if (data.content && data.content.showHighlights === undefined) {
        data.content.showHighlights = true;
      }
      setResult(data);
      setEditedContent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI parsing failed');
    } finally {
      setIsReparsingWithAI(false);
    }
  };

  const handleReset = () => {
    setUrl('');
    setError(null);
    setResult(null);
    setEditedContent(null);
  };

  // Content update helpers
  const updateContent = (updates: Partial<EmailContent>) => {
    const current = editedContent || result?.content;
    if (current) setEditedContent({ ...current, ...updates });
  };

  // Highlight helpers
  const updateHighlight = (i: number, value: string) => {
    if (!content) return;
    const newHighlights = [...content.highlights];
    newHighlights[i] = value;
    updateContent({ highlights: newHighlights });
  };

  const deleteHighlight = (i: number) => {
    if (!content) return;
    updateContent({ highlights: content.highlights.filter((_, idx) => idx !== i) });
  };

  const addHighlight = () => {
    if (!content) return;
    updateContent({ highlights: [...content.highlights, ''] });
  };

  // Section helpers
  const updateSection = (i: number, updates: Partial<Section>) => {
    if (!content) return;
    const newSections = content.sections.map((s, idx) => idx === i ? { ...s, ...updates } : s);
    updateContent({ sections: newSections });
  };

  const deleteSection = (i: number) => {
    if (!content) return;
    updateContent({ sections: content.sections.filter((_, idx) => idx !== i) });
  };

  const addSection = () => {
    if (!content) return;
    updateContent({ sections: [...content.sections, { title: '', intro: '', imagePosition: 'top', bullets: [''] }] });
  };

  // Bullet helpers
  const updateBullet = (sIdx: number, bIdx: number, value: string) => {
    if (!content) return;
    const newSections = content.sections.map((s, i) => {
      if (i === sIdx) {
        const newBullets = [...s.bullets];
        newBullets[bIdx] = value;
        return { ...s, bullets: newBullets };
      }
      return s;
    });
    updateContent({ sections: newSections });
  };

  const deleteBullet = (sIdx: number, bIdx: number) => {
    if (!content) return;
    const newSections = content.sections.map((s, i) => {
      if (i === sIdx) {
        return { ...s, bullets: s.bullets.filter((_, idx) => idx !== bIdx) };
      }
      return s;
    });
    updateContent({ sections: newSections });
  };

  const addBullet = (sIdx: number) => {
    if (!content) return;
    const newSections = content.sections.map((s, i) => {
      if (i === sIdx) {
        return { ...s, bullets: [...s.bullets, ''] };
      }
      return s;
    });
    updateContent({ sections: newSections });
  };

  return (
    <div className="h-full flex">
      {/* Left Panel - Editor */}
      <div className="w-[420px] border-r border-gray-200 bg-white flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">URL to Email</h1>
          <p className="mt-1 text-sm text-gray-600">Convert blog posts into SendGrid-ready email</p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* URL Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Blog/Article URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://truv.com/blog/..."
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
            />
          </div>

          <button
            onClick={handleConvert}
            disabled={!url.trim() || isLoading}
            className="w-full px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed mb-4"
          >
            {isLoading ? 'Converting...' : 'Convert to Email'}
          </button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Edit Form */}
          {content && !isLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-green-700 bg-green-50 px-2 py-1 rounded">Ready to edit</span>
                  {result?.usedAI && <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded">AI</span>}
                </div>
                <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700">Reset</button>
              </div>

              {/* AI Re-parse */}
              {result?.rawMarkdown && (
                <div className="flex gap-2">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {GEMINI_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <button
                    onClick={handleReparseWithAI}
                    disabled={isReparsingWithAI}
                    className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:bg-purple-300"
                  >
                    {isReparsingWithAI ? '...' : '✨ AI Parse'}
                  </button>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Subject Line</label>
                <input
                  type="text"
                  value={content.subject}
                  onChange={(e) => updateContent({ subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>

              {/* Preview Text */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Preview Text</label>
                <input
                  type="text"
                  value={content.preview_text}
                  onChange={(e) => updateContent({ preview_text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="Shows in email client preview..."
                />
              </div>

              {/* Hero Title */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Hero Title</label>
                <textarea
                  value={content.hero_title}
                  onChange={(e) => updateContent({ hero_title: e.target.value })}
                  placeholder="Leave empty to hide"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Enter for line breaks. Max ~320px width.</p>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Date</label>
                <input
                  type="text"
                  value={content.hero_date}
                  onChange={(e) => updateContent({ hero_date: e.target.value })}
                  placeholder="Leave empty to hide"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>

              {/* Header Image */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Header Image</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => updateContent({ hero_image: '' })}
                    className={`h-12 border-2 rounded flex items-center justify-center text-xs ${!content.hero_image ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                  >
                    None
                  </button>
                  {content.images?.slice(0, 7).map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => updateContent({ hero_image: img })}
                      className={`h-12 border-2 rounded overflow-hidden ${content.hero_image === img ? 'border-blue-500' : 'border-gray-200'}`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                <input
                  type="url"
                  value={content.hero_image}
                  onChange={(e) => updateContent({ hero_image: e.target.value })}
                  placeholder="Or paste custom URL..."
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>

              {/* Intro Text */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Intro Text</label>
                <RichTextEditor
                  value={content.intro_text}
                  onChange={(value) => updateContent({ intro_text: value })}
                  rows={3}
                  placeholder="Opening paragraph (leave empty to hide)..."
                />
              </div>

              {/* Key Highlights */}
              <div className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-500 uppercase">Key Highlights</label>
                  <label className="flex items-center gap-2 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={content.showHighlights}
                      onChange={(e) => updateContent({ showHighlights: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    Show
                  </label>
                </div>
                {content.showHighlights && (
                  <div className="space-y-2">
                    {content.highlights.map((h, i) => (
                      <EditableItem
                        key={i}
                        id={`highlight-${i}`}
                        value={h}
                        onChange={(v) => updateHighlight(i, v)}
                        onDelete={() => deleteHighlight(i)}
                        placeholder={`Highlight ${i + 1}`}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={addHighlight}
                      className="w-full py-1.5 border border-dashed border-gray-300 rounded text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-1"
                    >
                      <PlusIcon /> Add Highlight
                    </button>
                  </div>
                )}
              </div>

              {/* Sections */}
              {content.sections.map((section, sIdx) => (
                <div key={sIdx} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-500 uppercase">Section {sIdx + 1}</label>
                    <button type="button" onClick={() => deleteSection(sIdx)} className="text-gray-300 hover:text-red-500" title="Delete section">
                      <TrashIcon />
                    </button>
                  </div>

                  {/* Title */}
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => updateSection(sIdx, { title: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm font-medium mb-2"
                    placeholder="Section title"
                  />

                  {/* Intro */}
                  <div className="mb-2">
                    <label className="block text-xs text-gray-400 mb-1">Intro (optional)</label>
                    <RichTextEditor
                      value={section.intro || ''}
                      onChange={(v) => updateSection(sIdx, { intro: v || undefined })}
                      rows={2}
                      placeholder="Optional intro paragraph..."
                    />
                  </div>

                  {/* Image */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-400">Image</label>
                      {section.image && (
                        <select
                          value={section.imagePosition || 'top'}
                          onChange={(e) => updateSection(sIdx, { imagePosition: e.target.value as 'top' | 'middle' | 'bottom' })}
                          className="text-xs border border-gray-200 rounded px-1 py-0.5"
                        >
                          <option value="top">After Title</option>
                          <option value="middle">After Intro</option>
                          <option value="bottom">After Bullets</option>
                        </select>
                      )}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => updateSection(sIdx, { image: undefined })}
                        className={`h-8 px-2 border rounded text-xs ${!section.image ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                      >
                        None
                      </button>
                      {content.images?.slice(0, 6).map((img, imgIdx) => (
                        <button
                          key={imgIdx}
                          type="button"
                          onClick={() => updateSection(sIdx, { image: img })}
                          className={`h-8 w-12 border rounded overflow-hidden ${section.image === img ? 'border-blue-500' : 'border-gray-200'}`}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bullets */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-400">Bullets</label>
                    {section.bullets.map((b, bIdx) => (
                      <EditableItem
                        key={bIdx}
                        id={`section-${sIdx}-bullet-${bIdx}`}
                        value={b}
                        onChange={(v) => updateBullet(sIdx, bIdx, v)}
                        onDelete={() => deleteBullet(sIdx, bIdx)}
                        placeholder={`Bullet ${bIdx + 1}`}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => addBullet(sIdx)}
                      className="w-full py-1 border border-dashed border-gray-200 rounded text-xs text-gray-400 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-1"
                    >
                      <PlusIcon /> Add Bullet
                    </button>
                  </div>
                </div>
              ))}

              {/* Add Section */}
              <button
                type="button"
                onClick={addSection}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2"
              >
                <PlusIcon /> Add Section
              </button>

              {/* Outro */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Outro Text</label>
                <RichTextEditor
                  value={content.outro_text}
                  onChange={(value) => updateContent({ outro_text: value })}
                  rows={2}
                  placeholder="Closing paragraph (leave empty to hide)..."
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Preview */}
      <div className="flex-1 bg-gray-100 flex flex-col">
        <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-medium text-gray-900">Email Preview</h2>
          {content && !isLoading && (
            <button
              onClick={handleCopyHtml}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {copied ? '✓ Copied!' : 'Copy HTML'}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto p-6 flex justify-center">
          {!result && !isLoading && (
            <div className="flex items-center justify-center h-full text-center text-gray-500">
              <div>
                <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-lg font-medium">Paste a URL and click Convert</p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="animate-spin mx-auto h-12 w-12 text-blue-600 mb-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-gray-700">Converting...</p>
              </div>
            </div>
          )}

          {content && !isLoading && (
            <div
              className="bg-white shadow-lg rounded-lg overflow-hidden"
              style={{ width: '700px', maxWidth: '100%' }}
              dangerouslySetInnerHTML={{ __html: currentHtml }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
