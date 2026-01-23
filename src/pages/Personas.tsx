import { useState, useMemo } from 'react';
import segments from '../data/segments.json';
import personaAnalysis from '../../outreach_intel/persona_analysis_results.json';

type Persona = {
  id: string;
  label: string;
  pct: number;
  replyRate?: number;
  conversionScore?: number;
  priority?: number;
};

type EngagementData = {
  count: number;
  opens: number;
  clicks: number;
  replies: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
};

type LifecycleData = {
  total: number;
  by_persona: Record<string, number>;
};

type PersonaScore = {
  conversion_score: number;
  engagement_score: number;
  deal_score: number;
  sample_size: {
    leads: number;
    customers: number;
    engaged_contacts: number;
  };
};

// Aggregate deal data by persona
const calculateDealMetrics = () => {
  const dealData = personaAnalysis.deal_data as Record<string, { count: number; total_amount: number; personas: Record<string, number> }>;
  const personaDealMetrics: Record<string, { dealCount: number; totalValue: number; contactsInDeals: number }> = {};

  Object.values(dealData).forEach((deal) => {
    if (deal.personas) {
      Object.entries(deal.personas).forEach(([persona, count]) => {
        if (!personaDealMetrics[persona]) {
          personaDealMetrics[persona] = { dealCount: 0, totalValue: 0, contactsInDeals: 0 };
        }
        personaDealMetrics[persona].dealCount += 1;
        personaDealMetrics[persona].totalValue += deal.total_amount;
        personaDealMetrics[persona].contactsInDeals += count;
      });
    }
  });

  return personaDealMetrics;
};

const DEAL_METRICS = calculateDealMetrics();

const PERSONA_DETAILS: Record<string, {
  title: string;
  focus: string[];
  painPoints: string[];
  messaging: string[];
  proofPoints: string[];
}> = {
  coo: {
    title: 'Chief Operating Officer',
    focus: ['Operational excellence', 'Process optimization', 'Team efficiency', 'Cost management'],
    painPoints: [
      'Manual verification processes eating up team time',
      'High per-loan verification costs impacting margins',
      'Inconsistent turnaround times affecting customer experience',
      'Staff burnout from repetitive verification tasks',
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
  other_exec: {
    title: 'Other Executive (EVP/SVP)',
    focus: ['Strategic initiatives', 'Cross-functional alignment', 'Business growth', 'Vendor management'],
    painPoints: [
      'Lack of visibility into verification bottlenecks',
      'Vendor relationships not delivering promised value',
      'Difficulty justifying technology investments',
      'Misalignment between operations and technology',
    ],
    messaging: [
      'Trusted by industry leaders like CrossCountry and AmeriSave',
      'Dedicated customer success team',
      'Proven ROI within first quarter',
      'Executive-level partnership approach',
    ],
    proofPoints: [
      'CrossCountry: Partnership approach praised by EVP',
      'AmeriSave: Strategic partnership delivering on every front',
      'Orion: Holistic approach to verification optimization',
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
      'NFTYDoor: Direct-to-source data quality',
    ],
  },
  manager: {
    title: 'Manager/Director Level',
    focus: ['Day-to-day operations', 'Team performance', 'Process improvement', 'Tool adoption'],
    painPoints: [
      'Team spending too much time on manual verifications',
      'Dealing with borrower complaints about verification delays',
      'Managing multiple verification vendors',
      'Training staff on complex verification processes',
    ],
    messaging: [
      'Simple borrower experience increases team efficiency',
      'One platform for all verification needs',
      'Real-time status tracking reduces support calls',
      'Easy onboarding with dedicated support',
    ],
    proofPoints: [
      'Piedmont: 80% reduction in support calls',
      'First Continental: 4-hour support response time',
      'MIG: 100% conversion improvement simplifies workflows',
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
  vp_product: {
    title: 'VP Product/Head of Product',
    focus: ['Product experience', 'Feature roadmap', 'Customer satisfaction', 'Innovation'],
    painPoints: [
      'Verification step causes application abandonment',
      'Poor data quality from existing providers',
      'Limited visibility into verification success rates',
      'Difficulty integrating verification into product flow',
    ],
    messaging: [
      '70%+ post-login conversion rate',
      'White-label solution matches your brand',
      'Real-time webhooks and analytics',
      'Comprehensive API for custom implementations',
    ],
    proofPoints: [
      'CrossCountry: 70%+ post-login conversion',
      'NFTYDoor: 70% VOHI conversion',
      'B9: 12% improvement in funds deposited',
    ],
  },
  vp_underwriting: {
    title: 'VP Underwriting/Chief Credit Officer',
    focus: ['Credit risk', 'Loan quality', 'Compliance', 'Data accuracy'],
    painPoints: [
      'Fraudulent income documentation increasing',
      'Verification delays holding up loan decisions',
      'Data discrepancies between sources',
      'Audit and compliance burden',
    ],
    messaging: [
      'Direct-to-source data eliminates fraud risk',
      'GSE-approved for Day 1 Certainty',
      'Comprehensive income breakdown by source',
      'Includes paystubs and W-2s for audit trail',
    ],
    proofPoints: [
      'TurboPass: 38% reduction in loan losses',
      'HFS: 15% improvement in fraud detection',
      'MortgageRight: More granular data than competitors',
    ],
  },
  vp_lending: {
    title: 'VP Lending/Mortgage Operations',
    focus: ['Loan volume', 'Turnaround time', 'Cost per loan', 'Borrower experience'],
    painPoints: [
      'Verification costs eating into margins',
      'Long verification times delaying closings',
      'Borrower drop-off during verification',
      'Inconsistent data quality across providers',
    ],
    messaging: [
      'Close loans faster with instant verification',
      '45-second average verification time',
      'Improve borrower experience and pull-through',
      'R&W relief opportunity with GSE approval',
    ],
    proofPoints: [
      'CrossCountry: 8% R&W relief uplift',
      'TurboPass: 1.5 days faster funding',
      'Compass: Faster loan approvals with better data',
    ],
  },
};

export function Personas() {
  const [expandedPersona, setExpandedPersona] = useState<string | null>(null);
  const personas = segments.personas as Persona[];
  const totalContacts = (segments as { totalTargetable?: number }).totalTargetable || 134796;

  // Get detailed metrics for a persona
  const getPersonaMetrics = (personaId: string) => {
    const engagement = (personaAnalysis.engagement_data as Record<string, EngagementData>)[personaId];
    const scores = (personaAnalysis.persona_scores as Record<string, PersonaScore>)[personaId];
    const lifecycle = personaAnalysis.lifecycle_data as Record<string, LifecycleData>;
    const deals = DEAL_METRICS[personaId];

    // Calculate funnel progression
    const funnel = {
      lead: lifecycle.lead?.by_persona?.[personaId] || 0,
      mql: lifecycle.marketingqualifiedlead?.by_persona?.[personaId] || 0,
      sql: lifecycle.salesqualifiedlead?.by_persona?.[personaId] || 0,
      opportunity: lifecycle.opportunity?.by_persona?.[personaId] || 0,
      customer: lifecycle.customer?.by_persona?.[personaId] || 0,
    };

    return { engagement, scores, funnel, deals };
  };

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

                {/* Expand/Collapse Button */}
                <button
                  onClick={() => setExpandedPersona(expandedPersona === persona.id ? null : persona.id)}
                  className={`mt-3 flex items-center gap-2 text-sm font-medium transition-colors ${
                    isTopPerformer ? 'text-green-700 hover:text-green-900' :
                    isHighPerformer ? 'text-blue-700 hover:text-blue-900' :
                    'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${expandedPersona === persona.id ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {expandedPersona === persona.id ? 'Hide Details' : 'View Engagement & Deal Data'}
                </button>

                {/* Expanded Details Dropdown */}
                {expandedPersona === persona.id && (() => {
                  const metrics = getPersonaMetrics(persona.id);
                  return (
                    <div className={`mt-4 pt-4 border-t ${
                      isTopPerformer ? 'border-green-200' : isHighPerformer ? 'border-blue-200' : 'border-gray-200'
                    }`}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Response Metrics */}
                        <div className={`p-4 rounded-lg ${
                          isTopPerformer ? 'bg-green-100/50' : isHighPerformer ? 'bg-blue-100/50' : 'bg-white'
                        }`}>
                          <h4 className={`text-sm font-semibold mb-1 ${
                            isTopPerformer ? 'text-green-900' : isHighPerformer ? 'text-blue-900' : 'text-gray-900'
                          }`}>
                            Email Engagement
                          </h4>
                          <p className="text-xs text-gray-500 mb-3">From HubSpot email tracking</p>
                          {metrics.engagement ? (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Contacts Tracked</span>
                                <span className="font-medium">{metrics.engagement.count.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Total Opens</span>
                                <span className="font-medium">{metrics.engagement.opens}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Total Clicks</span>
                                <span className="font-medium">{metrics.engagement.clicks}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Total Replies</span>
                                <span className="font-medium text-green-600">{metrics.engagement.replies}</span>
                              </div>
                              <div className="pt-2 mt-2 border-t border-gray-200">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Avg Opens/Contact</span>
                                  <span className="font-medium">{metrics.engagement.open_rate.toFixed(1)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Avg Clicks/Contact</span>
                                  <span className="font-medium">{metrics.engagement.click_rate.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">No engagement data available</p>
                          )}
                        </div>

                        {/* Deal Involvement */}
                        <div className={`p-4 rounded-lg ${
                          isTopPerformer ? 'bg-green-100/50' : isHighPerformer ? 'bg-blue-100/50' : 'bg-white'
                        }`}>
                          <h4 className={`text-sm font-semibold mb-1 ${
                            isTopPerformer ? 'text-green-900' : isHighPerformer ? 'text-blue-900' : 'text-gray-900'
                          }`}>
                            Deal Presence
                          </h4>
                          <p className="text-xs text-gray-500 mb-3">All HubSpot deals (any stage)</p>
                          {metrics.deals ? (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Deal Stages Present</span>
                                <span className="font-medium">{metrics.deals.dealCount}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Total Contacts</span>
                                <span className="font-medium">{metrics.deals.contactsInDeals.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Total Deal Value</span>
                                <span className="font-medium text-green-600">
                                  ${(metrics.deals.totalValue / 1000).toFixed(0)}K
                                </span>
                              </div>
                              <div className="pt-2 mt-2 border-t border-gray-200">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Avg Value/Deal</span>
                                  <span className="font-medium">
                                    ${Math.round(metrics.deals.totalValue / metrics.deals.dealCount / 1000)}K
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">No deal data available</p>
                          )}
                        </div>

                        {/* Funnel Progression */}
                        <div className={`p-4 rounded-lg ${
                          isTopPerformer ? 'bg-green-100/50' : isHighPerformer ? 'bg-blue-100/50' : 'bg-white'
                        }`}>
                          <h4 className={`text-sm font-semibold mb-1 ${
                            isTopPerformer ? 'text-green-900' : isHighPerformer ? 'text-blue-900' : 'text-gray-900'
                          }`}>
                            Lifecycle Stage Counts
                          </h4>
                          <p className="text-xs text-gray-500 mb-3">How many at each stage</p>
                          {(() => {
                            const maxCount = Math.max(
                              metrics.funnel.lead,
                              metrics.funnel.mql,
                              metrics.funnel.sql,
                              metrics.funnel.opportunity,
                              metrics.funnel.customer
                            );
                            const conversionRate = metrics.funnel.lead > 0
                              ? ((metrics.funnel.customer / metrics.funnel.lead) * 100).toFixed(1)
                              : '0';
                            return (
                              <>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 text-xs text-gray-500">Lead</div>
                                    <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-gray-400 rounded-full"
                                        style={{ width: `${(metrics.funnel.lead / maxCount) * 100}%` }}
                                      />
                                    </div>
                                    <div className="w-12 text-xs font-medium text-right">{metrics.funnel.lead.toLocaleString()}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 text-xs text-gray-500">MQL</div>
                                    <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-400 rounded-full"
                                        style={{ width: `${(metrics.funnel.mql / maxCount) * 100}%` }}
                                      />
                                    </div>
                                    <div className="w-12 text-xs font-medium text-right">{metrics.funnel.mql.toLocaleString()}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 text-xs text-gray-500">SQL</div>
                                    <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-purple-400 rounded-full"
                                        style={{ width: `${(metrics.funnel.sql / maxCount) * 100}%` }}
                                      />
                                    </div>
                                    <div className="w-12 text-xs font-medium text-right">{metrics.funnel.sql.toLocaleString()}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 text-xs text-gray-500">Opp</div>
                                    <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-orange-400 rounded-full"
                                        style={{ width: `${(metrics.funnel.opportunity / maxCount) * 100}%` }}
                                      />
                                    </div>
                                    <div className="w-12 text-xs font-medium text-right">{metrics.funnel.opportunity.toLocaleString()}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 text-xs text-gray-500">Customer</div>
                                    <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-green-500 rounded-full"
                                        style={{ width: `${(metrics.funnel.customer / maxCount) * 100}%` }}
                                      />
                                    </div>
                                    <div className="w-12 text-xs font-medium text-right">{metrics.funnel.customer.toLocaleString()}</div>
                                  </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                  Lead → Customer: <span className="font-semibold text-green-600">{conversionRate}%</span> conversion
                                </p>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Key Insight for this persona */}
                      {metrics.scores && (
                        <div className={`mt-4 p-3 rounded-lg ${
                          isTopPerformer ? 'bg-green-100' : isHighPerformer ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <p className={`text-sm ${
                            isTopPerformer ? 'text-green-800' : isHighPerformer ? 'text-blue-800' : 'text-gray-700'
                          }`}>
                            <strong>Sample Size:</strong> {metrics.scores.sample_size.leads} leads, {' '}
                            {metrics.scores.sample_size.customers} customers, {' '}
                            {metrics.scores.sample_size.engaged_contacts} engaged contacts
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Recommendation for top performer */}
                {isTopPerformer && expandedPersona !== persona.id && (
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
