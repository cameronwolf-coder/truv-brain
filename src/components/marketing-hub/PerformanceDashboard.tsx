import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts';
import {
  useEmailPerformance, useAdSpend, usePipelineData, useLeadFlow,
} from '../../services/marketingHubClient';
import type { EmailCampaign } from '../../services/marketingHubClient';

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-32 mb-3" />
      <div className="h-8 bg-gray-100 rounded w-24 mb-4" />
      <div className="h-24 bg-gray-50 rounded" />
    </div>
  );
}

// --- Email Performance Card ---

function EmailCard({ campaigns, isLoading }: { campaigns: EmailCampaign[]; isLoading: boolean }) {
  const stats = useMemo(() => {
    if (campaigns.length === 0) return null;

    // Only campaigns from last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = campaigns.filter(c => c.last_event * 1000 > thirtyDaysAgo);

    const totalSends = recent.reduce((sum, c) => sum + c.metrics.delivered, 0);
    const totalOpens = recent.reduce((sum, c) => sum + c.metrics.unique_opens, 0);
    const totalClicks = recent.reduce((sum, c) => sum + c.metrics.unique_clicks, 0);
    const avgOpenRate = totalSends > 0 ? totalOpens / totalSends : 0;
    const avgClickRate = totalSends > 0 ? totalClicks / totalSends : 0;

    // Group by week for sparkline
    const weekMap = new Map<string, number>();
    for (const c of recent) {
      const d = new Date(c.last_event * 1000);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      weekMap.set(key, (weekMap.get(key) || 0) + c.metrics.delivered);
    }

    const byWeek = Array.from(weekMap.entries()).map(([week, sends]) => ({ week, sends }));

    return { totalSends, avgOpenRate, avgClickRate, byWeek, campaignCount: recent.length };
  }, [campaigns]);

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-700">Email Performance</h3>
        <span className="text-[10px] text-gray-400 ml-auto">Last 30 days</span>
      </div>

      {!stats || stats.totalSends === 0 ? (
        <p className="text-xs text-gray-400 mt-3">No email campaigns in the last 30 days</p>
      ) : (
        <>
          <p className="text-2xl font-semibold text-gray-900 mb-1">{fmt(stats.totalSends)} <span className="text-sm font-normal text-gray-500">sends</span></p>
          <div className="flex gap-4 mb-3">
            <div>
              <p className="text-xs text-gray-500">Open rate</p>
              <p className="text-sm font-semibold text-emerald-600">{pct(stats.avgOpenRate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Click rate</p>
              <p className="text-sm font-semibold text-blue-600">{pct(stats.avgClickRate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Campaigns</p>
              <p className="text-sm font-semibold text-gray-700">{stats.campaignCount}</p>
            </div>
          </div>

          {stats.byWeek.length > 1 && (
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byWeek} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Bar dataKey="sends" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- Ad Spend Card ---

const PLATFORM_COLORS: Record<string, string> = {
  LinkedIn: '#0a66c2',
  Google: '#4285f4',
  Meta: '#1877f2',
};

function AdSpendCard() {
  const { data, isLoading } = useAdSpend();

  if (isLoading) return <CardSkeleton />;

  const hasData = data && data.byPlatform.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-700">Paid Ads</h3>
        <span className="text-[10px] text-gray-400 ml-auto">MTD</span>
      </div>

      {!hasData ? (
        <p className="text-xs text-gray-400 mt-3">No ad data available</p>
      ) : (
        <>
          <p className="text-2xl font-semibold text-gray-900 mb-1">{fmtDollars(data.totalSpend)} <span className="text-sm font-normal text-gray-500">spend</span></p>
          <div className="flex gap-4 mb-3">
            <div>
              <p className="text-xs text-gray-500">Clicks</p>
              <p className="text-sm font-semibold text-gray-700">{fmt(data.totalClicks)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">CTR</p>
              <p className="text-sm font-semibold text-emerald-600">{pct(data.avgCTR)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">CPC</p>
              <p className="text-sm font-semibold text-gray-700">${data.avgCPC.toFixed(2)}</p>
            </div>
          </div>

          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byPlatform} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => fmtDollars(Number(value))}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="spend" radius={[0, 4, 4, 0]}>
                  {data.byPlatform.map((entry: { name: string; spend: number }) => (
                    <Cell key={entry.name} fill={PLATFORM_COLORS[entry.name] || '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// --- Pipeline Card ---

const STAGE_COLORS = ['#2c64e3', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#6b7280'];

function PipelineCard() {
  const { data, isLoading } = usePipelineData();

  if (isLoading) return <CardSkeleton />;

  const hasData = data && data.stages.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-700">Pipeline</h3>
      </div>

      {!hasData ? (
        <p className="text-xs text-gray-400 mt-3">No pipeline data available</p>
      ) : (
        <>
          <p className="text-2xl font-semibold text-gray-900 mb-1">{fmtDollars(data.totalValue)}</p>
          <div className="flex gap-4 mb-3">
            <div>
              <p className="text-xs text-gray-500">Deals</p>
              <p className="text-sm font-semibold text-gray-700">{data.totalDeals}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Avg age</p>
              <p className="text-sm font-semibold text-gray-700">{data.avgDealAge}d</p>
            </div>
          </div>

          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.stages} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => fmtDollars(Number(value))}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {data.stages.map((_: unknown, i: number) => (
                    <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// --- Lead Flow Card ---

function LeadFlowCard() {
  const { data, isLoading } = useLeadFlow();

  if (isLoading) return <CardSkeleton />;

  const hasData = data && data.total > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-700">Lead Flow</h3>
        <span className="text-[10px] text-gray-400 ml-auto">Last 30 days</span>
      </div>

      {!hasData ? (
        <p className="text-xs text-gray-400 mt-3">No new leads in the last 30 days</p>
      ) : (
        <>
          <p className="text-2xl font-semibold text-gray-900 mb-1">{fmt(data.total)} <span className="text-sm font-normal text-gray-500">new contacts</span></p>
          <div className="flex gap-3 mb-3">
            <div>
              <p className="text-xs text-gray-500">Leads</p>
              <p className="text-sm font-semibold text-blue-600">{data.byStage.lead}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">MQLs</p>
              <p className="text-sm font-semibold text-emerald-600">{data.byStage.mql}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">SQLs</p>
              <p className="text-sm font-semibold text-purple-600">{data.byStage.sql}</p>
            </div>
          </div>

          {data.byWeek.length > 0 && (
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byWeek} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="week" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="total" fill="#8b5cf6" radius={[2, 2, 0, 0]} name="New contacts" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- Main Dashboard ---

export function PerformanceDashboard() {
  const [open, setOpen] = useState(true);
  const { campaigns, isLoading: emailLoading } = useEmailPerformance();

  return (
    <div className="mb-6 border border-gray-200 rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div>
          <h2 className="text-base font-semibold text-gray-900 text-left">Performance Dashboard</h2>
          <p className="text-xs text-gray-500 mt-0.5 text-left">Email, ads, pipeline, and lead flow</p>
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
          <div className="pt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <EmailCard campaigns={campaigns} isLoading={emailLoading} />
            <AdSpendCard />
            <PipelineCard />
            <LeadFlowCard />
          </div>
        </div>
      )}
    </div>
  );
}
