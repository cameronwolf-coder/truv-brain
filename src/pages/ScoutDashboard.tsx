import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ===========================================
   TYPES
   =========================================== */
interface PipelineStep {
  status: 'complete' | 'failed' | 'skipped' | 'no-data' | 'fallback' | 'pending';
  detail: string;
}

interface ScoredContact {
  id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  tier: string | null;
  routing: string | null;
  score: number | null;
  reasoning: string | null;
  confidence: string | null;
  source: string | null;
  scoredAt: string | null;
  techMatches: string | null;
  lastVisit: string | null;
  lastVisitUrl: string | null;
  numVisits: number;
  lastEmailOpen: string | null;
  lastEmailClick: string | null;
  lastSalesActivity: string | null;
  lifecycle: string | null;
  leadStatus: string | null;
  useCase: string | null;
  loanVolume: string | null;
  appVolume: string | null;
  roleLevel: string | null;
  howCanWeHelp: string | null;
  createdAt: string | null;
  analyticsSource: string | null;
  deals: number;
  steps: {
    trigger: PipelineStep;
    hubspot: PipelineStep;
    scorer: PipelineStep;
    apollo: PipelineStep;
    agent: PipelineStep;
    writeback: PipelineStep;
  };
}

interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'unreachable';
  name: string;
  url: string;
  console: string;
  type: string;
  rateLimit?: { used: number; remaining: number; limit: number };
}

interface DashboardData {
  timestamp: string;
  scoutHealth: string;
  services: Record<string, ServiceStatus>;
  stats: {
    total: number;
    byTier: { hot: number; warm: number; cold: number };
    bySource: { form_submission: number; closed_lost_reengagement: number; dashboard_signup: number; unknown: number };
    byRouting: { enterprise: number; 'self-service': number; government: number; 'not-a-lead': number };
  };
  recentScores: ScoredContact[];
  engagedClosedLost: ScoredContact[];
}

/* ===========================================
   HELPERS
   =========================================== */
function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function tierBadge(tier: string | null) {
  const styles: Record<string, string> = {
    hot: 'bg-red-100 text-red-700 border-red-200',
    warm: 'bg-amber-100 text-amber-700 border-amber-200',
    cold: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  const emojis: Record<string, string> = { hot: '🔥', warm: '♨️', cold: '🔵' };
  const t = tier || 'cold';
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${styles[t] || styles.cold}`}>
      {emojis[t] || ''} {t.toUpperCase()}
    </span>
  );
}

function sourceBadge(source: string | null) {
  const labels: Record<string, { label: string; style: string }> = {
    form_submission: { label: 'A', style: 'bg-blue-100 text-blue-700' },
    closed_lost_reengagement: { label: 'B', style: 'bg-amber-100 text-amber-700' },
    dashboard_signup: { label: 'C', style: 'bg-green-100 text-green-700' },
  };
  const s = labels[source || ''] || { label: '?', style: 'bg-gray-100 text-gray-500' };
  return <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${s.style}`}>{s.label}</span>;
}

function healthDot(status: string) {
  const color = status === 'healthy' ? 'bg-green-500' : status === 'degraded' ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-gray-500 capitalize">{status}</span>
    </span>
  );
}

/* ===========================================
   PAGE
   =========================================== */
type PipelineFilter = 'all' | 'form_submission' | 'closed_lost_reengagement' | 'dashboard_signup';

export function ScoutDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedContact, setSelectedContact] = useState<ScoredContact | null>(null);
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>('all');
  const [rescoringId, setRescoringId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const resp = await fetch('/api/scout-dashboard');
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const json = await resp.json();
      setData(json);
      setError(null);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRescore = useCallback(async (c: ScoredContact) => {
    setRescoringId(c.id);
    try {
      await fetch('/api/rescore-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: c.id, email: c.email }),
      });
      // Refresh data after rescore completes
      await fetchData();
    } finally {
      setRescoringId(null);
    }
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Scout Dashboard</h1>
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}</div>
          <div className="h-96 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    const isProxyError = error.includes('500') || error.includes('502') || error.includes('503');
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Scout Dashboard</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <p className="text-red-800 font-medium">Failed to load dashboard data</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          {isProxyError && (
            <p className="text-red-500 text-xs mt-2 font-mono bg-red-100 rounded px-2 py-1">
              Local dev: run <strong>npm run dev:local</strong> to start the API server alongside Vite
            </p>
          )}
          <button onClick={fetchData} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Retry</button>
        </div>
      </div>
    );
  }

  const stats = data!.stats;
  const filteredScores = pipelineFilter === 'all'
    ? data!.recentScores
    : data!.recentScores.filter(c => c.source === pipelineFilter);

  return (
    <div className="p-8 max-w-6xl">

      {/* ── HEADER ──────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-gray-900">Scout Dashboard</h1>
            {healthDot(data!.scoutHealth)}
          </div>
          <p className="text-sm text-gray-500">Live scoring activity across all 3 pipelines. Auto-refreshes every 30s.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Last refresh: {lastRefresh.toLocaleTimeString()}</p>
          <button onClick={fetchData} className="text-xs text-blue-600 hover:text-blue-800 mt-0.5">Refresh now</button>
        </div>
      </div>

      {/* ── PIPELINE HEALTH CARDS ───────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-blue-600 rounded-xl text-white">
          <p className="text-sm opacity-80">Recently Scored</p>
          <p className="text-3xl font-bold">{stats.total}</p>
          <p className="text-xs opacity-70 mt-1">contacts with scores</p>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-xs text-gray-500 mb-2">By Tier</p>
          <div className="flex items-center gap-3">
            <div><p className="text-xl font-bold text-red-600">{stats.byTier.hot}</p><p className="text-[10px] text-gray-400">Hot</p></div>
            <div><p className="text-xl font-bold text-amber-600">{stats.byTier.warm}</p><p className="text-[10px] text-gray-400">Warm</p></div>
            <div><p className="text-xl font-bold text-blue-600">{stats.byTier.cold}</p><p className="text-[10px] text-gray-400">Cold</p></div>
          </div>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-xs text-gray-500 mb-2">By Pipeline</p>
          <div className="flex items-center gap-3">
            <div><p className="text-xl font-bold text-blue-600">{stats.bySource.form_submission}</p><p className="text-[10px] text-gray-400">A</p></div>
            <div><p className="text-xl font-bold text-amber-600">{stats.bySource.closed_lost_reengagement}</p><p className="text-[10px] text-gray-400">B</p></div>
            <div><p className="text-xl font-bold text-green-600">{stats.bySource.dashboard_signup}</p><p className="text-[10px] text-gray-400">C</p></div>
            {stats.bySource.unknown > 0 && <div><p className="text-xl font-bold text-gray-400">{stats.bySource.unknown}</p><p className="text-[10px] text-gray-400">?</p></div>}
          </div>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-xs text-gray-500 mb-2">By Routing</p>
          <div className="space-y-1">
            {Object.entries(stats.byRouting).filter(([, v]) => v > 0).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-600 capitalize">{k}</span>
                <span className="font-semibold text-gray-900">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PIPELINE OVERVIEW ───────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { key: 'A', color: 'border-l-blue-500', title: 'Pipeline A — Inbound', desc: 'Scores every "Get Started" form submission on truv.com in real time. Triggers via HubSpot Workflow → Pipedream → Scout API.', trigger: 'HubSpot form submit', freq: 'Real-time' },
          { key: 'B', color: 'border-l-amber-500', title: 'Pipeline B — Closed-Lost', desc: 'Resurfaces closed-lost contacts showing buying signals. Ranks by engagement (web visits, email clicks) and scores the most active first.', trigger: 'Monday 8am CDT cron', freq: 'Weekly batch' },
          { key: 'C', color: 'border-l-green-500', title: 'Pipeline C — Dashboard Signups', desc: 'Catches product-led signups the instant someone creates a Truv Dashboard account. Applies +25pt product intent bonus.', trigger: 'Slack DashBot message', freq: 'Real-time' },
        ].map((p) => (
          <div key={p.key} className={`bg-white border border-gray-200 ${p.color} border-l-4 rounded-xl px-4 py-3`}>
            <p className="text-sm font-semibold text-gray-900">{p.title}</p>
            <p className="text-xs text-gray-500 mt-1 mb-2">{p.desc}</p>
            <div className="flex items-center gap-3 text-[10px] text-gray-400">
              <span>{p.trigger}</span>
              <span className="text-gray-300">|</span>
              <span>{p.freq}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── SERVICE STATUS ────────────────── */}
      {data!.services && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Infrastructure Status</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(data!.services).map(([key, svc]) => {
              const dotColor = svc.status === 'healthy' ? 'bg-green-500' : svc.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500';
              const borderColor = svc.status === 'healthy' ? 'border-gray-200' : svc.status === 'degraded' ? 'border-amber-200' : 'border-red-200';
              const bgColor = svc.status !== 'healthy' ? (svc.status === 'degraded' ? 'bg-amber-50' : 'bg-red-50') : 'bg-white';
              const isApollo = key === 'apollo' && svc.rateLimit;
              return (
                <a key={key} href={svc.console} target="_blank" rel="noopener noreferrer"
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${borderColor} ${bgColor} hover:shadow-sm hover:border-gray-300 transition-all group`}>
                  <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 truncate">{svc.name}</p>
                    {isApollo ? (
                      <div className="mt-0.5">
                        <div className="flex items-center gap-1 mb-0.5">
                          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-400 rounded-full"
                              style={{ width: `${Math.round((svc.rateLimit!.used / svc.rateLimit!.limit) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-gray-400 flex-shrink-0">
                            {svc.rateLimit!.used}/{svc.rateLimit!.limit}/min
                          </span>
                        </div>
                        <p className="text-[9px] text-gray-400">{svc.rateLimit!.remaining} req remaining</p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400 truncate">{svc.type}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-300 group-hover:text-blue-400 flex-shrink-0">↗</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TWO COLUMN: FEED + HEATMAP ─────── */}
      <div className="grid grid-cols-2 gap-6 mb-6">

        {/* Left: Recent Scores Feed */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Recent Scores</h2>
            <span className="text-xs text-gray-400">{filteredScores.length} contacts</span>
          </div>
          {/* Pipeline filter tabs */}
          <div className="flex gap-1 mb-2">
            {([
              { key: 'all', label: 'All' },
              { key: 'form_submission', label: 'A — Inbound' },
              { key: 'closed_lost_reengagement', label: 'B — Closed-Lost' },
              { key: 'dashboard_signup', label: 'C — Dashboard' },
            ] as { key: PipelineFilter; label: string }[]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPipelineFilter(tab.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  pipelineFilter === tab.key
                    ? 'bg-truv-blue text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {filteredScores.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No scored contacts found</div>
            ) : (
              filteredScores.map((c) => (
                <div key={c.id}
                  className={`flex items-start gap-2 px-4 py-3 hover:bg-gray-50 transition-colors ${selectedContact?.id === c.id ? 'bg-blue-50' : ''}`}>
                  <button className="flex-1 text-left min-w-0" onClick={() => setSelectedContact(c)}>
                    <div className="flex items-center gap-2 mb-1">
                      {sourceBadge(c.source)}
                      <span className="text-sm font-medium text-gray-900 truncate flex-1">{c.name}</span>
                      {tierBadge(c.tier)}
                    </div>
                    <div className="flex items-center gap-2 pl-7">
                      <span className="text-xs text-gray-500 truncate">{c.title ? `${c.title} @ ` : ''}{c.company}</span>
                      <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{timeAgo(c.scoredAt)}</span>
                    </div>
                    {c.score !== null && (
                      <div className="pl-7 mt-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${c.score}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 w-6 text-right">{c.score}</span>
                        </div>
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => handleRescore(c)}
                    disabled={rescoringId === c.id}
                    className="flex-shrink-0 mt-0.5 px-2 py-1 text-[10px] font-medium rounded-lg border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Re-run Scout pipeline for this contact"
                  >
                    {rescoringId === c.id ? '...' : '↻ Re-score'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Engagement Heatmap */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Engagement Heatmap</h2>
          <p className="text-xs text-gray-500 mb-3">Closed-lost contacts showing buying signals in the last 30 days</p>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {data!.engagedClosedLost.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No recently engaged closed-lost contacts</div>
            ) : (
              data!.engagedClosedLost.map((c) => {
                const signals: string[] = [];
                if (c.lastVisit) signals.push(`Visited ${timeAgo(c.lastVisit)}`);
                if (c.numVisits > 1) signals.push(`${c.numVisits} sessions`);
                if (c.lastEmailOpen) signals.push(`Opened ${timeAgo(c.lastEmailOpen)}`);
                if (c.lastEmailClick) signals.push(`Clicked ${timeAgo(c.lastEmailClick)}`);

                return (
                  <button key={c.id} onClick={() => setSelectedContact(c)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedContact?.id === c.id ? 'bg-amber-50' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate flex-1">{c.name || 'Unknown'}</span>
                      {c.tier ? tierBadge(c.tier) : <span className="px-1.5 py-0.5 rounded-full text-[10px] text-gray-400 border border-gray-200">Unscored</span>}
                    </div>
                    <p className="text-xs text-gray-500 truncate mb-1.5">{c.title ? `${c.title} @ ` : ''}{c.company}</p>
                    <div className="flex flex-wrap gap-1">
                      {signals.map((s, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200">{s}</span>
                      ))}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── CONTACT DETAIL DRAWER ──────────── */}
      <AnimatePresence>
        {selectedContact && (() => {
          const c = selectedContact;
          const sourceLabel: Record<string, string> = { form_submission: 'Pipeline A — Inbound', closed_lost_reengagement: 'Pipeline B — Closed-Lost', dashboard_signup: 'Pipeline C — Dashboard Signup' };
          const stepLabels = [
            { key: 'trigger' as const, icon: '📡', label: 'Trigger' },
            { key: 'hubspot' as const, icon: '🔗', label: 'HubSpot' },
            { key: 'scorer' as const, icon: '📊', label: 'Scorer' },
            { key: 'apollo' as const, icon: '🔍', label: 'Apollo' },
            { key: 'agent' as const, icon: '🧠', label: 'Agno Agent' },
            { key: 'writeback' as const, icon: '✅', label: 'Write-back' },
          ];
          const stepStatusStyle = (s: string) =>
            s === 'complete' ? 'border-green-200 bg-green-50 text-green-700' :
            s === 'failed' ? 'border-red-200 bg-red-50 text-red-700' :
            s === 'fallback' ? 'border-amber-200 bg-amber-50 text-amber-700' :
            'border-gray-200 bg-gray-50 text-gray-500';
          return (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">

              {/* Header */}
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  {sourceBadge(c.source)}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">{c.name}</h3>
                      {tierBadge(c.tier)}
                    </div>
                    <p className="text-xs text-gray-500">{c.title}{c.title && c.company ? ' @ ' : ''}{c.company} {c.email ? `• ${c.email}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`https://app.hubspot.com/contacts/19933594/contact/${c.id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100">
                    View in HubSpot ↗
                  </a>
                  <button onClick={() => setSelectedContact(null)} className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1 rounded hover:bg-gray-100">✕</button>
                </div>
              </div>

              <div className="p-5">
                {/* Pipeline flow status */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Pipeline Execution</p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {sourceLabel[c.source || ''] || 'Unknown Pipeline'}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {stepLabels.map((s, i) => {
                      const step = c.steps?.[s.key];
                      const status = step?.status || 'pending';
                      return (
                        <div key={s.key} className="flex items-center gap-1.5 flex-1">
                          <div className={`flex-1 px-2.5 py-2 rounded-lg border text-center ${stepStatusStyle(status)}`}>
                            <p className="text-[10px] font-medium">{s.icon} {s.label}</p>
                            <p className="text-[9px] mt-0.5 opacity-80 truncate">{step?.detail || ''}</p>
                          </div>
                          {i < stepLabels.length - 1 && <span className="text-gray-300 text-[10px] flex-shrink-0">→</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Scoring Waterfall */}
                <div className="mb-5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Score Waterfall</p>
                  <div className="flex items-stretch gap-0">

                    {/* Step 1: Form Signals */}
                    <div className="flex-1 min-w-0 rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center">1</span>
                        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Form Signals</p>
                      </div>
                      <div className="space-y-1">
                        {c.useCase && <div className="flex justify-between text-[10px]"><span className="text-gray-400">Use case</span><span className="text-gray-700 font-medium truncate ml-1 max-w-[60%]">{c.useCase}</span></div>}
                        {c.roleLevel && <div className="flex justify-between text-[10px]"><span className="text-gray-400">Role</span><span className="text-gray-700 capitalize truncate ml-1 max-w-[60%]">{c.roleLevel}</span></div>}
                        {c.loanVolume && <div className="flex justify-between text-[10px]"><span className="text-gray-400">Loans/yr</span><span className="text-gray-700">{c.loanVolume}</span></div>}
                        {c.appVolume && <div className="flex justify-between text-[10px]"><span className="text-gray-400">Apps/yr</span><span className="text-gray-700">{c.appVolume}</span></div>}
                        {!c.useCase && !c.roleLevel && !c.loanVolume && !c.appVolume && (
                          <p className="text-[10px] text-gray-400 italic">No form data captured</p>
                        )}
                      </div>
                      {c.howCanWeHelp && (
                        <div className="mt-2 pt-1.5 border-t border-gray-200">
                          <p className="text-[9px] text-gray-400 mb-0.5">How can we help?</p>
                          <p className="text-[10px] text-gray-600 italic line-clamp-2">"{c.howCanWeHelp}"</p>
                        </div>
                      )}
                    </div>

                    {/* Connector */}
                    <div className="flex items-center px-1 text-gray-300 text-xs flex-shrink-0">→</div>

                    {/* Step 2: Base Score */}
                    <div className={`flex-1 min-w-0 border border-r-0 p-3 ${c.steps?.scorer?.status === 'complete' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center">2</span>
                        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Base Scorer</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-400">Score</span>
                          <span className={`font-bold text-sm ${c.score !== null ? (c.score >= 70 ? 'text-red-600' : c.score >= 50 ? 'text-amber-600' : 'text-blue-600') : 'text-gray-400'}`}>
                            {c.score ?? '—'}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-400">Status</span>
                          <span className={c.steps?.scorer?.status === 'complete' ? 'text-green-700' : 'text-gray-400'}>
                            {c.steps?.scorer?.status === 'complete' ? 'Scored' : 'Not scored'}
                          </span>
                        </div>
                      </div>
                      {c.score !== null && (
                        <div className="mt-2 pt-1.5 border-t border-blue-100">
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${c.score >= 70 ? 'bg-red-500' : c.score >= 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                              style={{ width: `${Math.min(c.score, 100)}%` }} />
                          </div>
                          <p className="text-[9px] text-gray-400 mt-0.5">{c.score}/100</p>
                        </div>
                      )}
                    </div>

                    {/* Connector */}
                    <div className="flex items-center px-1 text-gray-300 text-xs flex-shrink-0">→</div>

                    {/* Step 3: Apollo Research */}
                    <div className={`flex-1 min-w-0 border border-r-0 p-3 ${c.steps?.apollo?.status === 'complete' ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 text-[9px] font-bold flex items-center justify-center">3</span>
                        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Apollo Intel</p>
                      </div>
                      {c.techMatches ? (
                        <div className="space-y-1">
                          <p className="text-[9px] text-gray-400 mb-1">Tech matches</p>
                          <div className="flex flex-wrap gap-1">
                            {c.techMatches.split(',').slice(0, 4).map((t, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-medium">{t.trim()}</span>
                            ))}
                            {c.techMatches.split(',').length > 4 && (
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px]">+{c.techMatches.split(',').length - 4} more</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-400 italic">
                          {c.steps?.apollo?.status === 'no-data' ? 'No tech data found' : 'Apollo not run'}
                        </p>
                      )}
                    </div>

                    {/* Connector */}
                    <div className="flex items-center px-1 text-gray-300 text-xs flex-shrink-0">→</div>

                    {/* Step 4: AI Agent */}
                    <div className={`flex-1 min-w-0 rounded-r-lg border p-3 ${c.steps?.agent?.status === 'complete' ? 'bg-green-50 border-green-200' : c.steps?.agent?.status === 'fallback' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${c.steps?.agent?.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>4</span>
                        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">AI Agent</p>
                        {c.confidence && (
                          <span className={`ml-auto px-1.5 py-0.5 rounded text-[9px] font-medium ${c.confidence === 'high' ? 'bg-green-100 text-green-700' : c.confidence === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                            {c.confidence}
                          </span>
                        )}
                      </div>
                      {c.reasoning && c.reasoning !== 'Deterministic score only.' ? (
                        <p className="text-[10px] text-gray-600 italic line-clamp-4">"{c.reasoning}"</p>
                      ) : (
                        <div>
                          <p className="text-[10px] text-amber-700">Deterministic fallback — no agent research</p>
                          <p className="text-[9px] text-gray-400 mt-0.5">Score based on form signals only</p>
                        </div>
                      )}
                      <div className="mt-2 pt-1.5 border-t border-gray-200 flex items-center gap-2">
                        {tierBadge(c.tier)}
                        {c.routing && (
                          <span className="text-[9px] text-gray-500 capitalize">{c.routing}</span>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

                <div className="grid grid-cols-4 gap-5">
                  {/* Col 1: Scoring */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Scoring</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Score</span><span className="font-bold text-gray-900 text-lg">{c.score ?? '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Tier</span><span className="font-medium text-gray-900 capitalize">{c.tier || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Routing</span><span className="font-medium text-gray-900 capitalize">{c.routing || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Confidence</span><span className="capitalize">{c.confidence || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Scored</span><span>{timeAgo(c.scoredAt)}</span></div>
                    </div>
                    {c.techMatches && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-[10px] text-gray-400 mb-1">Tech Matches</p>
                        <p className="text-xs text-blue-700 font-medium">{c.techMatches}</p>
                      </div>
                    )}
                  </div>

                  {/* Col 2: Contact Context */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Contact Context</p>
                    <div className="space-y-1.5 text-sm">
                      {c.useCase && <div className="flex justify-between"><span className="text-gray-500">Use Case</span><span className="font-medium text-gray-900">{c.useCase}</span></div>}
                      {c.roleLevel && <div className="flex justify-between"><span className="text-gray-500">Role Level</span><span className="capitalize">{c.roleLevel}</span></div>}
                      {c.loanVolume && <div className="flex justify-between"><span className="text-gray-500">Loans/yr</span><span>{c.loanVolume}</span></div>}
                      {c.appVolume && <div className="flex justify-between"><span className="text-gray-500">Apps/yr</span><span>{c.appVolume}</span></div>}
                      <div className="flex justify-between"><span className="text-gray-500">Lifecycle</span><span className="capitalize">{c.lifecycle || '—'}</span></div>
                      {c.deals > 0 && <div className="flex justify-between"><span className="text-gray-500">Deals</span><span className="font-medium">{c.deals}</span></div>}
                      {c.analyticsSource && <div className="flex justify-between"><span className="text-gray-500">Source</span><span className="capitalize text-xs">{c.analyticsSource}</span></div>}
                      <div className="flex justify-between"><span className="text-gray-500">Created</span><span>{timeAgo(c.createdAt)}</span></div>
                    </div>
                  </div>

                  {/* Col 3: Engagement */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Engagement Signals</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Web visits</span>
                        <span className={c.numVisits > 0 ? 'font-semibold text-green-700' : 'text-gray-400'}>{c.numVisits || '0'} sessions</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Last visit</span>
                        <span className={c.lastVisit ? 'text-green-700' : 'text-gray-400'}>{timeAgo(c.lastVisit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Email open</span>
                        <span className={c.lastEmailOpen ? 'text-gray-900' : 'text-gray-400'}>{timeAgo(c.lastEmailOpen)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Email click</span>
                        <span className={c.lastEmailClick ? 'text-green-700' : 'text-gray-400'}>{timeAgo(c.lastEmailClick)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sales touch</span>
                        <span className={c.lastSalesActivity ? 'text-gray-900' : 'text-gray-400'}>{timeAgo(c.lastSalesActivity)}</span>
                      </div>
                    </div>
                    {c.lastVisitUrl && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-[10px] text-gray-400 mb-0.5">Last visited URL</p>
                        <p className="text-[10px] text-blue-600 truncate">{c.lastVisitUrl}</p>
                      </div>
                    )}
                  </div>

                  {/* Col 4: Agent Reasoning */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Agent Reasoning</p>
                    {c.reasoning && c.reasoning !== 'Deterministic score only.' ? (
                      <div>
                        <p className="text-sm text-gray-600 italic leading-relaxed">"{c.reasoning}"</p>
                        <div className="mt-2 flex gap-1">
                          {c.steps?.agent?.status === 'complete' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-green-50 text-green-700 border border-green-200">Tools used</span>
                          )}
                          {c.steps?.agent?.status === 'fallback' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-50 text-amber-700 border border-amber-200">Deterministic fallback</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs text-amber-700">Agent returned deterministic fallback — no research-backed reasoning available for this contact.</p>
                      </div>
                    )}
                    {c.howCanWeHelp && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-[10px] text-gray-400 mb-0.5">Form: "How can we help?"</p>
                        <p className="text-xs text-gray-700">{c.howCanWeHelp}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── FOOTER ──────────────────────────── */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span>Data from HubSpot Portal 19933594</span>
        <span>Scout API: {data!.scoutHealth}</span>
        <span>Refresh: 30s</span>
      </div>
    </div>
  );
}
