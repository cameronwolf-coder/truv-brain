import { useState, useMemo } from 'react';
import proofPoints from '../data/proofPoints.json';

type ProofPoint = {
  id: string;
  customer: string;
  vertical: string;
  metricTypes: string[];
  metrics: { value: string; label: string; type: string }[];
  quotes: { text: string; author: string; title: string }[];
};

const VERTICALS = [
  { id: 'all', label: 'All Verticals' },
  { id: 'mortgage', label: 'Mortgage' },
  { id: 'consumer', label: 'Consumer Lending' },
  { id: 'auto', label: 'Auto Lending' },
  { id: 'credit_union', label: 'Credit Union' },
  { id: 'fintech', label: 'Fintech' },
  { id: 'payments', label: 'Payment Services' },
];

const METRIC_TYPES = [
  { id: 'all', label: 'All Metrics' },
  { id: 'cost', label: 'Cost Savings' },
  { id: 'conversion', label: 'Conversion' },
  { id: 'speed', label: 'Speed' },
  { id: 'support', label: 'Support' },
  { id: 'fraud', label: 'Fraud Detection' },
];

export function ProofPoints() {
  const [search, setSearch] = useState('');
  const [verticalFilter, setVerticalFilter] = useState('all');
  const [metricFilter, setMetricFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredProofPoints = useMemo(() => {
    return (proofPoints as ProofPoint[]).filter((pp) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesCustomer = pp.customer.toLowerCase().includes(searchLower);
        const matchesQuote = pp.quotes.some((q) =>
          q.text.toLowerCase().includes(searchLower)
        );
        const matchesMetric = pp.metrics.some(
          (m) =>
            m.value.toLowerCase().includes(searchLower) ||
            m.label.toLowerCase().includes(searchLower)
        );
        if (!matchesCustomer && !matchesQuote && !matchesMetric) return false;
      }

      // Vertical filter
      if (verticalFilter !== 'all' && pp.vertical !== verticalFilter) {
        return false;
      }

      // Metric type filter
      if (metricFilter !== 'all' && !pp.metricTypes.includes(metricFilter)) {
        return false;
      }

      return true;
    });
  }, [search, verticalFilter, metricFilter]);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getVerticalLabel = (id: string) => {
    const labels: Record<string, string> = {
      mortgage: 'MORTGAGE',
      consumer: 'CONSUMER',
      auto: 'AUTO',
      credit_union: 'CREDIT UNION',
      fintech: 'FINTECH',
      payments: 'PAYMENTS',
    };
    return labels[id] || id.toUpperCase();
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Proof Points</h1>
        <p className="text-gray-500 mt-1">
          Customer quotes and metrics for sales and marketing
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={verticalFilter}
          onChange={(e) => setVerticalFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {VERTICALS.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>

        <select
          value={metricFilter}
          onChange={(e) => setMetricFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {METRIC_TYPES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search customer or keyword..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 mb-4">
        {filteredProofPoints.length} proof point
        {filteredProofPoints.length !== 1 ? 's' : ''}
      </p>

      {/* Cards */}
      <div className="space-y-4">
        {filteredProofPoints.map((pp) => (
          <div
            key={pp.id}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{pp.customer}</h3>
                <div className="flex flex-wrap gap-2 mt-1">
                  {pp.metrics.map((m, i) => (
                    <span key={i} className="text-sm text-gray-600">
                      {m.value} {m.label}
                      {i < pp.metrics.length - 1 && ' ·'}
                    </span>
                  ))}
                </div>
              </div>
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                {getVerticalLabel(pp.vertical)}
              </span>
            </div>

            {/* Primary Quote */}
            {pp.quotes[0] && (
              <div className="relative">
                <blockquote className="text-gray-700 italic border-l-2 border-gray-200 pl-4">
                  "{pp.quotes[0].text}"
                  <footer className="text-sm text-gray-500 mt-2 not-italic">
                    — {pp.quotes[0].author}, {pp.quotes[0].title}
                  </footer>
                </blockquote>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `"${pp.quotes[0].text}" — ${pp.quotes[0].author}, ${pp.quotes[0].title}`,
                      `${pp.id}-quote-0`
                    )
                  }
                  className="absolute top-0 right-0 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  {copiedId === `${pp.id}-quote-0` ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}

            {/* Expand for more */}
            {(pp.quotes.length > 1 || pp.metrics.length > 2) && (
              <button
                onClick={() =>
                  setExpandedId(expandedId === pp.id ? null : pp.id)
                }
                className="mt-3 text-sm text-blue-600 hover:text-blue-800"
              >
                {expandedId === pp.id ? 'Show less' : 'Show more details'}
              </button>
            )}

            {/* Expanded content */}
            {expandedId === pp.id && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                {/* All metrics */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    All Metrics
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {pp.metrics.map((m, i) => (
                      <button
                        key={i}
                        onClick={() =>
                          copyToClipboard(`${m.value} ${m.label}`, `${pp.id}-metric-${i}`)
                        }
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm transition-colors"
                      >
                        {copiedId === `${pp.id}-metric-${i}`
                          ? 'Copied!'
                          : `${m.value} ${m.label}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Additional quotes */}
                {pp.quotes.length > 1 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Additional Quotes
                    </h4>
                    <div className="space-y-3">
                      {pp.quotes.slice(1).map((q, i) => (
                        <div key={i} className="relative">
                          <blockquote className="text-gray-700 italic border-l-2 border-gray-200 pl-4 text-sm">
                            "{q.text}"
                            <footer className="text-gray-500 mt-1 not-italic">
                              — {q.author}, {q.title}
                            </footer>
                          </blockquote>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                `"${q.text}" — ${q.author}, ${q.title}`,
                                `${pp.id}-quote-${i + 1}`
                              )
                            }
                            className="absolute top-0 right-0 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                          >
                            {copiedId === `${pp.id}-quote-${i + 1}`
                              ? 'Copied!'
                              : 'Copy'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredProofPoints.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No proof points match your filters
        </div>
      )}
    </div>
  );
}
