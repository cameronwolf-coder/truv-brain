import { Link } from 'react-router-dom';
import segments from '../data/segments.json';

export function Home() {
  const totalContacts = (segments as { totalTargetable?: number }).totalTargetable || 134796;

  return (
    <div className="p-8">
      {/* Hero Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Truv Brain</h1>
        <p className="text-lg text-gray-600 mt-2">
          The central knowledge base for Truv's go-to-market teams
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Sales • Marketing • RevOps
        </p>
      </div>

      {/* Key Stats Banner */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-blue-600 rounded-xl text-white text-center">
          <p className="text-3xl font-bold">80%</p>
          <p className="text-sm opacity-90">Cost savings vs TWN</p>
        </div>
        <div className="p-4 bg-blue-600 rounded-xl text-white text-center">
          <p className="text-3xl font-bold">96%</p>
          <p className="text-sm opacity-90">US workforce coverage</p>
        </div>
        <div className="p-4 bg-blue-600 rounded-xl text-white text-center">
          <p className="text-3xl font-bold">$350</p>
          <p className="text-sm opacity-90">Savings per loan</p>
        </div>
        <div className="p-4 bg-blue-600 rounded-xl text-white text-center">
          <p className="text-3xl font-bold">{(totalContacts / 1000).toFixed(0)}K</p>
          <p className="text-sm opacity-90">Targetable contacts</p>
        </div>
      </div>

      {/* Main Navigation Grid */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Knowledge Base</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Link
          to="/proof-points"
          className="p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <span className="text-2xl">📚</span>
          <h3 className="font-semibold text-gray-900 mt-2 group-hover:text-blue-600">Proof Points</h3>
          <p className="text-sm text-gray-500 mt-1">
            15 customer stories with verified metrics and quotes
          </p>
        </Link>

        <Link
          to="/products"
          className="p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <span className="text-2xl">📦</span>
          <h3 className="font-semibold text-gray-900 mt-2 group-hover:text-blue-600">Products</h3>
          <p className="text-sm text-gray-500 mt-1">
            6 products with benefits, use cases, and pain point mapping
          </p>
        </Link>

        <Link
          to="/personas"
          className="p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <span className="text-2xl">👤</span>
          <h3 className="font-semibold text-gray-900 mt-2 group-hover:text-blue-600">Personas</h3>
          <p className="text-sm text-gray-500 mt-1">
            Buyer personas with messaging focus and HubSpot stats
          </p>
        </Link>

        <Link
          to="/brand"
          className="p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <span className="text-2xl">🎨</span>
          <h3 className="font-semibold text-gray-900 mt-2 group-hover:text-blue-600">Brand Guidelines</h3>
          <p className="text-sm text-gray-500 mt-1">
            Voice, tone, colors, typography, and messaging pillars
          </p>
        </Link>

        <Link
          to="/campaigns"
          className="p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <span className="text-2xl">📧</span>
          <h3 className="font-semibold text-gray-900 mt-2 group-hover:text-blue-600">Campaign Logic</h3>
          <p className="text-sm text-gray-500 mt-1">
            Segmentation matrix, pain point mapping, email sequences
          </p>
        </Link>

        <Link
          to="/email-builder"
          className="p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <span className="text-2xl">✉️</span>
          <h3 className="font-semibold text-gray-900 mt-2 group-hover:text-blue-600">Email Builder</h3>
          <p className="text-sm text-gray-500 mt-1">
            Generate segment-specific templates for Clay
          </p>
        </Link>
      </div>

      {/* Tools Section */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Tools & Resources</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <a
          href="https://roi-calc-internal-gamma.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <span className="text-xl">🧮</span>
          <h3 className="font-medium text-gray-900 mt-2 group-hover:text-blue-600">ROI Calculator</h3>
          <p className="text-xs text-gray-500 mt-1">For sales demos</p>
        </a>

        <a
          href="https://github.com/cameronwolf-coder/truv-brain"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <span className="text-xl">📁</span>
          <h3 className="font-medium text-gray-900 mt-2 group-hover:text-blue-600">GitHub Repo</h3>
          <p className="text-xs text-gray-500 mt-1">Source & docs</p>
        </a>

        <a
          href="https://truv.com"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <span className="text-xl">🌐</span>
          <h3 className="font-medium text-gray-900 mt-2 group-hover:text-blue-600">Truv Website</h3>
          <p className="text-xs text-gray-500 mt-1">truv.com</p>
        </a>

        <a
          href="https://docs.truv.com"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <span className="text-xl">📖</span>
          <h3 className="font-medium text-gray-900 mt-2 group-hover:text-blue-600">API Docs</h3>
          <p className="text-xs text-gray-500 mt-1">docs.truv.com</p>
        </a>
      </div>

      {/* Footer */}
      <div className="pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-500">
          <strong>Owner:</strong> Cameron Wolf — Sr. Marketing Manager
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Questions? Slack #marketing or email cameron@truv.com
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Data: HubSpot live stats + truv.com content via Firecrawl • Last updated: January 2026
        </p>
      </div>
    </div>
  );
}
