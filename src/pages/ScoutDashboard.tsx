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

interface EnterpriseProspect extends ScoredContact {
  employeeCount: number | null;
  annualRevenue: number | null;
  industry: string | null;
  companyDomain: string | null;
  companyName: string;
}

interface SelfServiceUser {
  id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  createdAt: string | null;
  lifecycle: string | null;
  leadStatus: string | null;
  tier: string | null;
  routing: string | null;
  score: number | null;
  source: string | null;
  scoredAt: string | null;
  useCase: string | null;
  loanVolume: string | null;
  appVolume: string | null;
  roleLevel: string | null;
  deals: number;
  analyticsSource: string | null;
  numVisits: number;
  lastVisit: string | null;
  lastEmailOpen: string | null;
  lastEmailClick: string | null;
  employeeCount: number | null;
  annualRevenue: number | null;
  industry: string | null;
  companyDomain: string | null;
  companyLocation: string | null;
}

interface SelfServiceData {
  timestamp: string;
  total: number;
  stats: {
    total: number;
    byTier: { hot: number; warm: number; cold: number };
    byRouting: Record<string, number>;
    byLifecycle: Record<string, number>;
    byIndustry: Record<string, number>;
  };
  users: SelfServiceUser[];
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
  enterpriseProspects: EnterpriseProspect[];
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
type DashboardTab = 'scores' | 'enterprise' | 'self-service';
type DateFilter = 'all' | '7d' | '30d' | '90d';
type SizeFilter = 'all' | '50+' | '200+' | '1000+';
type RoutingFilter = 'all' | 'enterprise' | 'self-service' | 'government';
type EmployeeFilter = 'all' | '50+' | '200+' | '1000+';
type TierFilter = 'all' | 'hot' | 'warm' | 'cold';

function formatRevenue(revenue: number | null): string {
  if (revenue === null) return '--';
  if (revenue >= 1_000_000_000) return `$${(revenue / 1_000_000_000).toFixed(1)}B`;
  if (revenue >= 1_000_000) return `$${(revenue / 1_000_000).toFixed(0)}M`;
  if (revenue >= 1_000) return `$${(revenue / 1_000).toFixed(0)}K`;
  return `$${revenue}`;
}

function formatEmployees(count: number | null): string {
  if (count === null) return '--';
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function ScoutDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedContact, setSelectedContact] = useState<ScoredContact | null>(null);
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>('all');
  const [rescoringId, setRescoringId] = useState<string | null>(null);
  const [traceData, setTraceData] = useState<Record<string, any> | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceLayer, setTraceLayer] = useState<string | null>(null);

  // Enterprise tab state
  const [activeTab, setActiveTab] = useState<DashboardTab>('scores');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [empFilter, setEmpFilter] = useState<EmployeeFilter>('all');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [listModalOpen, setListModalOpen] = useState(false);
  const [listName, setListName] = useState('');
  const [listCreating, setListCreating] = useState(false);
  const [listResult, setListResult] = useState<{ url: string; count: number } | null>(null);

  // Self-service tab state
  const [ssData, setSsData] = useState<SelfServiceData | null>(null);
  const [ssLoading, setSsLoading] = useState(false);
  const [ssError, setSsError] = useState<string | null>(null);
  const [ssDateFilter, setSsDateFilter] = useState<DateFilter>('all');
  const [ssSizeFilter, setSsSizeFilter] = useState<SizeFilter>('all');
  const [ssRoutingFilter, setSsRoutingFilter] = useState<RoutingFilter>('all');
  const [ssTierFilter, setSsTierFilter] = useState<TierFilter>('all');
  const [ssSelectedIds, setSsSelectedIds] = useState<Set<string>>(new Set());
  const [ssListModalOpen, setSsListModalOpen] = useState(false);
  const [ssListName, setSsListName] = useState('');
  const [ssListCreating, setSsListCreating] = useState(false);
  const [ssListResult, setSsListResult] = useState<{ url: string; count: number } | null>(null);
  const [ssEnrichingIds, setSsEnrichingIds] = useState<Set<string>>(new Set());
  const [ssEnrichedIds, setSsEnrichedIds] = useState<Set<string>>(new Set());
  const [ssEnrichError, setSsEnrichError] = useState<string | null>(null);

  const fetchTrace = useCallback(async (contactId: string) => {
    setTraceLoading(true);
    setTraceData(null);
    try {
      const resp = await fetch(`/api/scout-trace?contactId=${contactId}`);
      if (resp.ok) {
        setTraceData(await resp.json());
      }
    } catch { /* trace unavailable */ } finally {
      setTraceLoading(false);
    }
  }, []);

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

  const fetchSelfServiceData = useCallback(async () => {
    setSsLoading(true);
    setSsError(null);
    try {
      const resp = await fetch('/api/self-service-users');
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      setSsData(await resp.json());
    } catch (e: any) {
      setSsError(e.message);
    } finally {
      setSsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fetch self-service data when tab is activated
  useEffect(() => {
    if (activeTab === 'self-service' && !ssData && !ssLoading) {
      fetchSelfServiceData();
    }
  }, [activeTab, ssData, ssLoading, fetchSelfServiceData]);

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
      <div className="flex items-center justify-between mb-4">
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

      {/* ── TOP-LEVEL TABS ─────────────────── */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([
          { key: 'scores' as DashboardTab, label: 'Pipeline Scores' },
          { key: 'enterprise' as DashboardTab, label: `Enterprise Prospects${data!.enterpriseProspects?.length ? ` (${data!.enterpriseProspects.length})` : ''}` },
          { key: 'self-service' as DashboardTab, label: `Self-Service Users${ssData?.total ? ` (${ssData.total})` : ''}` },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-truv-blue text-truv-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── SELF-SERVICE USERS TAB ──────────── */}
      {activeTab === 'self-service' && (() => {
        if (ssLoading && !ssData) {
          return (
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}</div>
              <div className="h-96 bg-gray-200 rounded-xl" />
            </div>
          );
        }
        if (ssError && !ssData) {
          return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <p className="text-red-800 font-medium">Failed to load self-service users</p>
              <p className="text-red-600 text-sm mt-1">{ssError}</p>
              <button onClick={fetchSelfServiceData} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Retry</button>
            </div>
          );
        }
        if (!ssData) return null;

        const now = Date.now();
        const filtered = ssData.users.filter((u) => {
          // Date filter
          if (ssDateFilter !== 'all' && u.createdAt) {
            const days = ssDateFilter === '7d' ? 7 : ssDateFilter === '30d' ? 30 : 90;
            if (now - new Date(u.createdAt).getTime() > days * 24 * 60 * 60 * 1000) return false;
          }
          // Company size filter
          if (ssSizeFilter !== 'all') {
            const min = ssSizeFilter === '50+' ? 50 : ssSizeFilter === '200+' ? 200 : 1000;
            if (!u.employeeCount || u.employeeCount < min) return false;
          }
          // Routing filter
          if (ssRoutingFilter !== 'all' && u.routing !== ssRoutingFilter) return false;
          // Tier filter
          if (ssTierFilter !== 'all' && u.tier !== ssTierFilter) return false;
          return true;
        });

        const ssAllSelected = filtered.length > 0 && filtered.every((u) => ssSelectedIds.has(u.id));
        const ssToggleAll = () => {
          if (ssAllSelected) {
            setSsSelectedIds(new Set());
          } else {
            setSsSelectedIds(new Set(filtered.map((u) => u.id)));
          }
        };
        const ssToggleOne = (id: string) => {
          const next = new Set(ssSelectedIds);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          setSsSelectedIds(next);
        };

        const handleSsCreateList = async () => {
          if (!ssListName.trim()) return;
          setSsListCreating(true);
          try {
            const resp = await fetch('/api/list-builder/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: ssListName.trim(),
                recordIds: Array.from(ssSelectedIds),
                objectType: 'contacts',
                listType: 'static',
              }),
            });
            const result = await resp.json();
            if (result.success) {
              setSsListResult({ url: result.listUrl, count: ssSelectedIds.size });
              setSsSelectedIds(new Set());
            }
          } finally {
            setSsListCreating(false);
          }
        };

        const handleSsEnrich = async () => {
          setSsEnrichError(null);
          const ids = Array.from(ssSelectedIds);
          setSsEnrichingIds(new Set(ids));
          let succeeded = 0;
          let failed = 0;
          let noData = 0;
          const errors: string[] = [];
          for (const id of ids) {
            const user = ssData!.users.find((u) => u.id === id);
            if (!user) continue;
            try {
              const resp = await fetch('/api/enrich-contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contactId: id,
                  email: user.email || undefined,
                  firstname: user.name.split(' ')[0] || undefined,
                  lastname: user.name.split(' ').slice(1).join(' ') || undefined,
                  company: user.company || undefined,
                  domain: user.companyDomain || undefined,
                }),
              });
              const result = await resp.json().catch(() => ({}));
              if (resp.ok && result.success) {
                succeeded++;
                setSsEnrichedIds((prev) => new Set([...prev, id]));
              } else if (resp.ok && !result.success) {
                noData++;
                if (result.error) errors.push(`${user.name}: ${result.error}`);
              } else {
                failed++;
                if (result.error) errors.push(`${user.name}: ${result.error}`);
              }
            } catch (e: any) {
              failed++;
              errors.push(`${user.name}: ${e.message || 'Network error'}`);
            }
            setSsEnrichingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
          }
          const parts: string[] = [];
          if (succeeded > 0) parts.push(`${succeeded} enriched`);
          if (noData > 0) parts.push(`${noData} no data found`);
          if (failed > 0) parts.push(`${failed} failed`);
          if (failed > 0 || noData > 0) {
            setSsEnrichError(`${parts.join(', ')} of ${ids.length} total${errors.length > 0 ? '. ' + errors[0] : ''}`);
          }
          setSsSelectedIds(new Set());
          fetchSelfServiceData();
        };

        return (
          <div className="mb-6">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="p-4 bg-green-600 rounded-xl text-white">
                <p className="text-2xl font-bold">{ssData.total}</p>
                <p className="text-xs opacity-80 mt-1">Total Self-Service Users</p>
              </div>
              <div className="p-4 bg-white border border-gray-200 rounded-xl">
                <p className="text-2xl font-bold text-red-600">{ssData.stats.byTier.hot}</p>
                <p className="text-xs text-gray-500 mt-1">Hot Tier</p>
              </div>
              <div className="p-4 bg-white border border-gray-200 rounded-xl">
                <p className="text-2xl font-bold text-amber-600">{ssData.stats.byTier.warm}</p>
                <p className="text-xs text-gray-500 mt-1">Warm Tier</p>
              </div>
              <div className="p-4 bg-white border border-gray-200 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">{ssData.stats.byTier.cold}</p>
                <p className="text-xs text-gray-500 mt-1">Cold Tier</p>
              </div>
            </div>

            {/* Toolbar: filters + actions */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 mr-1">Filters:</span>
                <select
                  value={ssDateFilter}
                  onChange={(e) => setSsDateFilter(e.target.value as DateFilter)}
                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs bg-white"
                >
                  <option value="all">All time</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
                <select
                  value={ssSizeFilter}
                  onChange={(e) => setSsSizeFilter(e.target.value as SizeFilter)}
                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs bg-white"
                >
                  <option value="all">All sizes</option>
                  <option value="50+">50+ employees</option>
                  <option value="200+">200+ employees</option>
                  <option value="1000+">1,000+ employees</option>
                </select>
                <select
                  value={ssRoutingFilter}
                  onChange={(e) => setSsRoutingFilter(e.target.value as RoutingFilter)}
                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs bg-white"
                >
                  <option value="all">All routing</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="self-service">Self-Service</option>
                  <option value="government">Government</option>
                </select>
                <select
                  value={ssTierFilter}
                  onChange={(e) => setSsTierFilter(e.target.value as TierFilter)}
                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs bg-white"
                >
                  <option value="all">All tiers</option>
                  <option value="hot">Hot</option>
                  <option value="warm">Warm</option>
                  <option value="cold">Cold</option>
                </select>
                <span className="text-xs text-gray-400 ml-2">{filtered.length} users</span>
                {ssEnrichError && <span className="text-xs text-amber-600 ml-2">{ssEnrichError} <button onClick={() => setSsEnrichError(null)} className="underline">dismiss</button></span>}
              </div>
              <div className="flex items-center gap-2">
                {ssEnrichingIds.size > 0 && <span className="text-xs text-blue-600 animate-pulse">Enriching {ssEnrichingIds.size} left...</span>}
                <button
                  onClick={fetchSelfServiceData}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Refresh
                </button>
                {ssSelectedIds.size > 0 && (
                  <>
                    <button
                      onClick={handleSsEnrich}
                      disabled={ssEnrichingIds.size > 0}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {ssEnrichingIds.size > 0 ? `Enriching (${ssEnrichingIds.size} left)...` : `Enrich ${ssSelectedIds.size} via Apollo`}
                    </button>
                    <button
                      onClick={() => { setSsListModalOpen(true); setSsListResult(null); setSsListName(`Self-Service Users — ${new Date().toLocaleDateString()}`); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-truv-blue text-white hover:bg-blue-700 transition-colors"
                    >
                      Add {ssSelectedIds.size} to HubSpot List
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="w-10 px-3 py-2">
                      <input type="checkbox" checked={ssAllSelected} onChange={ssToggleAll} className="rounded border-gray-300" />
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Contact</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Company</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Employees</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Industry</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Tier</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Routing</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Score</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Use Case</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Deals</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Signed Up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400 text-sm">No self-service users match current filters</td></tr>
                  ) : (
                    filtered.map((u) => (
                      <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${ssEnrichingIds.has(u.id) ? 'bg-amber-50 animate-pulse' : ssEnrichedIds.has(u.id) ? 'bg-green-50' : ssSelectedIds.has(u.id) ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={ssSelectedIds.has(u.id)} onChange={() => ssToggleOne(u.id)} className="rounded border-gray-300" />
                        </td>
                        <td className="px-3 py-2">
                          <a
                            href={`https://app.hubspot.com/contacts/19933594/contact/${u.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-left block"
                          >
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[160px] hover:text-truv-blue">{u.name}</p>
                            <p className="text-[10px] text-gray-500 truncate max-w-[160px]">{u.title || u.email}</p>
                          </a>
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-sm text-gray-900 truncate max-w-[140px]">{u.company}</p>
                          {u.companyLocation && <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{u.companyLocation}</p>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`text-sm font-medium ${u.employeeCount && u.employeeCount >= 200 ? 'text-green-700' : 'text-gray-700'}`}>
                            {formatEmployees(u.employeeCount)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs text-gray-600 truncate block max-w-[100px]">{u.industry || '--'}</span>
                        </td>
                        <td className="px-3 py-2 text-center">{tierBadge(u.tier)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            u.routing === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                            u.routing === 'government' ? 'bg-teal-100 text-teal-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {u.routing || '--'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`text-sm font-bold ${u.score !== null ? (u.score >= 70 ? 'text-red-600' : u.score >= 50 ? 'text-amber-600' : 'text-blue-600') : 'text-gray-400'}`}>
                            {u.score ?? '--'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs text-gray-600 truncate block max-w-[120px]">{u.useCase || '--'}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`text-sm font-medium ${u.deals > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                            {u.deals || '--'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="text-[10px] text-gray-400">{timeAgo(u.createdAt)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Add to List Modal */}
            <AnimatePresence>
              {ssListModalOpen && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
                  onClick={() => { if (!ssListCreating) setSsListModalOpen(false); }}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {ssListResult ? (
                      <div>
                        <p className="text-lg font-semibold text-gray-900 mb-2">List Created</p>
                        <p className="text-sm text-gray-600 mb-4">{ssListResult.count} contacts added to HubSpot list.</p>
                        <div className="flex gap-2">
                          <a href={ssListResult.url} target="_blank" rel="noopener noreferrer"
                            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 text-center">
                            Open in HubSpot
                          </a>
                          <button onClick={() => setSsListModalOpen(false)}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
                            Close
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-lg font-semibold text-gray-900 mb-1">Add to HubSpot List</p>
                        <p className="text-sm text-gray-500 mb-4">{ssSelectedIds.size} contacts selected</p>
                        <input
                          type="text"
                          value={ssListName}
                          onChange={(e) => setSsListName(e.target.value)}
                          placeholder="List name..."
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-truv-blue focus:border-transparent"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button onClick={handleSsCreateList} disabled={ssListCreating || !ssListName.trim()}
                            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-truv-blue text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                            {ssListCreating ? 'Creating...' : 'Create List'}
                          </button>
                          <button onClick={() => setSsListModalOpen(false)} disabled={ssListCreating}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })()}

      {/* ── ENTERPRISE PROSPECTS TAB ──────────── */}
      {activeTab === 'enterprise' && (() => {
        const prospects = data!.enterpriseProspects || [];
        const filtered = prospects.filter((p) => {
          if (empFilter !== 'all') {
            const min = empFilter === '50+' ? 50 : empFilter === '200+' ? 200 : 1000;
            if (!p.employeeCount || p.employeeCount < min) return false;
          }
          if (tierFilter !== 'all' && p.tier !== tierFilter) return false;
          return true;
        });

        const allSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));
        const toggleAll = () => {
          if (allSelected) {
            setSelectedIds(new Set());
          } else {
            setSelectedIds(new Set(filtered.map((p) => p.id)));
          }
        };
        const toggleOne = (id: string) => {
          const next = new Set(selectedIds);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          setSelectedIds(next);
        };

        const handleCreateList = async () => {
          if (!listName.trim()) return;
          setListCreating(true);
          try {
            const resp = await fetch('/api/list-builder/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: listName.trim(),
                recordIds: Array.from(selectedIds),
                objectType: 'contacts',
                listType: 'static',
              }),
            });
            const result = await resp.json();
            if (result.success) {
              setListResult({ url: result.listUrl, count: selectedIds.size });
              setSelectedIds(new Set());
            }
          } finally {
            setListCreating(false);
          }
        };

        return (
          <div className="mb-6">
            {/* Toolbar: filters + action */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 mr-1">Filters:</span>
                <select
                  value={empFilter}
                  onChange={(e) => setEmpFilter(e.target.value as EmployeeFilter)}
                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs bg-white"
                >
                  <option value="all">All sizes</option>
                  <option value="50+">50+ employees</option>
                  <option value="200+">200+ employees</option>
                  <option value="1000+">1,000+ employees</option>
                </select>
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value as TierFilter)}
                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs bg-white"
                >
                  <option value="all">All tiers</option>
                  <option value="hot">Hot</option>
                  <option value="warm">Warm</option>
                  <option value="cold">Cold</option>
                </select>
                <span className="text-xs text-gray-400 ml-2">{filtered.length} prospects</span>
              </div>
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => { setListModalOpen(true); setListResult(null); setListName(`Scout Enterprise — ${new Date().toLocaleDateString()}`); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-truv-blue text-white hover:bg-blue-700 transition-colors"
                  >
                    Add {selectedIds.size} to HubSpot List
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="w-10 px-3 py-2">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-gray-300" />
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Contact</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Company</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Employees</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Revenue</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Industry</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Tier</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Routing</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Score</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Tech</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Scored</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400 text-sm">No enterprise prospects match current filters</td></tr>
                  ) : (
                    filtered.map((p) => (
                      <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(p.id) ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleOne(p.id)} className="rounded border-gray-300" />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => { setSelectedContact(p); setTraceLayer(null); fetchTrace(p.id); }}
                            className="text-left"
                          >
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[160px]">{p.name}</p>
                            <p className="text-[10px] text-gray-500 truncate max-w-[160px]">{p.title}</p>
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-sm text-gray-900 truncate max-w-[140px]">{p.companyName || p.company}</p>
                          {p.companyDomain && <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{p.companyDomain}</p>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`text-sm font-medium ${p.employeeCount && p.employeeCount >= 200 ? 'text-green-700' : 'text-gray-700'}`}>
                            {formatEmployees(p.employeeCount)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`text-sm font-medium ${p.annualRevenue && p.annualRevenue >= 50_000_000 ? 'text-green-700' : 'text-gray-700'}`}>
                            {formatRevenue(p.annualRevenue)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs text-gray-600 truncate block max-w-[100px]">{p.industry || '--'}</span>
                        </td>
                        <td className="px-3 py-2 text-center">{tierBadge(p.tier)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${p.routing === 'enterprise' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                            {p.routing || '--'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`text-sm font-bold ${p.score !== null ? (p.score >= 70 ? 'text-red-600' : p.score >= 50 ? 'text-amber-600' : 'text-blue-600') : 'text-gray-400'}`}>
                            {p.score ?? '--'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {p.techMatches ? (
                            <div className="flex flex-wrap gap-0.5 max-w-[120px]">
                              {p.techMatches.split(',').slice(0, 2).map((t, i) => (
                                <span key={i} className="px-1 py-0.5 bg-purple-50 text-purple-700 rounded text-[9px]">{t.trim()}</span>
                              ))}
                              {p.techMatches.split(',').length > 2 && (
                                <span className="text-[9px] text-gray-400">+{p.techMatches.split(',').length - 2}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400">--</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="text-[10px] text-gray-400">{timeAgo(p.scoredAt)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Add to List Modal */}
            <AnimatePresence>
              {listModalOpen && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
                  onClick={() => { if (!listCreating) setListModalOpen(false); }}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {listResult ? (
                      <div>
                        <p className="text-lg font-semibold text-gray-900 mb-2">List Created</p>
                        <p className="text-sm text-gray-600 mb-4">{listResult.count} contacts added to HubSpot list.</p>
                        <div className="flex gap-2">
                          <a
                            href={listResult.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 text-center"
                          >
                            Open in HubSpot
                          </a>
                          <button
                            onClick={() => setListModalOpen(false)}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-lg font-semibold text-gray-900 mb-1">Add to HubSpot List</p>
                        <p className="text-sm text-gray-500 mb-4">{selectedIds.size} contacts selected</p>
                        <input
                          type="text"
                          value={listName}
                          onChange={(e) => setListName(e.target.value)}
                          placeholder="List name..."
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-truv-blue focus:border-transparent"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleCreateList}
                            disabled={listCreating || !listName.trim()}
                            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-truv-blue text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {listCreating ? 'Creating...' : 'Create List'}
                          </button>
                          <button
                            onClick={() => setListModalOpen(false)}
                            disabled={listCreating}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })()}

      {/* ── SCORES TAB CONTENT ────────────────── */}
      {activeTab === 'scores' && <>

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
                  <button className="flex-1 text-left min-w-0" onClick={() => { setSelectedContact(c); setTraceLayer(null); fetchTrace(c.id); }}>
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
                  <button key={c.id} onClick={() => { setSelectedContact(c); setTraceLayer(null); fetchTrace(c.id); }}
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

      </>}

      {/* ── CONTACT DETAIL DRAWER ──────────── */}
      <AnimatePresence>
        {selectedContact && (() => {
          const c = selectedContact;
          const sourceLabel: Record<string, string> = { form_submission: 'Pipeline A — Inbound', closed_lost_reengagement: 'Pipeline B — Closed-Lost', dashboard_signup: 'Pipeline C — Dashboard Signup' };
          const stepLabels = [
            { key: 'trigger' as const, icon: '📡', label: 'Trigger' },
            { key: 'hubspot' as const, icon: '🔗', label: 'HubSpot' },
            { key: 'scorer' as const, icon: '📊', label: 'Scorer' },
            { key: 'apollo' as const, icon: '🔍', label: 'LOS/POS Bot' },
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
                      const traceKey = s.key === 'scorer' ? 'deterministic_scorer' : s.key === 'apollo' ? 'apollo_enrichment' : s.key === 'agent' ? 'scout_agent' : null;
                      const hasTrace = traceKey && traceData?.layers?.[traceKey];
                      return (
                        <div key={s.key} className="flex items-center gap-1.5 flex-1">
                          <button
                            onClick={() => traceKey && setTraceLayer(traceLayer === traceKey ? null : traceKey)}
                            disabled={!traceKey}
                            className={`flex-1 px-2.5 py-2 rounded-lg border text-center transition-all ${stepStatusStyle(status)} ${hasTrace ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : traceKey ? 'cursor-default' : 'cursor-default'} ${traceLayer === traceKey ? 'ring-2 ring-blue-500' : ''}`}
                          >
                            <p className="text-[10px] font-medium">{s.icon} {s.label}</p>
                            <p className="text-[9px] mt-0.5 opacity-80 truncate">{step?.detail || ''}</p>
                            {hasTrace && <p className="text-[8px] mt-0.5 text-blue-500 font-medium">Click for trace</p>}
                          </button>
                          {i < stepLabels.length - 1 && <span className="text-gray-300 text-[10px] flex-shrink-0">→</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Trace Detail Panel */}
                  {traceLayer && traceData?.layers?.[traceLayer] && (() => {
                    const layer = traceData.layers[traceLayer];
                    return (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 bg-gray-900 rounded-lg overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${layer.status === 'complete' ? 'bg-green-400' : layer.status === 'failed' ? 'bg-red-400' : 'bg-gray-400'}`} />
                            <span className="text-xs font-medium text-gray-200">{traceLayer.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
                            {layer.duration_ms != null && (
                              <span className="text-[10px] text-gray-400">{layer.duration_ms}ms</span>
                            )}
                          </div>
                          <button onClick={() => setTraceLayer(null)} className="text-gray-400 hover:text-white text-xs">Close</button>
                        </div>
                        <div className="px-4 py-3 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Input</p>
                            <pre className="text-[10px] text-green-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto font-mono">
                              {JSON.stringify(layer.input_summary, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">{layer.error ? 'Error' : 'Output'}</p>
                            <pre className={`text-[10px] whitespace-pre-wrap break-all max-h-48 overflow-y-auto font-mono ${layer.error ? 'text-red-300' : 'text-blue-300'}`}>
                              {layer.error ? layer.error : JSON.stringify(layer.output_summary, null, 2)}
                            </pre>
                          </div>
                        </div>
                        {traceData.total_duration_ms != null && (
                          <div className="px-4 py-1.5 border-t border-gray-700 flex items-center gap-4">
                            <span className="text-[9px] text-gray-500">Pipeline total: {traceData.total_duration_ms}ms</span>
                            <span className="text-[9px] text-gray-500">Source: {traceData.source}</span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })()}
                  {traceLoading && (
                    <div className="mt-2 text-[10px] text-gray-400 animate-pulse">Loading trace data...</div>
                  )}
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

                    {/* Step 3: LOS/POS Bot */}
                    <div className={`flex-1 min-w-0 border border-r-0 p-3 ${c.steps?.apollo?.status === 'complete' ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 text-[9px] font-bold flex items-center justify-center">3</span>
                        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">LOS/POS Bot</p>
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
                          {c.steps?.apollo?.status === 'no-data' ? 'No tech data found' : 'Bot not run'}
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
