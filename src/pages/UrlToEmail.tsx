import { useState, useMemo } from 'react';

interface Section {
  title: string;
  image?: string;
  bullets: string[];
}

interface EmailContent {
  subject: string;
  preview_text: string;
  hero_date: string;
  hero_image: string;
  intro_text: string;
  highlights: string[];
  sections: Section[];
  outro_text: string;
  images: string[];
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
  const highlightsHtml = content.highlights
    .filter(h => h.trim())
    .map(h => `<li>${h}</li>`)
    .join('\n                                                    ');

  const sectionsHtml = content.sections
    .filter(s => s.title.trim())
    .map((section) => {
      const imageHtml = section.image
        ? `<p style="margin-bottom: 1em;"><img src="${section.image}" width="100%" alt="" style="height: auto; max-width: 100%; border-radius: 8px;"></p>`
        : '';

      const bulletsHtml = section.bullets
        .filter(b => b.trim())
        .map(b => `<li style="margin-bottom: 8px;">${b}</li>`)
        .join('\n                                                    ');

      return `
                                                <hr>
                                                <h3 style="font-family: Gilroy, sans-serif; font-size: 22px; font-weight: 600;">${section.title}</h3>
                                                ${imageHtml}
                                                <ul style="font-size: 16px; line-height: 160%; padding-left: 20px;">
                                                    ${bulletsHtml}
                                                </ul>`;
    })
    .join('\n');

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
                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f6f6; border-radius: 20px 20px 0 0;">
                            <tr><td style="padding: 20px;">
                                <a href="https://truv.com"><img src="https://truv.com/wp-content/themes/twentytwentyone/assets_truv/images/logo/logo-truv.png" width="65" alt="Truv"></a>
                            </td></tr>
                            <tr><td style="padding: 15px 35px 20px;">
                                <h1 style="font-size: 38px; margin: 0 0 10px; font-weight: 600;">Product Update</h1>
                                <p style="font-size: 22px; margin: 0 0 20px; font-weight: 500;">${content.hero_date}</p>
                            </td></tr>
                            ${content.hero_image ? `<tr><td style="padding: 0 35px 20px;">
                                <img src="${content.hero_image}" width="100%" alt="" style="border-radius: 12px; max-width: 100%; height: auto;">
                            </td></tr>` : ''}
                            <tr><td style="padding: 0 35px 40px;">
                                <a href="${sourceUrl}" style="display:inline-block; background:#2C64E3; color:#fff; padding:16px 25px; border-radius:50px; text-decoration:none; font-weight:500;">Read Full Article</a>
                            </td></tr>
                        </table>
                        <!-- BODY -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;">
                            <tr><td style="padding: 40px 35px;">
                                <div style="font-size: 22px; font-weight: 600; margin-bottom: 16px;">Hi there,</div>
                                <div style="font-size: 16px; line-height: 140%; margin-bottom: 20px;">${content.intro_text}</div>
                                <h4 style="margin-bottom: 10px;">Key Highlights:</h4>
                                <ul style="font-size: 16px; line-height: 160%; padding-left: 20px; margin-bottom: 10px;">
                                    ${highlightsHtml}
                                </ul>
                                ${sectionsHtml}
                                <hr>
                                <p style="margin-bottom: 1em; font-size: 16px; line-height: 140%;">${content.outro_text}</p>
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

export function UrlToEmail() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isReparsingWithAI, setIsReparsingWithAI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [, setEditMode] = useState(false);

  // Editable content state
  const [editedContent, setEditedContent] = useState<EmailContent | null>(null);

  // Use edited content if available, otherwise original
  const content = editedContent || result?.content;

  // Generate HTML from current content
  const currentHtml = useMemo(() => {
    if (!content || !result) return '';
    return generateEmailHtml(content, result.sourceUrl);
  }, [content, result]);

  const handleConvert = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setEditMode(false);
    setEditedContent(null);

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
          markdown: result.rawMarkdown,
          images: result.rawImages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'AI parsing failed');
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
    setIsLoading(false);
    setError(null);
    setResult(null);
    setEditMode(false);
    setEditedContent(null);
  };

  const updateContent = (updates: Partial<EmailContent>) => {
    const current = editedContent || result?.content;
    if (current) {
      setEditedContent({ ...current, ...updates });
    }
  };

  const updateHighlight = (index: number, value: string) => {
    if (!content) return;
    const newHighlights = [...content.highlights];
    newHighlights[index] = value;
    updateContent({ highlights: newHighlights });
  };

  const updateSection = (sectionIndex: number, updates: Partial<Section>) => {
    if (!content) return;
    const newSections = content.sections.map((s, i) =>
      i === sectionIndex ? { ...s, ...updates } : s
    );
    updateContent({ sections: newSections });
  };

  const updateSectionBullet = (sectionIndex: number, bulletIndex: number, value: string) => {
    if (!content) return;
    const newSections = content.sections.map((s, i) => {
      if (i === sectionIndex) {
        const newBullets = [...s.bullets];
        newBullets[bulletIndex] = value;
        return { ...s, bullets: newBullets };
      }
      return s;
    });
    updateContent({ sections: newSections });
  };

  return (
    <div className="h-full flex">
      {/* Left Panel */}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
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
                  {result?.usedAI && (
                    <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded">AI Enhanced</span>
                  )}
                </div>
                <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700">Reset</button>
              </div>

              {/* AI Re-parse Button */}
              {!result?.usedAI && result?.rawMarkdown && (
                <button
                  onClick={handleReparseWithAI}
                  disabled={isReparsingWithAI}
                  className="w-full px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isReparsingWithAI ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Re-parsing with AI...
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      Re-parse with AI
                    </>
                  )}
                </button>
              )}

              {/* Subject */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Subject Line</label>
                <input
                  type="text"
                  value={content.subject}
                  onChange={(e) => updateContent({ subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Date</label>
                <input
                  type="text"
                  value={content.hero_date}
                  onChange={(e) => updateContent({ hero_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Header Image */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Header Image</label>
                {content.images && content.images.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      {/* No image option */}
                      <button
                        type="button"
                        onClick={() => updateContent({ hero_image: '' })}
                        className={`h-16 border-2 rounded flex items-center justify-center text-xs text-gray-500 transition-colors ${
                          !content.hero_image ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        No image
                      </button>
                      {/* Image thumbnails */}
                      {content.images.map((img, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => updateContent({ hero_image: img })}
                          className={`h-16 border-2 rounded overflow-hidden transition-colors ${
                            content.hero_image === img ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <img src={img} alt={`Option ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                    <input
                      type="url"
                      value={content.hero_image}
                      onChange={(e) => updateContent({ hero_image: e.target.value })}
                      placeholder="Or paste custom image URL..."
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                ) : (
                  <input
                    type="url"
                    value={content.hero_image}
                    onChange={(e) => updateContent({ hero_image: e.target.value })}
                    placeholder="Paste image URL..."
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Intro */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Intro Text</label>
                <textarea
                  value={content.intro_text}
                  onChange={(e) => updateContent({ intro_text: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Highlights */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Key Highlights</label>
                <div className="space-y-2">
                  {content.highlights.map((h, i) => (
                    <input
                      key={i}
                      type="text"
                      value={h}
                      onChange={(e) => updateHighlight(i, e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder={`Highlight ${i + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* Sections */}
              {content.sections.map((section, sIdx) => (
                <div key={sIdx} className="border border-gray-200 rounded-lg p-3">
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Section {sIdx + 1}</label>
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => updateSection(sIdx, { title: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm font-medium mb-2 focus:ring-1 focus:ring-blue-500"
                    placeholder="Section title"
                  />

                  {/* Section Image */}
                  <div className="mb-2">
                    <label className="block text-xs text-gray-400 mb-1">Image</label>
                    <div className="flex gap-1 flex-wrap mb-1">
                      <button
                        type="button"
                        onClick={() => updateSection(sIdx, { image: undefined })}
                        className={`h-10 px-2 border rounded text-xs transition-colors ${
                          !section.image ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        None
                      </button>
                      {content.images.map((img, imgIdx) => (
                        <button
                          key={imgIdx}
                          type="button"
                          onClick={() => updateSection(sIdx, { image: img })}
                          className={`h-10 w-14 border rounded overflow-hidden transition-colors ${
                            section.image === img ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                    {section.image && (
                      <input
                        type="url"
                        value={section.image}
                        onChange={(e) => updateSection(sIdx, { image: e.target.value || undefined })}
                        placeholder="Or paste custom URL..."
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {section.bullets.map((b, bIdx) => (
                      <input
                        key={bIdx}
                        type="text"
                        value={b}
                        onChange={(e) => updateSectionBullet(sIdx, bIdx, e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder={`Bullet ${bIdx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Outro */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Outro Text</label>
                <textarea
                  value={content.outro_text}
                  onChange={(e) => updateContent({ outro_text: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
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
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                copied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
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

