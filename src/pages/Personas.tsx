import { useMemo } from 'react';
import segments from '../data/segments.json';

type Persona = {
  id: string;
  label: string;
  pct: number;
  replyRate?: number;
  conversionScore?: number;
  priority?: number;
};

const PERSONA_DETAILS: Record<string, {
  title: string;
  focus: string[];
  painPoints: string[];
  messaging: string[];
  proofPoints: string[];
}> = {
  vp_ops: {
    title: 'VP/Director of Operations',
    focus: ['Efficiency', 'Cost reduction', 'Team productivity', 'Process automation'],
    painPoints: [
      'Manual verification processes eating up team time',
      'High per-loan verification costs',
      'Inconsistent turnaround times',
      'Staff burnout from repetitive tasks',
    ],
    messaging: [
      'Reduce manual verification tasks by 90%',
      'Save $350+ per closed loan',
      'Free up your team for higher-value work',
      '45-second verifications vs days of waiting',
    ],
    proofPoints: [
      'CrossCountry: $10M/year estimated savings',
      'Piedmont: 90% reduction in manual tasks',
      'First Continental: Dedicated support with 4-hour response',
    ],
  },
  ceo: {
    title: 'CEO/Founder/President',
    focus: ['Strategic value', 'Competitive advantage', 'Growth enablement', 'Risk reduction'],
    painPoints: [
      'Falling behind competitors using modern verification',
      'Margin pressure from rising verification costs',
      'Compliance and audit concerns',
      'Need to scale without adding headcount',
    ],
    messaging: [
      'GSE approved - reduce repurchase risk',
      '80% cost savings vs The Work Number',
      'Industry-leading conversion rates',
      'Trusted by top mortgage lenders',
    ],
    proofPoints: [
      'AmeriSave: 80% savings vs competitors',
      'MIG: 100% conversion improvement',
      'Revolution: Costs dropped from 8 to 3 basis points',
    ],
  },
  cfo: {
    title: 'CFO/VP Finance/Controller',
    focus: ['ROI', 'Margin improvement', 'Predictable pricing', 'Cost visibility'],
    painPoints: [
      'Verification costs unpredictable and rising',
      'TWN price increases (~20% every 6 months)',
      'Hard to model verification spend',
      'No clear ROI metrics from current provider',
    ],
    messaging: [
      'Transparent, predictable pricing',
      'Free re-verifications within 90 days',
      'Measurable ROI - track savings per loan',
      '35-80% guaranteed savings',
    ],
    proofPoints: [
      'Compass Mortgage: 60-80% savings on verifications',
      'CrossCountry: Clear cost tracking and reporting',
      'HFS: 10-15% efficiency improvement quantified',
    ],
  },
  cto: {
    title: 'CTO/VP Engineering/IT Director',
    focus: ['Integration ease', 'API quality', 'Reliability', 'Security'],
    painPoints: [
      'Complex integrations with existing LOS/POS',
      'Poor API documentation from current vendors',
      'Downtime affecting loan processing',
      'Security and compliance concerns',
    ],
    messaging: [
      'Go live in days, not months',
      'Pre-built Encompass, nCino integrations',
      '99.99% uptime SLA',
      'SOC 2 Type II certified, FCRA compliant',
    ],
    proofPoints: [
      'First Continental: <1 month custom implementation',
      'MortgageRight: Seamless LOS integration',
      'nFTYDoor: Direct-to-source data quality',
    ],
  },
};

export function Personas() {
  const personas = segments.personas as Persona[];
  const totalContacts = (segments as { totalTargetable?: number }).totalTargetable || 134796;

  // Calculate engagement scores and rank personas
  const rankedPersonas = useMemo(() => {
    return personas
      .map((p) => {
        const replyRate = p.replyRate || 0;
        const conversionScore = p.conversionScore || 0;
        const priority = p.priority || 5;

        // Calculate overall engagement score (0-100)
        // Reply rate: 40%, Conversion: 40%, Priority: 20%
        const normalizedReply = Math.min(replyRate * 100, 100);
        const normalizedConversion = Math.min(conversionScore * 8, 100);
        const normalizedPriority = ((6 - priority) / 5) * 100;

        const engagementScore = Math.round(
          normalizedReply * 0.4 +
          normalizedConversion * 0.4 +
          normalizedPriority * 0.2
        );

        return {
          ...p,
          engagementScore,
          replyRate,
          conversionScore,
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore);
  }, [personas]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Buyer Personas</h1>
        <p className="text-gray-500 mt-1">
          Target personas with messaging focus and HubSpot distribution
        </p>
      </div>

      {/* Response Likelihood Ranking */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-medium text-gray-900">Response Likelihood</h2>
            <p className="text-sm text-gray-500">Based on HubSpot engagement data</p>
          </div>
          <div className="text-xs text-gray-400">
            Score = Reply Rate (40%) + Conversion (40%) + Priority (20%)
          </div>
        </div>

        <div className="space-y-3">
          {rankedPersonas.map((persona, index) => {
            const details = PERSONA_DETAILS[persona.id];
            const isTopPerformer = index === 0;
            const isHighPerformer = index < 2;

            return (
              <div
                key={persona.id}
                className={`p-4 rounded-lg border ${
                  isTopPerformer
                    ? 'bg-green-50 border-green-200'
                    : isHighPerformer
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                      isTopPerformer
                        ? 'bg-green-500 text-white'
                        : isHighPerformer
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-300 text-gray-700'
                    }`}
                  >
                    {index + 1}
                  </div>

                  {/* Persona Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-semibold ${
                        isTopPerformer ? 'text-green-900' : isHighPerformer ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                        {persona.label}
                      </h3>
                      {isTopPerformer && (
                        <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs font-semibold rounded">
                          BEST
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${
                      isTopPerformer ? 'text-green-700' : isHighPerformer ? 'text-blue-700' : 'text-gray-600'
                    }`}>
                      {details?.title || persona.id}
                    </p>
                  </div>

                  {/* Metrics */}
                  <div className="flex items-center gap-6 text-center">
                    <div>
                      <p className={`text-2xl font-bold ${
                        isTopPerformer ? 'text-green-700' : isHighPerformer ? 'text-blue-700' : 'text-gray-700'
                      }`}>
                        {(persona.replyRate * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-gray-500">Reply Rate</p>
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${
                        isTopPerformer ? 'text-green-700' : isHighPerformer ? 'text-blue-700' : 'text-gray-700'
                      }`}>
                        {persona.conversionScore.toFixed(1)}x
                      </p>
                      <p className="text-xs text-gray-500">Conversion</p>
                    </div>
                    <div className="w-20">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isTopPerformer ? 'bg-green-500' : isHighPerformer ? 'bg-blue-500' : 'bg-gray-400'
                            }`}
                            style={{ width: `${persona.engagementScore}%` }}
                          />
                        </div>
                        <span className={`text-sm font-semibold ${
                          isTopPerformer ? 'text-green-700' : isHighPerformer ? 'text-blue-700' : 'text-gray-700'
                        }`}>
                          {persona.engagementScore}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Score</p>
                    </div>
                  </div>
                </div>

                {/* Recommendation for top performer */}
                {isTopPerformer && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <p className="text-sm text-green-800">
                      <strong>Recommendation:</strong> Prioritize {persona.label} in outreach campaigns.
                      They have the highest combined reply rate and conversion score.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>Key Insight:</strong> COO/VP Ops personas show 2x higher reply rates than CEOs,
            despite CEOs making up a larger portion of contacts. Consider focusing campaigns on
            operations leaders for better engagement.
          </p>
        </div>
      </div>

      {/* Distribution Overview */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="font-medium text-gray-900 mb-4">HubSpot Distribution</h2>
        <div className="space-y-3">
          {personas.map((persona) => {
            const count = Math.round(totalContacts * persona.pct);
            return (
              <div key={persona.id} className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium text-gray-700">{persona.label}</div>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${persona.pct * 100}%` }}
                  />
                </div>
                <div className="w-24 text-sm text-gray-600 text-right">
                  {count.toLocaleString()} ({(persona.pct * 100).toFixed(0)}%)
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Based on job title analysis of {totalContacts.toLocaleString()} targetable HubSpot contacts
        </p>
      </div>

      {/* Persona Cards */}
      <div className="space-y-6">
        {personas.map((persona) => {
          const details = PERSONA_DETAILS[persona.id];
          if (!details) return null;

          return (
            <div
              key={persona.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden"
            >
              {/* Persona Header */}
              <div className="p-5 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{details.title}</h3>
                    <p className="text-sm text-gray-500">{persona.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">
                      {(persona.pct * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-gray-500">of contacts</p>
                  </div>
                </div>
              </div>

              {/* Content Grid */}
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Focus Areas */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Focus Areas</h4>
                  <div className="flex flex-wrap gap-2">
                    {details.focus.map((item, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Pain Points */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Pain Points</h4>
                  <ul className="space-y-1">
                    {details.painPoints.map((item, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Messaging */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Key Messaging</h4>
                  <ul className="space-y-1">
                    {details.messaging.map((item, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Proof Points */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Proof Points to Use</h4>
                  <ul className="space-y-1">
                    {details.proofPoints.map((item, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5">→</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
