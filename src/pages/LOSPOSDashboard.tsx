import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BOT_URL = import.meta.env.VITE_LOS_POS_BOT_URL || 'https://em8y3yp3qk.us-east-1.awsapprunner.com';
const BOT_TOKEN = import.meta.env.VITE_LOS_POS_BOT_TOKEN || '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScanResult {
  domain: string;
  los: string | null;
  pos: string | null;
  los_confidence: string;
  pos_confidence: string;
  method: string | null;
  evidence: string[];
  errors: string[];
}

interface ScanStep {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'skipped';
  detail?: string;
}

interface RecentEnrichment {
  id: string;
  name: string;
  domain: string;
  los: string | null;
  pos: string | null;
  detectedAt: string | null;
  method: string | null;
}

interface DashboardStats {
  totalEnriched: number;
  detectedCount: number;
  unknownCount: number;
  topLos: [string, number][];
  topPos: [string, number][];
  recent: RecentEnrichment[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '–';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function VendorBadge({ value, type }: { value: string | null; type: 'los' | 'pos' }) {
  if (!value || value === 'Unknown') {
    return <span className="text-gray-400 text-xs">–</span>;
  }
  const colors = type === 'los'
    ? 'bg-truv-blue/10 text-truv-blue border border-truv-blue/20'
    : 'bg-purple-50 text-purple-700 border border-purple-200';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${colors}`}>
      {value}
    </span>
  );
}

function MethodBadge({ method }: { method: string | null }) {
  if (!method) return <span className="text-gray-400 text-xs">–</span>;
  const map: Record<string, string> = {
    html_content: 'HTML',
    http_redirect: 'Redirect',
    dns_cname: 'DNS',
    ssl_cert: 'SSL',
    multi: 'Multi',
  };
  const label = map[method] || method;
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Detection steps simulator
// ---------------------------------------------------------------------------

const DETECTION_STEPS: Omit<ScanStep, 'status' | 'detail'>[] = [
  { key: 'normalize', label: 'Normalizing domain' },
  { key: 'ssrf', label: 'SSRF safety check' },
  { key: 'dns', label: 'DNS / CNAME probe' },
  { key: 'http', label: 'HTTP redirect chain' },
  { key: 'ssl', label: 'SSL certificate scan' },
  { key: 'html', label: 'HTML content fingerprint' },
];

// ---------------------------------------------------------------------------
// Scanner component
// ---------------------------------------------------------------------------

function DomainScanner({ onResult }: { onResult: (r: ScanResult) => void }) {
  const [domain, setDomain] = useState('');
  const [scanning, setScanning] = useState(false);
  const [steps, setSteps] = useState<ScanStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scan = useCallback(async () => {
    const d = domain.trim().replace(/^https?:\/\//i, '').split('/')[0];
    if (!d) return;
    setError(null);

    const initial: ScanStep[] = DETECTION_STEPS.map((s) => ({ ...s, status: 'pending' }));
    setSteps(initial);
    setScanning(true);

    // Animate steps while the real request is in-flight
    const stepDelay = 350;
    const animate = async () => {
      for (let i = 0; i < DETECTION_STEPS.length; i++) {
        await new Promise((r) => setTimeout(r, stepDelay));
        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: 'running' } :
            idx < i ? { ...s, status: 'done' } : s
          )
        );
      }
    };
    animate();

    try {
      const resp = await fetch(`${BOT_URL}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: d }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${resp.status}`);
      }
      const result: ScanResult = await resp.json();

      // Mark all steps done and annotate last step with result
      setSteps(DETECTION_STEPS.map((s, i) => ({
        ...s,
        status: 'done',
        detail: i === DETECTION_STEPS.length - 1
          ? (result.los || result.pos
            ? `Detected: ${[result.los, result.pos].filter(Boolean).join(' / ')}`
            : 'No match found')
          : undefined,
      })));

      onResult(result);
    } catch (e: any) {
      setError(e.message || 'Scan failed');
      setSteps((prev) => prev.map((s) => s.status === 'running' ? { ...s, status: 'skipped' } : s));
    } finally {
      setScanning(false);
    }
  }, [domain, onResult]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !scanning) scan();
  };

  const stepIcon = (status: ScanStep['status']) => {
    if (status === 'done') return <span className="text-green-500">✓</span>;
    if (status === 'running') return <span className="inline-block w-3 h-3 rounded-full border-2 border-truv-blue border-t-transparent animate-spin" />;
    if (status === 'skipped') return <span className="text-red-400">✗</span>;
    return <span className="w-2 h-2 rounded-full bg-gray-200 inline-block" />;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="text-base font-semibold text-truv-blue-dark mb-1">Live Domain Scanner</h2>
      <p className="text-xs text-gray-500 mb-4">Enter any lender domain to detect their LOS/POS stack in real time.</p>

      <div className="flex gap-2 mb-5">
        <input
          ref={inputRef}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={handleKey}
          placeholder="e.g. crosscountrymortgage.com"
          disabled={scanning}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-truv-blue/30 focus:border-truv-blue disabled:opacity-50"
        />
        <button
          onClick={scan}
          disabled={scanning || !domain.trim()}
          className="px-4 py-2 rounded-lg bg-truv-blue text-white text-sm font-medium hover:bg-truv-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {scanning ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {/* Detection steps */}
      <AnimatePresence>
        {steps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 mb-4"
          >
            {steps.map((step, i) => (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-center gap-2.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  step.status === 'running' ? 'bg-truv-blue/5' :
                  step.status === 'done' ? 'bg-gray-50' : 'bg-white'
                }`}
              >
                <span className="w-4 flex justify-center">{stepIcon(step.status)}</span>
                <span className={`font-medium ${step.status === 'pending' ? 'text-gray-400' : 'text-gray-700'}`}>
                  {step.label}
                </span>
                {step.detail && (
                  <span className="ml-auto text-green-600 font-medium">{step.detail}</span>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scan result card
// ---------------------------------------------------------------------------

function ScanResultCard({ result }: { result: ScanResult }) {
  const detected = result.los || result.pos;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 ${detected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-lg ${detected ? '✅' : '❓'}`}>{detected ? '✅' : '❓'}</span>
        <span className="font-semibold text-truv-blue-dark text-sm">{result.domain}</span>
        {result.method && <MethodBadge method={result.method} />}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">LOS</p>
          <VendorBadge value={result.los} type="los" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">POS</p>
          <VendorBadge value={result.pos} type="pos" />
        </div>
      </div>
      {result.evidence.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1.5">Evidence</p>
          <ul className="space-y-0.5">
            {result.evidence.map((e, i) => (
              <li key={i} className="text-xs text-gray-600">{e}</li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function StatsBar({ stats }: { stats: DashboardStats }) {
  const detectionRate = stats.totalEnriched > 0
    ? Math.round((stats.detectedCount / stats.totalEnriched) * 100)
    : 0;

  return (
    <div className="grid grid-cols-3 gap-4">
      {[
        { label: 'Companies Enriched', value: stats.totalEnriched.toLocaleString() },
        { label: 'LOS/POS Detected', value: stats.detectedCount.toLocaleString() },
        { label: 'Detection Rate', value: `${detectionRate}%` },
      ].map((s) => (
        <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-semibold text-truv-blue-dark">{s.value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vendor breakdown
// ---------------------------------------------------------------------------

function VendorBreakdown({ topLos, topPos }: { topLos: [string, number][]; topPos: [string, number][] }) {
  const max = Math.max(...[...topLos, ...topPos].map(([, n]) => n), 1);

  return (
    <div className="grid grid-cols-2 gap-4">
      {([['LOS Platforms', topLos, 'los'], ['POS Platforms', topPos, 'pos']] as const).map(([title, vendors, type]) => (
        <div key={title} className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-truv-blue-dark mb-4">{title}</h3>
          {vendors.length === 0 ? (
            <p className="text-xs text-gray-400">No data yet</p>
          ) : (
            <div className="space-y-2.5">
              {vendors.map(([name, count]) => (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700 font-medium">{name}</span>
                    <span className="text-gray-400">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / max) * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={`h-full rounded-full ${type === 'los' ? 'bg-truv-blue' : 'bg-purple-400'}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent enrichments table
// ---------------------------------------------------------------------------

function RecentTable({ rows }: { rows: RecentEnrichment[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-truv-blue-dark">Recent Enrichments</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Company', 'Domain', 'LOS', 'POS', 'Method', 'Detected'].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wide text-gray-400 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[160px] truncate">{row.name}</td>
                <td className="px-4 py-2.5 text-gray-500">{row.domain}</td>
                <td className="px-4 py-2.5"><VendorBadge value={row.los} type="los" /></td>
                <td className="px-4 py-2.5"><VendorBadge value={row.pos} type="pos" /></td>
                <td className="px-4 py-2.5"><MethodBadge method={row.method} /></td>
                <td className="px-4 py-2.5 text-gray-400">{timeAgo(row.detectedAt)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function LOSPOSDashboard() {
  const [botOnline, setBotOnline] = useState<boolean | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);

  // Check bot health
  useEffect(() => {
    fetch(`${BOT_URL}/health`)
      .then((r) => setBotOnline(r.ok))
      .catch(() => setBotOnline(false));
  }, []);

  // Load HubSpot stats
  const loadStats = useCallback(async () => {
    try {
      const resp = await fetch('/api/los-pos-dashboard');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setStats(await resp.json());
    } catch (e: any) {
      setStatsError(e.message);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const triggerBatch = async () => {
    setBatchRunning(true);
    setBatchMsg(null);
    try {
      const resp = await fetch(`${BOT_URL}/run-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Scout-Token': BOT_TOKEN },
        body: JSON.stringify({ limit: 100 }),
      });
      const data = await resp.json();
      setBatchMsg(resp.ok ? `Batch started — up to ${data.limit} companies` : data.detail || 'Failed');
    } catch (e: any) {
      setBatchMsg(e.message);
    } finally {
      setBatchRunning(false);
      setTimeout(() => setBatchMsg(null), 5000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-truv-blue-dark">LOS/POS Detection Bot</h1>
          <p className="text-sm text-gray-500 mt-0.5">Automatic tech stack detection for mortgage lenders in HubSpot</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Bot status */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium"
            style={{
              background: botOnline === null ? '#f9fafb' : botOnline ? '#f0fdf4' : '#fef2f2',
              borderColor: botOnline === null ? '#e5e7eb' : botOnline ? '#bbf7d0' : '#fecaca',
              color: botOnline === null ? '#9ca3af' : botOnline ? '#15803d' : '#dc2626',
            }}>
            <span className={`w-1.5 h-1.5 rounded-full ${botOnline === null ? 'bg-gray-300' : botOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {botOnline === null ? 'Checking…' : botOnline ? 'Bot Online' : 'Bot Offline'}
          </div>

          {/* Run batch */}
          <button
            onClick={triggerBatch}
            disabled={batchRunning || !botOnline}
            className="px-4 py-1.5 rounded-full bg-truv-blue text-white text-xs font-medium hover:bg-truv-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {batchRunning ? 'Starting…' : 'Run Batch Now'}
          </button>
        </div>
      </div>

      {batchMsg && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-2.5 rounded-lg bg-truv-blue/5 border border-truv-blue/20 text-sm text-truv-blue"
        >
          {batchMsg}
        </motion.div>
      )}

      {/* Stats */}
      {stats && <StatsBar stats={stats} />}

      {/* Two-column layout: scanner + result */}
      <div className="grid grid-cols-2 gap-4">
        <DomainScanner onResult={setScanResult} />
        <AnimatePresence mode="wait">
          {scanResult ? (
            <ScanResultCard key={scanResult.domain} result={scanResult} />
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 flex items-center justify-center"
            >
              <p className="text-sm text-gray-400">Scan result will appear here</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Vendor breakdown */}
      {stats && <VendorBreakdown topLos={stats.topLos} topPos={stats.topPos} />}

      {/* Recent enrichments */}
      {stats && stats.recent.length > 0 && <RecentTable rows={stats.recent} />}

      {statsError && (
        <p className="text-xs text-red-500">Could not load HubSpot stats: {statsError}</p>
      )}
    </div>
  );
}
