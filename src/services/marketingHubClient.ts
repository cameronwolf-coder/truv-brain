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

export function useActivityFeed(days = 30) {
  const { data, error, isLoading } = useSWR<ActivityFeedItem[]>(
    `/api/marketing-hub/activity-feed?days=${days}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  return { items: data || [], error, isLoading };
}
