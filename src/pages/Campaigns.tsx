import { useState } from 'react';
import { Link } from 'react-router-dom';
import segments from '../data/segments.json';

const PAIN_POINT_MAPPING = {
  price: {
    label: 'Price/Budget',
    painPoints: [
      { pain: 'Verification costs too high', feature: 'Consumer-permissioned VOIE', proof: '80% savings vs TWN — AmeriSave' },
      { pain: 'Per-loan costs eating margins', feature: 'Transparent pricing', proof: 'Costs dropped 8→3 bps — Revolution' },
      { pain: 'Re-verification fees', feature: 'Free re-verifications (90 days)', proof: '$350 savings per loan' },
    ],
  },
  timing: {
    label: 'Timing/Roadmap',
    painPoints: [
      { pain: 'Long implementation timeline', feature: 'Rapid deployment', proof: 'Go live in days, not months' },
      { pain: 'Resource constraints', feature: 'White-glove onboarding', proof: '<1 month custom implementation — CrossCountry' },
      { pain: 'Integration complexity', feature: 'Pre-built LOS/POS integrations', proof: 'One-click re-verification in LOS' },
    ],
  },
  competitor: {
    label: 'Competitor Chosen',
    painPoints: [
      { pain: 'Locked into TWN', feature: 'Easy migration + cost savings', proof: '40% reduction in TWN usage — MortgageRight' },
      { pain: 'Data quality concerns', feature: 'Direct-to-source data', proof: 'More granular, comprehensive data — MortgageRight' },
      { pain: 'Coverage gaps', feature: '96% US workforce coverage', proof: '90% US insurance policy holders' },
    ],
  },
  bandwidth: {
    label: 'Internal Bandwidth',
    painPoints: [
      { pain: 'Team overloaded', feature: 'Reduced manual work', proof: '90% reduction in manual tasks — Piedmont' },
      { pain: 'Support burden', feature: 'Dedicated support', proof: '4-hour support response — First Continental' },
      { pain: 'Training requirements', feature: 'Intuitive UX', proof: 'Beautiful UX optimized for conversion' },
    ],
  },
  no_decision: {
    label: 'No Decision',
    painPoints: [
      { pain: 'Unclear ROI', feature: 'Measurable savings', proof: '$10M/year savings — CrossCountry' },
      { pain: 'Risk concerns', feature: 'GSE approval', proof: 'Fannie Mae & Freddie Mac approved' },
      { pain: 'Fraud concerns', feature: 'Built-in fraud detection', proof: '+15% fraud detection — HFS' },
    ],
  },
};

const SEQUENCE_TOUCHES = [
  {
    touch: 1,
    day: 1,
    name: 'Re-introduction',
    subject: '{{vertical}} verification costs eating your margins?',
    description: 'Reference previous conversation, acknowledge blocker, share new proof point',
  },
  {
    touch: 2,
    day: 4,
    name: 'Value Stack',
    subject: 'how {{proof_company}} saved {{proof_metric}}',
    description: 'Customer story with specific results, 3 bullet points of impact',
  },
  {
    touch: 3,
    day: 9,
    name: 'Direct Ask',
    subject: 'closing the loop on truv',
    description: 'Final follow-up, offer easy out, direct CTA',
  },
];

const KPIS = [
  { metric: 'Open Rate', target: '>40%', measurement: 'By segment (vertical × objection)' },
  { metric: 'Reply Rate', target: '>8%', measurement: 'Positive + negative replies' },
  { metric: 'Meeting Booked', target: '>3%', measurement: 'From total sent' },
  { metric: 'Sequence Completion', target: '>60%', measurement: 'All 3 touches received' },
];

type TabId = 'segmentation' | 'painpoints' | 'sequence' | 'kpis';

export function Campaigns() {
  const [activeTab, setActiveTab] = useState<TabId>('segmentation');
  const [selectedObjection, setSelectedObjection] = useState<string>('price');

  const verticals = segments.verticals;
  const objections = segments.objections;
  const personas = segments.personas;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'segmentation', label: 'Segmentation Matrix' },
    { id: 'painpoints', label: 'Pain Point Mapping' },
    { id: 'sequence', label: 'Email Sequence' },
    { id: 'kpis', label: 'KPIs & Iteration' },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Campaign Logic</h1>
        <p className="text-gray-500 mt-1">
          Segmentation matrix, pain point mapping, and email sequence framework
        </p>
      </div>

      {/* Workflow Overview */}
      <div className="bg-gray-900 text-white rounded-xl p-5 mb-6">
        <p className="text-sm text-gray-400 mb-2">Campaign Workflow</p>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="px-3 py-1 bg-gray-800 rounded">HubSpot Closed-Lost</span>
          <span className="text-gray-500">→</span>
          <span className="px-3 py-1 bg-gray-800 rounded">Segment by V×O×P</span>
          <span className="text-gray-500">→</span>
          <span className="px-3 py-1 bg-gray-800 rounded">Export to Clay</span>
          <span className="text-gray-500">→</span>
          <span className="px-3 py-1 bg-gray-800 rounded">AI Personalization</span>
          <span className="text-gray-500">→</span>
          <span className="px-3 py-1 bg-blue-600 rounded">3-Touch Sequence</span>
        </div>
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
      {activeTab === 'segmentation' && (
        <div className="space-y-6">
          {/* Matrix */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-medium text-gray-900 mb-4">
              Segmentation Matrix: Vertical × Objection × Persona
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Total combinations: {verticals.length} × {objections.length} × {personas.length} = {verticals.length * objections.length * personas.length} segments
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Verticals */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Verticals ({verticals.length})</h4>
                <div className="space-y-1">
                  {verticals.map((v: { id: string; label: string; contacts: number }) => (
                    <div key={v.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                      <span>{v.label}</span>
                      <span className="text-gray-500">{v.contacts.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Objections */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Objection Types ({objections.length})</h4>
                <div className="space-y-1">
                  {objections.map((o: { id: string; label: string; pct: number }) => (
                    <div key={o.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                      <span>{o.label}</span>
                      <span className="text-gray-500">{(o.pct * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Personas */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Personas ({personas.length})</h4>
                <div className="space-y-1">
                  {personas.map((p: { id: string; label: string; pct: number }) => (
                    <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                      <span>{p.label}</span>
                      <span className="text-gray-500">{(p.pct * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Link to Email Builder */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="font-medium text-blue-900 mb-2">Generate Emails</h3>
            <p className="text-sm text-blue-800 mb-3">
              Use the Email Builder to generate segment-specific templates with audience estimates.
            </p>
            <Link
              to="/email-builder"
              className="inline-flex px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Open Email Builder →
            </Link>
          </div>
        </div>
      )}

      {activeTab === 'painpoints' && (
        <div className="space-y-6">
          {/* Objection Selector */}
          <div className="flex gap-2 flex-wrap">
            {Object.entries(PAIN_POINT_MAPPING).map(([key, value]) => (
              <button
                key={key}
                onClick={() => setSelectedObjection(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedObjection === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {value.label}
              </button>
            ))}
          </div>

          {/* Pain Point Details */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">
                {PAIN_POINT_MAPPING[selectedObjection as keyof typeof PAIN_POINT_MAPPING].label} Objection
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {PAIN_POINT_MAPPING[selectedObjection as keyof typeof PAIN_POINT_MAPPING].painPoints.map((item, i) => (
                <div key={i} className="p-4 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Pain Point</p>
                    <p className="text-sm text-gray-900">{item.pain}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Truv Feature</p>
                    <p className="text-sm text-blue-600 font-medium">{item.feature}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Proof Point</p>
                    <p className="text-sm text-green-700">{item.proof}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sequence' && (
        <div className="space-y-4">
          {SEQUENCE_TOUCHES.map((touch) => (
            <div key={touch.touch} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  {touch.touch}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">
                    Touch {touch.touch}: {touch.name}
                  </h3>
                  <p className="text-sm text-gray-500">Day {touch.day}</p>
                </div>
              </div>
              <div className="ml-14">
                <div className="p-3 bg-gray-50 rounded-lg mb-2">
                  <p className="text-xs text-gray-500 mb-1">Subject Line Template</p>
                  <p className="text-sm font-mono text-gray-800">{touch.subject}</p>
                </div>
                <p className="text-sm text-gray-600">{touch.description}</p>
              </div>
            </div>
          ))}

          {/* Clay Zones */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <h3 className="font-medium text-amber-900 mb-3">Clay Personalization Zones</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-amber-100 rounded-lg">
                <code className="text-sm text-amber-800">{'{{clay.opening_hook}}'}</code>
                <p className="text-xs text-amber-700 mt-1">Personalized reason for reaching out</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <code className="text-sm text-amber-800">{'{{clay.pain_reference}}'}</code>
                <p className="text-xs text-amber-700 mt-1">Specific pain point mention</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <code className="text-sm text-amber-800">{'{{clay.proof_point}}'}</code>
                <p className="text-xs text-amber-700 mt-1">Relevant case study snippet</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <code className="text-sm text-amber-800">{'{{clay.cta}}'}</code>
                <p className="text-xs text-amber-700 mt-1">Contextual call-to-action</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'kpis' && (
        <div className="space-y-6">
          {/* KPI Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">Success Metrics</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {KPIS.map((kpi) => (
                <div key={kpi.metric} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{kpi.metric}</p>
                    <p className="text-sm text-gray-500">{kpi.measurement}</p>
                  </div>
                  <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-bold">
                    {kpi.target}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Iteration Cadence */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-medium text-gray-900 mb-4">Iteration Cadence</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">Weekly</span>
                <p className="text-sm text-gray-600">Review open/reply rates by segment, pause underperforming variants</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">Bi-weekly</span>
                <p className="text-sm text-gray-600">A/B test subject lines and CTAs within top segments</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">Monthly</span>
                <p className="text-sm text-gray-600">Refresh proof points, add new case studies, retire stale responses</p>
              </div>
            </div>
          </div>

          {/* When to Retire */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <h3 className="font-medium text-red-900 mb-3">When to Retire a Segment</h3>
            <ul className="space-y-2 text-sm text-red-800">
              <li>• &lt;25% open rate after 2 iterations → subject line problem</li>
              <li>• &lt;3% reply rate with good opens → message/offer problem</li>
              <li>• &lt;1% meeting rate with good replies → CTA or qualification problem</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
