import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ===========================================
   PIPELINE DATA
   =========================================== */
type PipelineKey = 'a' | 'b' | 'c' | null;

const PIPELINES = {
  a: {
    label: 'Pipeline A',
    title: 'Inbound Form Submissions',
    icon: '⚡',
    color: 'blue',
    tagline: 'Real-time scoring of every "Get Started" form on truv.com',
    trigger: 'HubSpot form submission → HubSpot Workflow → Pipedream relay',
    endpoint: 'POST /webhook',
    latency: '~45s',
    flow: ['HubSpot Form', 'Workflow', 'Pipedream', 'Scout API', 'HubSpot + Slack'],
    details: [
      'Triggers on any "Get Started" form submission in HubSpot',
      'Pipedream relays the contactId to Scout with x-scout-token auth',
      'Full 4-layer pipeline: deterministic score → Apollo → Agno agent → write-back',
      'Hot or enterprise leads post to #outreach-intelligence in Slack',
      'Scoring weights: Form Fit 35%, Deal Context 20%, External 20%, Engagement 15%, Timing 10%',
    ],
    example: {
      name: 'John Martinez', title: 'VP Engineering', company: 'Pacific Home Loans',
      score: 82, tier: 'HOT', routing: 'Enterprise',
      reasoning: 'VP at a mid-size lender using Encompass. High loan volume and active engagement signal strong enterprise fit.',
      techMatches: ['Encompass', 'Blend'],
    },
  },
  b: {
    label: 'Pipeline B',
    title: 'Closed-Lost Re-engagement',
    icon: '📅',
    color: 'amber',
    tagline: 'Weekly digest surfacing closed-lost contacts who are showing buying signals',
    trigger: 'Pipedream cron (Monday 8am CDT) → Scout batch API',
    endpoint: 'POST /score-batch/closed-lost',
    latency: '~5 min batch',
    flow: ['Pipedream Cron', 'Scout API', 'HubSpot Search', 'Score + Rank', 'Slack Digest'],
    details: [
      'Pulls 150+ closed-lost contacts with engagement properties from HubSpot',
      'Filters: lifecycle=closed-lost, outreach_status ≠ active, deal closed >90 days',
      'Ranks contacts by engagement signals before scoring — most active scored first',
      'Web visit in last 30 days = +100 rank, email click = +80, email open = +40',
      'Posts a Monday morning digest to #outreach-intelligence with top hot/warm contacts',
    ],
    example: {
      name: 'Luba Mainz', title: 'Director, Mortgage Technology', company: 'Key Mortgage Services',
      score: 74, tier: 'HOT', routing: 'Enterprise',
      reasoning: 'Visited truv.com 4 days ago via email link. Director-level at a mortgage servicer. Web visit after months of dormancy is a strong re-engagement signal.',
      techMatches: [],
    },
    ranking: [
      { rank: 130, name: 'Luba Mainz', company: 'Key Mortgage Services', signal: 'Visited 4 days ago', hot: true },
      { rank: 49, name: 'Lorraine Segars', company: 'A Mortgage Boutique', signal: '29 sessions, coverage pages', hot: false },
      { rank: 30, name: 'Jovon Emfinger', company: 'Firstrust Bank', signal: '10 sessions, support tickets', hot: false },
      { rank: 27, name: '(unnamed)', company: 'Gulf Coast Bank & Trust', signal: '7 sessions, using dashboard', hot: false },
      { rank: 0, name: 'Jim Eyraud', company: 'Westlake Financial', signal: 'No recent engagement', hot: false },
    ],
  },
  c: {
    label: 'Pipeline C',
    title: 'Dashboard Signups',
    icon: '🚀',
    color: 'green',
    tagline: 'Catches product-led signups the instant they create a Truv Dashboard account',
    trigger: 'Slack #sales-dashboard-signups → Pipedream → Scout API',
    endpoint: 'POST /webhook/dashboard-signup',
    latency: '~45s',
    flow: ['DashBot → Slack', 'Pipedream Parse', 'Find-or-Create', 'Scout API', 'HubSpot + Slack'],
    details: [
      'Monitors Slack for DashBot messages (bot_id: B03QZ1E1T8X) in real time',
      'Parses name, email, company from notification text via regex',
      'Finds contact in HubSpot or creates with lifecyclestage=lead if new',
      'Applies +25pt product intent bonus — these contacts used the product',
      'Guards: skips customers/opportunities (lifecycle), 7-day cooldown, personal email filter',
    ],
    example: {
      name: 'Reyna Hernandez', title: 'Loan Officer', company: 'Associated Bank',
      score: 72, tier: 'HOT', routing: 'Enterprise',
      reasoning: 'Dashboard signup at a large bank (4,200 employees). Product intent bonus applied (+25 pts). Apollo shows $2.1B revenue. Enterprise routing via employee count.',
      techMatches: ['Encompass'],
    },
  },
} as const;

const colorMap = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', activeBorder: 'border-blue-400', text: 'text-blue-700', pill: 'bg-blue-100 text-blue-700 border-blue-200', light: 'bg-blue-100', accent: 'text-blue-600' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', activeBorder: 'border-amber-400', text: 'text-amber-700', pill: 'bg-amber-100 text-amber-700 border-amber-200', light: 'bg-amber-100', accent: 'text-amber-600' },
  green: { bg: 'bg-green-50', border: 'border-green-200', activeBorder: 'border-green-400', text: 'text-green-700', pill: 'bg-green-100 text-green-700 border-green-200', light: 'bg-green-100', accent: 'text-green-600' },
};

const tierColor = (tier: string) => {
  if (tier === 'HOT') return 'bg-red-100 text-red-700 border-red-200';
  if (tier === 'WARM') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-blue-100 text-blue-700 border-blue-200';
};

/* ===========================================
   PAGE
   =========================================== */
export function ScoutShowcase() {
  const [active, setActive] = useState<PipelineKey>(null);

  return (
    <div className="p-8 max-w-6xl">

      {/* ── HEADER ──────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-bold text-gray-900">Truv Scout</h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-600" />
            </span>
            Live
          </span>
        </div>
        <p className="text-gray-600">AI lead intelligence powered by Agno. Three pipelines that score, enrich, and route every lead — from form fills to product signups — through a 4-layer scoring engine with autonomous tool use.</p>
      </div>

      {/* ── STATS ───────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { value: '3', label: 'Pipelines' },
          { value: '~45s', label: 'Score latency' },
          { value: '5', label: 'Agent tools' },
          { value: '6', label: 'API endpoints' },
        ].map((s) => (
          <div key={s.label} className="p-4 bg-blue-600 rounded-xl text-white text-center">
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-sm opacity-90">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── PIPELINE CARDS ──────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {(['a', 'b', 'c'] as const).map((key) => {
          const p = PIPELINES[key];
          const c = colorMap[p.color];
          const isActive = active === key;

          return (
            <button key={key} onClick={() => setActive(isActive ? null : key)}
              className={`text-left p-5 rounded-xl border-2 transition-all duration-200 ${
                isActive ? `${c.bg} ${c.activeBorder} shadow-md` : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-7 h-7 rounded-lg ${c.light} ${c.text} flex items-center justify-center text-sm`}>{p.icon}</span>
                <span className="text-sm font-bold text-gray-900">{p.label}</span>
                {key === 'c' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700 border border-green-200">NEW</span>}
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">{p.title}</p>
              <p className="text-xs text-gray-500 mb-3">{p.tagline}</p>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${c.pill}`}>{p.endpoint}</span>
                <span className="text-[10px] text-gray-400">{p.latency}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── EXPANDED PIPELINE DETAIL ────────── */}
      <AnimatePresence mode="wait">
        {active && (
          <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }} className="mb-8">
            {(() => {
              const p = PIPELINES[active];
              const c = colorMap[p.color];
              const ex = p.example;

              return (
                <div className={`border-2 ${c.activeBorder} rounded-xl overflow-hidden`}>
                  {/* Header bar */}
                  <div className={`${c.bg} px-5 py-3 flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{p.icon}</span>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{p.label} — {p.title}</p>
                        <p className="text-xs text-gray-500">{p.trigger}</p>
                      </div>
                    </div>
                    <button onClick={() => setActive(null)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-white/50">
                      Close ✕
                    </button>
                  </div>

                  <div className="p-5 bg-white">
                    {/* Flow diagram */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-5">
                      {p.flow.map((node, i) => (
                        <div key={node} className="flex items-center gap-1.5">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                            node.includes('Scout') || node.includes('Score') ? `${c.bg} ${c.border} ${c.text} font-semibold` : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                            {node}
                          </span>
                          {i < p.flow.length - 1 && <span className="text-gray-300 text-xs">→</span>}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      {/* Left: How it works */}
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">How it works</p>
                        <div className="space-y-2">
                          {p.details.map((d, i) => (
                            <div key={i} className="flex gap-2.5 text-sm">
                              <span className={`w-5 h-5 rounded ${c.light} ${c.text} flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5`}>{i + 1}</span>
                              <p className="text-gray-600">{d}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Example result */}
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Real example</p>
                        <div className={`border rounded-xl p-4 ${c.border} ${c.bg}`}>
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-2xl font-bold text-gray-900">{ex.score}</span>
                            <span className="text-xs text-gray-400">/100</span>
                            <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-semibold border ${tierColor(ex.tier)}`}>
                              {ex.tier === 'HOT' ? '🔥' : '♨️'} {ex.tier}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{ex.name}</p>
                          <p className="text-xs text-gray-500 mb-2">{ex.title} @ {ex.company}</p>
                          <div className="flex gap-1.5 mb-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200">{ex.routing}</span>
                            {ex.techMatches.map((t) => (
                              <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">{t}</span>
                            ))}
                          </div>
                          <p className="text-xs text-gray-600 italic">"{ex.reasoning}"</p>
                        </div>
                      </div>
                    </div>

                    {/* Pipeline B: Engagement ranking table */}
                    {active === 'b' && 'ranking' in p && (
                      <div className="mt-5 pt-5 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Engagement-ranked contacts — real data from March 18, 2026</p>
                        <div className="space-y-1.5">
                          {(p as typeof PIPELINES['b']).ranking.map((r, i) => (
                            <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${r.hot ? 'border-red-200 bg-red-50' : r.rank > 0 ? 'border-amber-100 bg-amber-50/50' : 'border-gray-100 bg-gray-50'}`}>
                              <span className={`text-sm font-bold w-8 text-right ${r.hot ? 'text-red-600' : r.rank > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{r.rank}</span>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-900 font-medium">{r.name}</span>
                                <span className="text-xs text-gray-400 ml-2">{r.company}</span>
                              </div>
                              <span className="text-xs text-gray-500">{r.signal}</span>
                              {r.hot && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 border border-red-200">PRIORITY</span>}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Contacts ranked by web visits (+100 if &lt;30d), email clicks (+80), opens (+40), session count (+20). Zero-engagement contacts drop to the bottom.</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SCORING ENGINE ──────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">4-Layer Scoring Engine</p>
          <div className="space-y-2">
            {[
              { n: '1', title: 'Deterministic Scorer', desc: 'Form fit, engagement, timing, deal context, external triggers', color: 'bg-blue-100 text-blue-700' },
              { n: '2', title: 'Apollo Enrichment', desc: 'Firmographics, tech stack (LOS/POS + VOI/VOE), hiring signals', color: 'bg-cyan-100 text-cyan-700' },
              { n: '3', title: 'Agno Agent (Gemini 2.0)', desc: '5 tools, ICP rules, ±15pt adjustment with reasoning', color: 'bg-purple-100 text-purple-700' },
              { n: '4', title: 'Write-back + Alerts', desc: '8 HubSpot properties + Slack #outreach-intelligence', color: 'bg-green-100 text-green-700' },
            ].map((l) => (
              <div key={l.n} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100">
                <span className={`w-6 h-6 rounded ${l.color} flex items-center justify-center text-xs font-bold`}>{l.n}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{l.title}</p>
                  <p className="text-xs text-gray-500">{l.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-purple-200 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Agno Agent — 5 Autonomous Tools</p>
          <div className="space-y-2">
            {[
              { icon: '🔎', name: 'search_knowledge_base', desc: 'Case studies, competitive intel, product docs' },
              { icon: '📂', name: 'list_sources', desc: 'Discover available knowledge sources' },
              { icon: '📄', name: 'get_source_metadata', desc: 'Browse files before searching' },
              { icon: '📰', name: 'search_company_news', desc: 'Firecrawl web search for signals' },
              { icon: '💼', name: 'check_job_changes', desc: 'Hiring activity = buying intent' },
            ].map((t) => (
              <div key={t.name} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-100">
                <span className="text-sm">{t.icon}</span>
                <div>
                  <p className="text-xs font-mono font-semibold text-gray-800">{t.name}</p>
                  <p className="text-[10px] text-gray-500">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ARCHITECTURE + ENDPOINTS (collapsible) ──── */}
      <details className="mb-8 bg-white border border-gray-200 rounded-xl">
        <summary className="px-5 py-3 cursor-pointer text-sm font-semibold text-gray-900 hover:bg-gray-50 rounded-xl">
          Technical Reference — Architecture, Endpoints, HubSpot Properties, Routing
        </summary>
        <div className="px-5 pb-5 space-y-6">

          {/* Architecture diagram */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">System Architecture</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[
                { label: 'Pipeline A', nodes: ['HubSpot Form → Workflow → Pipedream → POST /webhook'], color: 'border-blue-200 bg-blue-50' },
                { label: 'Pipeline B', nodes: ['Cron (Mon 8am CDT) → POST /score-batch/closed-lost'], color: 'border-amber-200 bg-amber-50' },
                { label: 'Pipeline C', nodes: ['Slack DashBot → Pipedream → POST /webhook/dashboard-signup'], color: 'border-green-200 bg-green-50' },
              ].map((p) => (
                <div key={p.label} className={`p-3 rounded-lg border ${p.color}`}>
                  <p className="text-xs font-semibold text-gray-800 mb-1">{p.label}</p>
                  <p className="text-[10px] text-gray-600">{p.nodes[0]}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-center text-gray-300 text-xs mb-2">↓ ↓ ↓</div>
            <div className="p-3 rounded-lg border-2 border-blue-200 bg-blue-50 text-center mb-2">
              <p className="text-xs font-bold text-gray-900">Scout Scoring Engine (FastAPI on AWS App Runner)</p>
              <p className="text-[10px] text-gray-500">Deterministic → Apollo.io → Agno/Gemini → Write-back</p>
            </div>
            <div className="flex justify-center text-gray-300 text-xs mb-2">↓</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-orange-200 bg-orange-50 text-center">
                <p className="text-xs font-semibold text-gray-800">HubSpot Write-back</p>
                <p className="text-[10px] text-gray-500">8 contact properties</p>
              </div>
              <div className="p-3 rounded-lg border border-pink-200 bg-pink-50 text-center">
                <p className="text-xs font-semibold text-gray-800">Slack #outreach-intelligence</p>
                <p className="text-[10px] text-gray-500">Hot/enterprise alerts + digests</p>
              </div>
            </div>
          </div>

          {/* Endpoints */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">API Endpoints</p>
            <div className="divide-y divide-gray-100">
              {[
                { method: 'GET', path: '/health', auth: false, desc: 'Health check' },
                { method: 'POST', path: '/score', auth: false, desc: 'Synchronous single-lead scoring' },
                { method: 'POST', path: '/webhook', auth: true, desc: 'Pipeline A — async inbound' },
                { method: 'POST', path: '/webhook/dashboard-signup', auth: true, desc: 'Pipeline C — async dashboard signup' },
                { method: 'POST', path: '/score-batch/closed-lost', auth: true, desc: 'Pipeline B — weekly batch' },
                { method: 'POST', path: '/score-batch/dashboard-signups', auth: true, desc: 'Pipeline C — backlog batch' },
              ].map((ep) => (
                <div key={ep.path} className="flex items-center gap-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ep.method === 'GET' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{ep.method}</span>
                  <span className="text-xs font-mono text-gray-900 w-60">{ep.path}</span>
                  {ep.auth && <span className="px-1 py-0.5 rounded text-[9px] bg-amber-50 text-amber-600 border border-amber-200">auth</span>}
                  <span className="text-xs text-gray-500 flex-1">{ep.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* HubSpot properties */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">HubSpot Properties Written</p>
            <div className="grid grid-cols-4 gap-2">
              {['inbound_lead_tier', 'lead_routing', 'form_fit_score', 'scout_reasoning', 'scout_confidence', 'scout_scored_at', 'scout_tech_stack_matches', 'scout_source'].map((p) => (
                <span key={p} className="px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-[10px] font-mono text-gray-700">{p}</span>
              ))}
            </div>
          </div>

          {/* Routing */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Routing Logic</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: '🏢', name: 'Enterprise', rule: 'VP+, 10k apps, 3k loans, or 100+ emp' },
                { icon: '🏛️', name: 'Government', rule: 'Public services use case' },
                { icon: '🧑‍💻', name: 'Self-Service', rule: 'Default — moderate volume, IC/manager' },
                { icon: '🚫', name: 'Not a Lead', rule: 'Login or verification help requests' },
              ].map((r) => (
                <div key={r.name} className="p-2.5 rounded-lg border border-gray-200 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-800">{r.icon} {r.name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{r.rule}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tech stack */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Tech Stack</p>
            <div className="flex flex-wrap gap-2">
              {['FastAPI', 'AWS App Runner', 'AWS ECR', 'Gemini 2.0 Flash', 'Agno Framework', 'Apollo.io', 'Firecrawl', 'Pipedream', 'HubSpot CRM', 'Slack', 'Docker'].map((t) => (
                <span key={t} className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </details>

      {/* ── STATUS ──────────────────────────── */}
      <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
        {['App Runner', 'Pipeline A', 'Pipeline B', 'Pipeline C', 'Slack'].map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {s}
          </span>
        ))}
        <span className="ml-auto text-xs text-gray-400">Owner: Cameron Wolf</span>
      </div>
    </div>
  );
}
