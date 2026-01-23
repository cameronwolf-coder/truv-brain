import { useState } from 'react';

const COLORS = [
  { name: 'Truv Blue (Primary)', hex: '#2C64E3', usage: 'CTAs, buttons, links, key highlights' },
  { name: 'Accent Blue', hex: '#2A5FD8', usage: 'Secondary buttons, hover states' },
  { name: 'Background', hex: '#F3F3F3', usage: 'Page backgrounds' },
  { name: 'Dark', hex: '#171717', usage: 'Primary text, headings' },
  { name: 'Gray', hex: '#3C3C43', usage: 'Secondary text, body copy' },
  { name: 'White', hex: '#FFFFFF', usage: 'Cards, inputs, containers' },
  { name: 'Border Gray', hex: '#A7A7A7', usage: 'Input borders' },
];

const VOICE_TRAITS = [
  {
    trait: 'Confident & Authoritative',
    description: 'Position as industry leader with data and proof points',
    examples: [
      'The only unified platform purpose-built for...',
      'Industry-leading conversion rates',
      'Approved by Fannie Mae and Freddie Mac',
    ],
  },
  {
    trait: 'Clear & Direct',
    description: 'Plain language, short sentences, active voice',
    examples: [
      'Make confident decisions.',
      'Verify borrowers instantly.',
      'Save 80% on verifications.',
    ],
  },
  {
    trait: 'Professional but Approachable',
    description: 'B2B tone with warmth, educational without condescension',
    examples: [
      "We'd love to set up a demo",
      "Let's chat about...",
      'Reach out to learn more',
    ],
  },
  {
    trait: 'Customer-Centric',
    description: 'Focus on benefits, not features. Emphasize ROI and savings.',
    examples: [
      'Delight your users with a seamless experience',
      'Save $350 or more per closed loan',
    ],
  },
];

const MESSAGING_PILLARS = [
  {
    pillar: 'Cost Savings',
    headline: 'Save 35-80% vs current solutions',
    proofPoints: ['Save $350+ per closed loan', '70%+ savings guaranteed (Enterprise)', 'Free re-verifications'],
    keywords: ['savings', 'ROI', 'cost-effective', 'margins'],
  },
  {
    pillar: 'Speed & Efficiency',
    headline: 'Verify in seconds, not days',
    proofPoints: ['Verify in <45 seconds', 'Go live in days', '90% fill rates'],
    keywords: ['accelerate', 'streamline', 'instant', 'automated'],
  },
  {
    pillar: 'Data Quality & Trust',
    headline: 'Direct-to-source, real-time data',
    proofPoints: ['GSE approved', '96% US workforce coverage', '99.99% fraud detection'],
    keywords: ['accurate', 'reliable', 'trusted', 'secure'],
  },
  {
    pillar: 'Conversion & UX',
    headline: 'Industry-leading conversion rates',
    proofPoints: ['Best-in-class coverage', 'Beautiful UX', 'Higher NPS'],
    keywords: ['seamless', 'frictionless', 'delight', 'conversion'],
  },
  {
    pillar: 'All-in-One Platform',
    headline: 'One platform for all verifications',
    proofPoints: ['Unified platform', 'Waterfall verification', 'Multiple integrations'],
    keywords: ['unified', 'complete', 'comprehensive', 'integrated'],
  },
];

const TERMINOLOGY = [
  { use: 'Consumer-permissioned data', avoid: 'Screen scraping' },
  { use: 'Direct-to-source', avoid: 'Instant database' },
  { use: 'Front-door access', avoid: 'Back-door access' },
  { use: 'Verification', avoid: 'Validation' },
  { use: 'Borrower', avoid: 'Applicant (for mortgage)' },
  { use: 'Conversion rate', avoid: 'Success rate' },
  { use: 'Fill rate', avoid: 'Data completeness' },
];

const ACRONYMS = [
  { abbr: 'AIM', full: 'Asset and Income Modeler (Freddie Mac)' },
  { abbr: 'D1C', full: 'Day 1 Certainty (Fannie Mae)' },
  { abbr: 'DDS', full: 'Direct Deposit Switch' },
  { abbr: 'VOIE', full: 'Verification of Income & Employment' },
  { abbr: 'VOE', full: 'Verification of Employment' },
  { abbr: 'GSE', full: 'Government-Sponsored Enterprise' },
  { abbr: 'LOS', full: 'Loan Origination System' },
  { abbr: 'POS', full: 'Point of Sale' },
];

type TabId = 'visual' | 'voice' | 'messaging' | 'terminology';

export function Brand() {
  const [activeTab, setActiveTab] = useState<TabId>('visual');
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

  const copyColor = async (hex: string) => {
    await navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    setTimeout(() => setCopiedColor(null), 2000);
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'visual', label: 'Visual Identity' },
    { id: 'voice', label: 'Voice & Tone' },
    { id: 'messaging', label: 'Messaging Pillars' },
    { id: 'terminology', label: 'Terminology' },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Brand Guidelines</h1>
        <p className="text-gray-500 mt-1">
          Voice, tone, visual identity, and messaging standards
        </p>
      </div>

      {/* Brand Identity Banner */}
      <div className="bg-blue-600 text-white rounded-xl p-6 mb-6">
        <p className="text-sm uppercase tracking-wide opacity-75 mb-2">Primary Tagline</p>
        <h2 className="text-2xl font-bold mb-4">"Unlock the power of open finance"</h2>
        <p className="opacity-90">
          The Industry-Leading Consumer Permissioned Data Platform
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'visual' && (
        <div className="space-y-6">
          {/* Colors */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-medium text-gray-900 mb-4">Color Palette</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {COLORS.map((color) => (
                <button
                  key={color.hex}
                  onClick={() => copyColor(color.hex)}
                  className="text-left group"
                >
                  <div
                    className="h-16 rounded-lg mb-2 border border-gray-200 group-hover:ring-2 ring-blue-500 transition-all"
                    style={{ backgroundColor: color.hex }}
                  />
                  <p className="text-sm font-medium text-gray-900">{color.name}</p>
                  <p className="text-xs text-gray-500">
                    {copiedColor === color.hex ? 'Copied!' : color.hex}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{color.usage}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Typography */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-medium text-gray-900 mb-4">Typography</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Primary Font</p>
                <p className="text-2xl font-semibold">Gilroy</p>
                <p className="text-sm text-gray-500 mt-1">Fallback: Inter, sans-serif</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Font Weights</p>
                  <p className="font-medium">500 (Medium) - Body text</p>
                  <p className="font-semibold">600-700 - Headings</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Design Elements</p>
                  <p className="text-sm text-gray-600">Border Radius: 20px (cards)</p>
                  <p className="text-sm text-gray-600">Input Radius: 50px (pill)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'voice' && (
        <div className="space-y-4">
          {VOICE_TRAITS.map((item) => (
            <div key={item.trait} className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-medium text-gray-900 mb-1">{item.trait}</h3>
              <p className="text-sm text-gray-500 mb-3">{item.description}</p>
              <div className="flex flex-wrap gap-2">
                {item.examples.map((ex, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    "{ex}"
                  </span>
                ))}
              </div>
            </div>
          ))}

          {/* Email Guidelines */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-medium text-gray-900 mb-3">Email Subject Lines</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Lead with value/benefit</li>
              <li>• Include numbers when possible</li>
              <li>• Maximum 50 characters</li>
              <li>• Lowercase, informal style</li>
              <li>• No punctuation at end</li>
            </ul>
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Examples:</p>
              <p className="text-sm text-gray-700">"save 80% on income verifications"</p>
              <p className="text-sm text-gray-700">"new: Truv + Encompass integration"</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'messaging' && (
        <div className="space-y-4">
          {MESSAGING_PILLARS.map((pillar) => (
            <div key={pillar.pillar} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">{pillar.pillar}</h3>
                  <p className="text-blue-600 font-medium">{pillar.headline}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Proof Points</p>
                  <ul className="space-y-1">
                    {pillar.proofPoints.map((point, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                        <span className="text-green-500">✓</span> {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">Keywords</p>
                  <div className="flex flex-wrap gap-1">
                    {pillar.keywords.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'terminology' && (
        <div className="space-y-6">
          {/* Preferred Terms */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-medium text-gray-900 mb-4">Preferred Terms</h3>
            <div className="space-y-2">
              {TERMINOLOGY.map((term, i) => (
                <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1">
                    <span className="text-green-600 font-medium">✓ Use:</span>
                    <span className="ml-2 text-gray-900">{term.use}</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-red-500 font-medium">✗ Avoid:</span>
                    <span className="ml-2 text-gray-500">{term.avoid}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Acronyms */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-medium text-gray-900 mb-4">Industry Acronyms</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ACRONYMS.map((item) => (
                <div key={item.abbr} className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-bold text-blue-600">{item.abbr}</p>
                  <p className="text-xs text-gray-600 mt-1">{item.full}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Brand Names */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-medium text-gray-900 mb-4">Brand Name Capitalization</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div className="p-2 bg-gray-50 rounded"><strong>Truv</strong> (never "TRUV" or "truv")</div>
              <div className="p-2 bg-gray-50 rounded"><strong>Truv Bridge</strong></div>
              <div className="p-2 bg-gray-50 rounded"><strong>Truv Dashboard</strong></div>
              <div className="p-2 bg-gray-50 rounded"><strong>Fannie Mae</strong></div>
              <div className="p-2 bg-gray-50 rounded"><strong>Freddie Mac</strong></div>
              <div className="p-2 bg-gray-50 rounded"><strong>Encompass®</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
