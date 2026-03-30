import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// In production, LOS/POS bot is reverse-proxied at /los-pos by server.ts.
// In dev, Vite proxies /los-pos to the local bot (see vite.config.ts).
const BOT_URL = '/los-pos';

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
  browser_log: string[];
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
  topMethods: [string, number][];
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
    apollo: 'Apollo',
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

const BASE_DETECTION_STEPS: Omit<ScanStep, 'status' | 'detail'>[] = [
  { key: 'normalize', label: 'Normalizing domain' },
  { key: 'ssrf', label: 'SSRF safety check' },
  { key: 'dns', label: 'DNS / CNAME probe' },
  { key: 'http', label: 'HTTP redirect chain' },
  { key: 'ssl', label: 'SSL certificate scan' },
  { key: 'html', label: 'HTML content fingerprint' },
  { key: 'apollo', label: 'Apollo tech stack fallback' },
];

const BROWSER_STEP: Omit<ScanStep, 'status' | 'detail'> = {
  key: 'playwright',
  label: 'Headless browser render',
};

// ---------------------------------------------------------------------------
// Scanner component
// ---------------------------------------------------------------------------

function DomainScanner({ onResult }: { onResult: (r: ScanResult) => void }) {
  const [domain, setDomain] = useState('');
  const [useBrowser, setUseBrowser] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [steps, setSteps] = useState<ScanStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [browserLog, setBrowserLog] = useState<string[]>([]);
  const [logExpanded, setLogExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const scan = useCallback(async () => {
    const d = domain.trim().replace(/^https?:\/\//i, '').split('/')[0];
    if (!d) return;
    setError(null);
    setBrowserLog([]);
    setLogExpanded(false);

    const detectionSteps = useBrowser
      ? [...BASE_DETECTION_STEPS, BROWSER_STEP]
      : BASE_DETECTION_STEPS;

    const initial: ScanStep[] = detectionSteps.map((s) => ({ ...s, status: 'pending' }));
    setSteps(initial);
    setScanning(true);

    // Animate steps while the real request is in-flight
    const stepDelay = useBrowser ? 500 : 350;
    const animate = async () => {
      for (let i = 0; i < detectionSteps.length; i++) {
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
        body: JSON.stringify({ domain: d, use_browser: useBrowser }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${resp.status}`);
      }
      const result: ScanResult = await resp.json();

      // Mark all steps done and annotate last step with result
      const detectionStepsFinal = useBrowser
        ? [...BASE_DETECTION_STEPS, BROWSER_STEP]
        : BASE_DETECTION_STEPS;
      setSteps(detectionStepsFinal.map((s, i) => ({
        ...s,
        status: 'done',
        detail: i === detectionStepsFinal.length - 1
          ? (result.los || result.pos
            ? `Detected: ${[result.los, result.pos].filter(Boolean).join(' / ')}`
            : 'No match found')
          : undefined,
      })));

      if (result.browser_log?.length) {
        setBrowserLog(result.browser_log);
        setLogExpanded(!result.los && !result.pos);
      }
      onResult(result);
    } catch (e: any) {
      setError(e.message || 'Scan failed');
      setSteps((prev) => prev.map((s) => s.status === 'running' ? { ...s, status: 'skipped' } : s));
    } finally {
      setScanning(false);
    }
  }, [domain, useBrowser, onResult]);

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

      <div className="flex gap-2 mb-3">
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

      {/* Browser toggle */}
      <label className="flex items-center gap-2 mb-4 cursor-pointer select-none w-fit">
        <button
          type="button"
          role="switch"
          aria-checked={useBrowser}
          onClick={() => !scanning && setUseBrowser((v) => !v)}
          disabled={scanning}
          className={`relative w-8 h-4 rounded-full transition-colors ${useBrowser ? 'bg-truv-blue' : 'bg-gray-200'} disabled:opacity-50`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${useBrowser ? 'translate-x-4' : 'translate-x-0'}`}
          />
        </button>
        <span className="text-xs text-gray-600">
          Use headless browser
          {useBrowser && <span className="ml-1.5 text-amber-600 font-medium">(~15s)</span>}
        </span>
      </label>

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

      {/* Browser URL log */}
      <AnimatePresence>
        {browserLog.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <button
              type="button"
              onClick={() => setLogExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 w-full text-left px-1 py-1"
            >
              <span className={`transition-transform ${logExpanded ? 'rotate-90' : ''}`}>▶</span>
              <span className="font-medium">Browser URL log</span>
              <span className="text-gray-400">({browserLog.length} URLs tried)</span>
            </button>
            <AnimatePresence>
              {logExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-1 rounded-lg bg-gray-950 border border-gray-800 overflow-hidden"
                >
                  <div className="p-3 space-y-1 font-mono max-h-48 overflow-y-auto">
                    {browserLog.map((line, i) => {
                      const isMatch = line.startsWith('✓') && line.includes('matched');
                      const isNoMatch = line.startsWith('○');
                      const isError = line.startsWith('✗');
                      return (
                        <div
                          key={i}
                          className={`text-[11px] leading-5 ${
                            isMatch ? 'text-green-400' :
                            isError ? 'text-red-400' :
                            isNoMatch ? 'text-gray-500' :
                            'text-gray-400'
                          }`}
                        >
                          {line}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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

  const cards = [
    { label: 'Companies Scanned', value: stats.totalEnriched.toLocaleString(), color: 'text-truv-blue-dark' },
    { label: 'LOS/POS Detected', value: stats.detectedCount.toLocaleString(), color: 'text-green-600' },
    { label: 'Unknown', value: stats.unknownCount.toLocaleString(), color: 'text-gray-400' },
    { label: 'Detection Rate', value: `${detectionRate}%`, color: 'text-truv-blue' },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((s) => (
        <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vendor breakdown
// ---------------------------------------------------------------------------

function VendorBreakdown({ topLos, topPos, onVendorClick }: {
  topLos: [string, number][];
  topPos: [string, number][];
  onVendorClick: (vendor: string, type: 'los' | 'pos') => void;
}) {
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
                <button
                  key={name}
                  type="button"
                  onClick={() => onVendorClick(name, type)}
                  className="block w-full text-left group"
                >
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700 font-medium group-hover:text-truv-blue transition-colors">{name}</span>
                    <span className="text-gray-400 group-hover:text-truv-blue transition-colors">{count} →</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / max) * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={`h-full rounded-full ${type === 'los' ? 'bg-truv-blue' : 'bg-purple-400'}`}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detection method breakdown
// ---------------------------------------------------------------------------

function MethodBreakdown({ methods, total }: { methods: [string, number][]; total: number }) {
  const methodLabels: Record<string, string> = {
    html_content: 'HTML Fingerprint',
    http_redirect: 'HTTP Redirect',
    dns_cname: 'DNS CNAME',
    ssl_cert: 'SSL Certificate',
    multi: 'Multi-Signal',
    apollo: 'Apollo Tech Stack',
  };

  const methodColors: Record<string, string> = {
    html_content: 'bg-truv-blue',
    apollo: 'bg-purple-400',
    dns_cname: 'bg-green-400',
    multi: 'bg-amber-400',
    http_redirect: 'bg-cyan-400',
    ssl_cert: 'bg-pink-400',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-truv-blue-dark mb-4">Detection Methods</h3>
      {methods.length === 0 ? (
        <p className="text-xs text-gray-400">No data yet</p>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="h-3 rounded-full overflow-hidden flex mb-4">
            {methods.map(([method, count]) => (
              <motion.div
                key={method}
                initial={{ width: 0 }}
                animate={{ width: `${(count / total) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={`h-full ${methodColors[method] || 'bg-gray-300'}`}
                title={`${methodLabels[method] || method}: ${count}`}
              />
            ))}
          </div>
          {/* Legend */}
          <div className="grid grid-cols-2 gap-2">
            {methods.map(([method, count]) => (
              <div key={method} className="flex items-center gap-2 text-xs">
                <span className={`w-2.5 h-2.5 rounded-sm ${methodColors[method] || 'bg-gray-300'}`} />
                <span className="text-gray-700 font-medium">{methodLabels[method] || method}</span>
                <span className="text-gray-400 ml-auto">{count} ({Math.round((count / total) * 100)}%)</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detection rate donut
// ---------------------------------------------------------------------------

function DetectionDonut({ detected, unknown }: { detected: number; unknown: number }) {
  const total = detected + unknown;
  const rate = total > 0 ? Math.round((detected / total) * 100) : 0;
  const circumference = 2 * Math.PI * 40;
  const strokeDasharray = `${(detected / total) * circumference} ${circumference}`;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col items-center justify-center">
      <h3 className="text-sm font-semibold text-truv-blue-dark mb-4">Detection Rate</h3>
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="10" />
          <motion.circle
            cx="50" cy="50" r="40" fill="none" stroke="#2c64e3" strokeWidth="10"
            strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-truv-blue-dark">{rate}%</span>
        </div>
      </div>
      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-truv-blue" /> {detected} detected
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-200" /> {unknown} unknown
        </span>
      </div>
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
// Vendor detail panel (slide-in when clicking a vendor bar)
// ---------------------------------------------------------------------------

function VendorDetailPanel({ vendor, type, onClose }: {
  vendor: string;
  type: 'los' | 'pos';
  onClose: () => void;
}) {
  const [companies, setCompanies] = useState<RecentEnrichment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/los-pos-dashboard?vendor=${encodeURIComponent(vendor)}&type=${type}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setCompanies(data.companies || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [vendor, type]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <VendorBadge value={vendor} type={type} />
          <span className="text-sm text-gray-500">
            {companies.length} {companies.length === 1 ? 'company' : 'companies'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>
      {loading ? (
        <div className="p-8 text-center text-sm text-gray-400">Loading companies...</div>
      ) : error ? (
        <div className="p-5 text-xs text-red-500">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Company', 'Domain', 'LOS', 'POS', 'Method'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wide text-gray-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((row, i) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.01 }}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[200px] truncate">{row.name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{row.domain}</td>
                  <td className="px-4 py-2.5"><VendorBadge value={row.los} type="los" /></td>
                  <td className="px-4 py-2.5"><VendorBadge value={row.pos} type="pos" /></td>
                  <td className="px-4 py-2.5"><MethodBadge method={row.method} /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// How It Works section
// ---------------------------------------------------------------------------

function HowItWorks() {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const layers = [
    { icon: '1', title: 'DNS CNAME Probes', desc: 'Resolves CNAME records on 19 portal subdomains to identify vendor-hosted borrower portals.' },
    { icon: '2', title: 'HTTP Redirect Chains', desc: 'Follows redirect chains on portal URLs to detect vendor hosting (e.g., apply.lender.com redirecting to blend.com).' },
    { icon: '3', title: 'SSL Certificate Inspection', desc: 'Examines SSL certificate CN and SAN entries on portal subdomains for vendor domain signatures.' },
    { icon: '4', title: 'HTML Content Fingerprinting', desc: 'Scans rendered page source across 10 URL paths for vendor-specific patterns: script tags, iframes, SDK references.' },
    { icon: '5', title: 'Apollo Tech Stack Fallback', desc: 'Queries Apollo organization enrichment and matches against 36 known vendor signatures with fuzzy substring matching.' },
  ];

  const losVendors = ['Encompass (ICE Mortgage Technology)', 'MeridianLink / OpenClose', 'Black Knight / LoanSphere / Empower', 'Mortgage Cadence (Accenture)', 'Calyx (Point, Path)', 'Byte Software / BytePro', 'LendingPad', 'MortgageFlex', 'Optimal Blue', 'Sagent / LoanServ'];
  const posVendors = ['Blend', 'SimpleNexus / nCino', 'Encompass Consumer Connect', 'Floify', 'BeSmartee', 'Maxwell', 'Roostify', 'LoanDepot / mello', 'Finastra / Mortgagebot', 'Total Expert'];
  const subdomains = ['apply', 'portal', 'borrower', 'app', 'loan', 'mortgage', 'start', 'lending', 'home', 'myloans', 'loanapp', 'secure', 'digital', 'homeloans', 'pos', 'myaccount', 'online', 'loans', 'homeloan'];
  const paths = ['/apply', '/borrower', '/start-application', '/get-started', '/apply-now', '/mortgage-application', '/home-loans', '/start-your-loan', '/prequalify', '/get-prequalified'];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-truv-blue-dark mb-2">How Detection Works</h3>
      <p className="text-sm text-gray-600 mb-5 leading-relaxed">
        The bot runs a 5-layer detection waterfall against each mortgage lender domain in HubSpot. For every company, it probes 19 subdomains, follows redirect chains, inspects SSL certificates, fingerprints HTML content, and falls back to Apollo tech stack enrichment. Detected LOS and POS platforms are written directly to HubSpot company records.
      </p>

      {/* Detection layers */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {layers.map((layer) => (
          <div key={layer.icon} className="bg-gray-50 rounded-xl p-3">
            <span className="inline-flex w-6 h-6 rounded-full bg-truv-blue/10 text-truv-blue text-[11px] font-semibold items-center justify-center mb-2">
              {layer.icon}
            </span>
            <p className="text-xs font-medium text-gray-700 mb-1">{layer.title}</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">{layer.desc}</p>
          </div>
        ))}
      </div>

      {/* Expandable vendor + subdomain details */}
      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-truv-blue font-medium hover:text-truv-blue/80 transition-colors"
      >
        <span className={`transition-transform ${detailsOpen ? 'rotate-90' : ''}`}>▶</span>
        {detailsOpen ? 'Hide' : 'Show'} full vendor list, subdomains, and URL paths
      </button>

      <AnimatePresence>
        {detailsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-4 mt-4">
              {/* LOS Vendors */}
              <div className="bg-truv-blue/5 rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wide text-truv-blue font-semibold mb-2">LOS Vendors Detected ({losVendors.length})</p>
                <ul className="space-y-1">
                  {losVendors.map((v) => (
                    <li key={v} className="text-[11px] text-gray-600 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-truv-blue flex-shrink-0" />{v}
                    </li>
                  ))}
                </ul>
              </div>
              {/* POS Vendors */}
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wide text-purple-700 font-semibold mb-2">POS Vendors Detected ({posVendors.length})</p>
                <ul className="space-y-1">
                  {posVendors.map((v) => (
                    <li key={v} className="text-[11px] text-gray-600 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-purple-400 flex-shrink-0" />{v}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              {/* Subdomains */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-2">Subdomains Probed ({subdomains.length})</p>
                <div className="flex flex-wrap gap-1">
                  {subdomains.map((s) => (
                    <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-gray-200 text-gray-600">{s}.</span>
                  ))}
                </div>
              </div>
              {/* URL Paths */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-2">URL Paths Scanned ({paths.length})</p>
                <div className="flex flex-wrap gap-1">
                  {paths.map((p) => (
                    <span key={p} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-gray-200 text-gray-600">{p}</span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const [vendorFilter, setVendorFilter] = useState<{ vendor: string; type: 'los' | 'pos' } | null>(null);

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
      const resp = await fetch('/api/los-pos-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          <h1 className="text-2xl font-semibold text-truv-blue-dark">LOS/POS Tech Stack Intelligence</h1>
          <p className="text-sm text-gray-500 mt-0.5">Automated detection across 900+ mortgage lenders in HubSpot</p>
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

      {/* How it works — always visible at top */}
      <HowItWorks />

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

      {/* Detection donut + method breakdown */}
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <DetectionDonut detected={stats.detectedCount} unknown={stats.unknownCount} />
          <MethodBreakdown methods={stats.topMethods || []} total={stats.detectedCount} />
        </div>
      )}

      {/* Vendor breakdown */}
      {stats && (
        <VendorBreakdown
          topLos={stats.topLos}
          topPos={stats.topPos}
          onVendorClick={(vendor, type) => setVendorFilter({ vendor, type })}
        />
      )}

      {/* Vendor detail panel */}
      <AnimatePresence>
        {vendorFilter && (
          <VendorDetailPanel
            key={`${vendorFilter.vendor}-${vendorFilter.type}`}
            vendor={vendorFilter.vendor}
            type={vendorFilter.type}
            onClose={() => setVendorFilter(null)}
          />
        )}
      </AnimatePresence>

      {/* Recent enrichments */}
      {stats && stats.recent.length > 0 && <RecentTable rows={stats.recent} />}

      {statsError && (
        <p className="text-xs text-red-500">Could not load HubSpot stats: {statsError}</p>
      )}
    </div>
  );
}
