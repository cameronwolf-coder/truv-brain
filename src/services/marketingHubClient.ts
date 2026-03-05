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
  const { data, error, isLoading } = useSWR<CalendarResponse>(
    `/api/marketing-hub/linear-calendar?months=${months}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  const events = data ? [...data.projects, ...data.issues] : [];

  return { events, projects: data?.projects || [], issues: data?.issues || [], error, isLoading };
}

export function useActivityFeed(days = 30) {
  const { data, error, isLoading } = useSWR<ActivityFeedItem[]>(
    `/api/marketing-hub/activity-feed?days=${days}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  return { items: data || [], error, isLoading };
}
