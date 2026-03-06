import useSWR from 'swr';
import type { CalendarEvent, ActivityFeedItem } from '../types/marketingHub';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
});

interface CalendarResponse {
  projects: CalendarEvent[];
  issues: CalendarEvent[];
}

export function useCalendarEvents(months = 3) {
  const { data, error, isLoading, mutate } = useSWR<CalendarResponse>(
    `/api/marketing-hub/linear-calendar?months=${months}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  const events = data ? [...data.projects, ...data.issues] : [];

  return { events, projects: data?.projects || [], issues: data?.issues || [], error, isLoading, mutate };
}

export async function updateEvent(
  id: string,
  type: 'project' | 'issue',
  updates: Record<string, string | undefined>,
): Promise<{ success: boolean }> {
  const res = await fetch('/api/marketing-hub/update-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, type, updates }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function createIssue(
  title: string,
  dueDate?: string,
  projectId?: string,
): Promise<{ success: boolean }> {
  const res = await fetch('/api/marketing-hub/create-issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, dueDate, projectId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface TruvEvent {
  title: string;
  date: string;
  type: 'event' | 'webinar';
  url: string;
}

export function useTruvEvents() {
  const { data, error, isLoading } = useSWR<{ events: TruvEvent[] }>(
    '/api/marketing-hub/truv-events',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 },
  );

  return { events: data?.events || [], error, isLoading };
}

// --- Analytics hooks ---

export interface EmailCampaign {
  workflow_key: string;
  name: string;
  template_id: string;
  first_event: number;
  last_event: number;
  metrics: {
    processed: number;
    delivered: number;
    opens: number;
    unique_opens: number;
    clicks: number;
    unique_clicks: number;
    bounces: number;
    open_rate: number;
    click_rate: number;
    bounce_rate: number;
    click_to_open: number;
  };
}

export function useEmailPerformance() {
  const { data, error, isLoading } = useSWR<EmailCampaign[]>(
    '/api/email-performance',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 },
  );

  return { campaigns: data || [], error, isLoading };
}

export interface AdSpendData {
  totalSpend: number;
  totalClicks: number;
  totalImpressions: number;
  avgCTR: number;
  avgCPC: number;
  byPlatform: Array<{
    name: string;
    spend: number;
    clicks: number;
    impressions: number;
    ctr: number;
    cpc: number;
  }>;
  period: { start: string; end: string };
}

export function useAdSpend() {
  const { data, error, isLoading } = useSWR<AdSpendData>(
    '/api/analytics/ad-spend',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 },
  );

  return { data: data || null, error, isLoading };
}

export interface PipelineData {
  stages: Array<{ name: string; count: number; value: number }>;
  totalValue: number;
  totalDeals: number;
  avgDealAge: number;
}

export function usePipelineData() {
  const { data, error, isLoading } = useSWR<PipelineData>(
    '/api/analytics/pipeline',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 },
  );

  return { data: data || null, error, isLoading };
}

export interface LeadFlowData {
  total: number;
  byStage: { subscriber: number; lead: number; mql: number; sql: number; other: number };
  byWeek: Array<{
    week: string;
    total: number;
    subscriber: number;
    lead: number;
    marketingqualifiedlead: number;
    salesqualifiedlead: number;
    other: number;
  }>;
  period: { start: string; end: string };
}

export function useLeadFlow() {
  const { data, error, isLoading } = useSWR<LeadFlowData>(
    '/api/analytics/lead-flow',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 },
  );

  return { data: data || null, error, isLoading };
}

export interface ContactSalesContact {
  email: string;
  firstName: string;
  lastName: string;
  intent: string;
  submittedAt: string;
  company?: string;
  jobTitle?: string;
  lifecycleStage?: string;
  leadStatus?: string;
  ownerName?: string;
  hubspotUrl?: string;
  hasOwner: boolean;
}

export interface ContactSalesData {
  kpis: {
    contactSales: number;
    salesOutreach: number;
    meetingsScheduled: number;
    login: number;
    verificationHelp: number;
  };
  funnel: Array<{ stage: string; count: number }>;
  weeklyTrend: Array<{ week: string; count: number }>;
  leadStageFunnel: Array<{ stage: string; count: number }>;
  byRep: Array<{ name: string; count: number }>;
  hotLeads: ContactSalesContact[];
  contacts: ContactSalesContact[];
  intentBreakdown: Record<string, number>;
  dateRange: { start: string; end: string; days: number };
}

export function useContactSales(days = 7) {
  const { data, error, isLoading } = useSWR<ContactSalesData>(
    `/api/analytics/contact-sales?days=${days}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 },
  );

  return { data: data || null, error, isLoading };
}

export function useActivityFeed(days = 30) {
  const { data, error, isLoading } = useSWR<ActivityFeedItem[]>(
    `/api/marketing-hub/activity-feed?days=${days}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  return { items: data || [], error, isLoading };
}
