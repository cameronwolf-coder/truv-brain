import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, LineChart, Line, LabelList,
} from 'recharts';
import { useContactSales } from '../../services/marketingHubClient';
import type { ContactSalesContact } from '../../services/marketingHubClient';

// --- Helpers ---

function fmt(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// --- KPI Card ---

function KpiCard({ icon, label, value, sublabel, color }: {
  icon: string;
  label: string;
  value: number;
  sublabel: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
      <div className="text-xs text-gray-500 mb-1">
        <span className="mr-1">{icon}</span>{label}
      </div>
      <p className={`text-3xl font-bold ${color}`}>{fmt(value)}</p>
      <p className="text-[11px] text-gray-400 mt-1">{sublabel}</p>
    </div>
  );
}

// --- Hot Leads Table ---

function HotLeadsTable({ leads }: { leads: ContactSalesContact[] }) {
  if (leads.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
        <span>🔥</span> Hot Leads - Needs Immediate Action
      </h4>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-500">
              <th className="text-left px-3 py-2 font-medium">Email</th>
              <th className="text-left px-3 py-2 font-medium">Name</th>
              <th className="text-left px-3 py-2 font-medium">Submitted</th>
              <th className="text-left px-3 py-2 font-medium">HubSpot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.slice(0, 10).map((lead) => (
              <tr key={lead.email} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700">{lead.email}</td>
                <td className="px-3 py-2 text-gray-700">{lead.firstName} {lead.lastName}</td>
                <td className="px-3 py-2 text-gray-500">
                  {new Date(lead.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </td>
                <td className="px-3 py-2">
                  {lead.hubspotUrl ? (
                    <a href={lead.hubspotUrl} target="_blank" rel="noopener noreferrer" className="text-truv-blue hover:underline">
                      View
                    </a>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Full Contact List ---

function ContactList({ contacts }: { contacts: ContactSalesContact[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? contacts : contacts.slice(0, 8);

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">
        Contact Sales - Full Contact List
      </h4>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-500">
              <th className="text-left px-3 py-2 font-medium">Name</th>
              <th className="text-left px-3 py-2 font-medium">Email</th>
              <th className="text-left px-3 py-2 font-medium">Company</th>
              <th className="text-left px-3 py-2 font-medium">Owner</th>
              <th className="text-left px-3 py-2 font-medium">Stage</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map((c) => (
              <tr key={c.email} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                  {c.hubspotUrl ? (
                    <a href={c.hubspotUrl} target="_blank" rel="noopener noreferrer" className="text-truv-blue hover:underline">
                      {c.firstName} {c.lastName}
                    </a>
                  ) : (
                    `${c.firstName} ${c.lastName}`
                  )}
                </td>
                <td className="px-3 py-2 text-gray-500">{c.email}</td>
                <td className="px-3 py-2 text-gray-500">{c.company || '—'}</td>
                <td className="px-3 py-2 text-gray-500">{c.ownerName || '—'}</td>
                <td className="px-3 py-2">
                  <StageBadge stage={c.lifecycleStage} />
                </td>
                <td className="px-3 py-2 text-gray-500">{c.leadStatus || '—'}</td>
                <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                  {new Date(c.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {contacts.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-sm text-truv-blue hover:text-blue-700 font-medium"
        >
          {expanded ? 'Show less' : `Show all ${contacts.length} contacts`}
        </button>
      )}
      <p className="text-[10px] text-gray-400 mt-1">{contacts.length} rows</p>
    </div>
  );
}

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  lead: { bg: 'bg-blue-50', text: 'text-blue-700' },
  marketingqualifiedlead: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  salesqualifiedlead: { bg: 'bg-purple-50', text: 'text-purple-700' },
  opportunity: { bg: 'bg-amber-50', text: 'text-amber-700' },
  customer: { bg: 'bg-green-50', text: 'text-green-700' },
};

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  marketingqualifiedlead: 'MQL',
  salesqualifiedlead: 'SQL',
  opportunity: 'Opportunity',
  customer: 'Customer',
  subscriber: 'Subscriber',
};

function StageBadge({ stage }: { stage?: string }) {
  if (!stage) return <span className="text-gray-300">—</span>;
  const colors = STAGE_COLORS[stage] || { bg: 'bg-gray-50', text: 'text-gray-600' };
  const label = STAGE_LABELS[stage] || stage;
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${colors.bg} ${colors.text}`}>
      {label}
    </span>
  );
}

// --- Funnel Colors ---

const FUNNEL_COLORS = ['#2c64e3', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

// --- Date Range Selector ---

const DATE_RANGES = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

// --- Main Component ---

export function ContactSalesDashboard() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(7);
  const { data, isLoading, error } = useContactSales(days);

  const funnelData = useMemo(() => {
    if (!data) return [];
    return data.funnel.map((f, i) => ({
      ...f,
      fill: FUNNEL_COLORS[i] || '#6b7280',
    }));
  }, [data]);

  return (
    <div className="mb-6 border border-gray-200 rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div>
          <h2 className="text-base font-semibold text-gray-900 text-left">"Contact Sales" Analytics</h2>
          <p className="text-xs text-gray-500 mt-0.5 text-left">Form submissions, funnel, and lead tracking</p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {/* Date Range Filter */}
          <div className="flex items-center gap-2 pt-4 mb-4">
            <span className="text-xs text-gray-500">Date Range:</span>
            {DATE_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setDays(r.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  days === r.value
                    ? 'bg-truv-blue text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {isLoading && (
            <div className="py-12 text-center">
              <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-truv-blue rounded-full animate-spin" />
              <p className="text-xs text-gray-400 mt-2">Loading analytics...</p>
            </div>
          )}

          {error && (
            <div className="py-8 text-center text-sm text-red-600">
              Failed to load Contact Sales data.
            </div>
          )}

          {data && !isLoading && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-5 gap-3 mb-5">
                <KpiCard icon="📝" label="Contact Sales" value={data.kpis.contactSales} sublabel="Contact Sales (deduplicated)" color="text-gray-900" />
                <KpiCard icon="🤝" label="Sales Outreach" value={data.kpis.salesOutreach} sublabel="Sales Outreach Completed" color="text-gray-900" />
                <KpiCard icon="📅" label="Meetings Scheduled" value={data.kpis.meetingsScheduled} sublabel="Meetings Scheduled" color="text-gray-900" />
                <KpiCard icon="🔐" label="Login" value={data.kpis.login} sublabel="Login (deduplicated)" color="text-gray-900" />
                <KpiCard icon="❓" label="Verification Help" value={data.kpis.verificationHelp} sublabel="Verification Help (deduplicated)" color="text-gray-900" />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* 4-Week Trend */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Contact Sales Form Submissions - 4 Week Trend</h4>
                  {data.weeklyTrend.length > 0 ? (
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.weeklyTrend} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Line
                            type="monotone"
                            dataKey="count"
                            stroke="#2c64e3"
                            strokeWidth={2}
                            dot={{ r: 4, fill: '#2c64e3' }}
                            name="Submissions"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-8">No data for this period</p>
                  )}
                </div>

                {/* 5-Stage Funnel */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">5 Stage Conversion Funnel</h4>
                  {funnelData.length > 0 ? (
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="stage" width={140} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Contacts">
                            {funnelData.map((_, i) => (
                              <Cell key={i} fill={FUNNEL_COLORS[i] || '#6b7280'} />
                            ))}
                            <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: '#374151' }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-8">No funnel data</p>
                  )}
                </div>
              </div>

              {/* Bottom Row: Lead Stage Funnel + Qualified Leads by Rep */}
              <div className="grid grid-cols-2 gap-4 mb-2">
                {/* Lead Stage Funnel */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Lead Stage Funnel</h4>
                  {data.leadStageFunnel.length > 0 ? (
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.leadStageFunnel} margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                          <XAxis dataKey="stage" tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                            tickFormatter={(v: string) => STAGE_LABELS[v] || v} />
                          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                            labelFormatter={(v) => STAGE_LABELS[String(v)] || String(v)} />
                          <Bar dataKey="count" fill="#2c64e3" radius={[4, 4, 0, 0]} name="Contacts" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-8">No stage data</p>
                  )}
                </div>

                {/* Qualified Leads by Rep */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Qualified Leads by Rep</h4>
                  {data.byRep.length > 0 ? (
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.byRep} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} name="Leads">
                            <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: '#374151' }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-8">No rep data</p>
                  )}
                </div>
              </div>

              {/* Hot Leads */}
              <HotLeadsTable leads={data.hotLeads} />

              {/* Full Contact List */}
              <ContactList contacts={data.contacts} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
