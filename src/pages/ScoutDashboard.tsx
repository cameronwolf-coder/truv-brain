import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ===========================================
   TYPES
   =========================================== */
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
  numVisits: number;
  lastEmailOpen: string | null;
  lastEmailClick: string | null;
  lifecycle: string | null;
}

interface DashboardData {
  timestamp: string;
  scoutHealth: string;
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
export function ScoutDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedContact, setSelectedContact] = useState<ScoredContact | null>(null);

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
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Scout Dashboard</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <p className="text-red-800 font-medium">Failed to load dashboard data</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button onClick={fetchData} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Retry</button>
        </div>
      </div>
    );
  }

  const stats = data!.stats;

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

      {/* ── TWO COLUMN: FEED + HEATMAP ─────── */}
      <div className="grid grid-cols-2 gap-6 mb-6">

        {/* Left: Recent Scores Feed */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Scores</h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {data!.recentScores.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No scored contacts found</div>
            ) : (
              data!.recentScores.map((c) => (
                <button key={c.id} onClick={() => setSelectedContact(c)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedContact?.id === c.id ? 'bg-blue-50' : ''}`}>
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
        {selectedContact && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {sourceBadge(selectedContact.source)}
                  <h3 className="text-lg font-semibold text-gray-900">{selectedContact.name}</h3>
                  {tierBadge(selectedContact.tier)}
                </div>
                <p className="text-sm text-gray-500">{selectedContact.title}{selectedContact.title && selectedContact.company ? ' @ ' : ''}{selectedContact.company}</p>
              </div>
              <button onClick={() => setSelectedContact(null)} className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1 rounded hover:bg-gray-100">Close ✕</button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Scoring */}
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Scoring</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Score</span><span className="font-semibold text-gray-900">{selectedContact.score ?? 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Tier</span><span className="font-medium text-gray-900 capitalize">{selectedContact.tier || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Routing</span><span className="font-medium text-gray-900 capitalize">{selectedContact.routing || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Confidence</span><span className="font-medium text-gray-900 capitalize">{selectedContact.confidence || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Source</span><span className="font-medium text-gray-900">{selectedContact.source?.replace(/_/g, ' ') || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Scored</span><span className="text-gray-700">{timeAgo(selectedContact.scoredAt)}</span></div>
                </div>
              </div>

              {/* Engagement */}
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Engagement</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Last web visit</span><span className="text-gray-900">{timeAgo(selectedContact.lastVisit)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Web sessions</span><span className="text-gray-900">{selectedContact.numVisits}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Last email open</span><span className="text-gray-900">{timeAgo(selectedContact.lastEmailOpen)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Last email click</span><span className="text-gray-900">{timeAgo(selectedContact.lastEmailClick)}</span></div>
                </div>
                {selectedContact.techMatches && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Tech Matches</p>
                    <p className="text-xs text-gray-700">{selectedContact.techMatches}</p>
                  </div>
                )}
              </div>

              {/* Reasoning */}
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Agent Reasoning</p>
                {selectedContact.reasoning ? (
                  <p className="text-sm text-gray-600 italic">"{selectedContact.reasoning}"</p>
                ) : (
                  <p className="text-sm text-gray-400">No reasoning available — contact may not have been scored yet.</p>
                )}
                <a href={`https://app.hubspot.com/contacts/19933594/contact/${selectedContact.id}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-colors">
                  View in HubSpot ↗
                </a>
              </div>
            </div>
          </motion.div>
        )}
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
