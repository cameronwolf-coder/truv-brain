export function About() {
  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">About Truv Brain</h1>
        <p className="text-gray-500 mt-1">
          The central knowledge base for Truv's go-to-market teams
        </p>
      </div>

      {/* What's Inside */}
      <section className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-3">What's Inside</h2>
        <div className="space-y-3">
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <span>📚</span> Proof Points
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              15 customer stories with verified metrics and quotes. Filter by
              vertical, metric type, or search by keyword.
            </p>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <span>✉️</span> Email Builder
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Generate segment-specific email templates. Select vertical,
              objection, and persona to get pre-filled templates with Clay
              personalization prompts.
            </p>
          </div>
        </div>
      </section>

      {/* Key Stats */}
      <section className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Key Stats</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-700">80%</p>
            <p className="text-sm text-blue-600">Cost savings vs TWN</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-700">96%</p>
            <p className="text-sm text-blue-600">US workforce coverage</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-700">$350</p>
            <p className="text-sm text-blue-600">Savings per loan</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-700">65-70%</p>
            <p className="text-sm text-blue-600">Conversion rates</p>
          </div>
        </div>
      </section>

      {/* Links */}
      <section className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Resources</h2>
        <div className="space-y-2">
          <a
            href="https://github.com/cameronwolf-coder/truv-brain"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl">📁</span>
            <div>
              <p className="font-medium text-gray-900">GitHub Repository</p>
              <p className="text-sm text-gray-500">Source code and documentation</p>
            </div>
          </a>
          <a
            href="https://github.com/cameronwolf-coder/truv-brain/blob/main/docs/brand-guidelines.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl">📝</span>
            <div>
              <p className="font-medium text-gray-900">Brand Guidelines</p>
              <p className="text-sm text-gray-500">Voice, tone, visual identity</p>
            </div>
          </a>
          <a
            href="https://github.com/cameronwolf-coder/truv-brain/blob/main/docs/content-reference.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl">📊</span>
            <div>
              <p className="font-medium text-gray-900">Content Reference</p>
              <p className="text-sm text-gray-500">Full customer stories and metrics</p>
            </div>
          </a>
        </div>
      </section>

      {/* Data Source */}
      <section className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Data Source</h2>
        <p className="text-sm text-gray-600">
          Content extracted from{' '}
          <a
            href="https://truv.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            truv.com
          </a>{' '}
          using Firecrawl. Last updated January 2025.
        </p>
      </section>

      {/* Owner */}
      <section>
        <h2 className="text-lg font-medium text-gray-900 mb-3">Owner</h2>
        <p className="text-sm text-gray-600">
          <strong>Cameron Wolf</strong> — Sr. Marketing Manager
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Questions? Slack #marketing or email cameron@truv.com
        </p>
      </section>
    </div>
  );
}
