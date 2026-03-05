import { useMemo } from 'react';
import type { CalendarEvent, ActivityFeedItem } from '../../types/marketingHub';
import { UpcomingFeedCard } from './UpcomingFeedCard';

interface UpcomingFeedProps {
  events: CalendarEvent[];
  recentActivity: ActivityFeedItem[];
  isLoading: boolean;
  onEventClick: (event: CalendarEvent) => void;
}

// --- Date helpers (no external dependency) ---

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function parseDate(s: string): Date {
  // Linear dates are "YYYY-MM-DD" — treat as local
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function nextSunday(d: Date): Date {
  const day = d.getDay();
  return addDays(d, day === 0 ? 0 : 7 - day);
}

function friendlyDate(dateStr: string, today: Date): string {
  const date = parseDate(dateStr);
  const todayStart = startOfDay(today);
  const diff = Math.round((date.getTime() - todayStart.getTime()) / 86400000);

  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff < -1 && diff >= -2) return '2 days ago';

  // Within 6 days: weekday name
  if (diff > 1 && diff <= 6) return date.toLocaleDateString('en-US', { weekday: 'long' });

  // Beyond: "March 18"
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

// --- Status helpers ---

const COMPLETED_STATUSES = new Set(['done', 'completed', 'canceled', 'cancelled']);

function isCompleted(status: string): boolean {
  return COMPLETED_STATUSES.has(status.toLowerCase());
}

// --- Bucket type ---

interface FeedBucket {
  label: string;
  items: { event: CalendarEvent; isCompleted: boolean; friendlyDate: string }[];
}

export function UpcomingFeed({ events, recentActivity, isLoading, onEventClick }: UpcomingFeedProps) {
  const buckets = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);
    const dayAfterTomorrow = addDays(today, 2);
    const endOfWeek = nextSunday(today);
    const startOfNextWeek = addDays(endOfWeek, 1);
    const endOfNextWeek = addDays(endOfWeek, 7);
    const cutoff = addDays(today, 21);
    const twoDaysAgo = addDays(today, -2);

    // Build a set of event IDs for dedup
    const eventIds = new Set(events.map((e) => e.id));

    // --- Just Shipped: completed events from last 48h ---
    const justShipped: FeedBucket['items'] = [];

    // From calendar events that are completed with recent dates
    events.forEach((e) => {
      if (!isCompleted(e.status)) return;
      const d = parseDate(e.start);
      if (d >= twoDaysAgo && d <= today) {
        justShipped.push({ event: e, isCompleted: true, friendlyDate: friendlyDate(e.start, today) });
      }
    });

    // From activity feed (completed issues not already in events)
    recentActivity.forEach((item) => {
      if (eventIds.has(item.id)) return;
      const ts = new Date(item.timestamp);
      if (ts < twoDaysAgo) return;
      // Convert ActivityFeedItem to a minimal CalendarEvent shape
      justShipped.push({
        event: {
          id: item.id,
          title: item.title,
          start: ts.toISOString().split('T')[0],
          type: 'issue',
          status: 'Done',
          statusColor: '#10b981',
          category: item.type === 'event' ? 'Event' : item.type === 'campaign' ? 'Growth' : item.type === 'content' ? 'PMM' : 'Ops',
          labels: [],
          url: item.url || '',
        },
        isCompleted: true,
        friendlyDate: friendlyDate(ts.toISOString().split('T')[0], today),
      });
    });

    // --- Upcoming buckets: non-completed events ---
    const todayItems: FeedBucket['items'] = [];
    const tomorrowItems: FeedBucket['items'] = [];
    const thisWeekItems: FeedBucket['items'] = [];
    const nextWeekItems: FeedBucket['items'] = [];
    const comingUpItems: FeedBucket['items'] = [];

    events.forEach((e) => {
      if (isCompleted(e.status)) return;
      const d = parseDate(e.start);
      if (d < today || d > cutoff) return;

      const item = { event: e, isCompleted: false, friendlyDate: friendlyDate(e.start, today) };

      if (d.getTime() === today.getTime()) {
        todayItems.push(item);
      } else if (d.getTime() === tomorrow.getTime()) {
        tomorrowItems.push(item);
      } else if (d >= dayAfterTomorrow && d <= endOfWeek) {
        thisWeekItems.push(item);
      } else if (d >= startOfNextWeek && d <= endOfNextWeek) {
        nextWeekItems.push(item);
      } else if (d > endOfNextWeek) {
        comingUpItems.push(item);
      }
    });

    // Sort each bucket by date ascending
    const byDate = (a: FeedBucket['items'][0], b: FeedBucket['items'][0]) =>
      a.event.start.localeCompare(b.event.start);
    justShipped.sort(byDate);
    todayItems.sort(byDate);
    tomorrowItems.sort(byDate);
    thisWeekItems.sort(byDate);
    nextWeekItems.sort(byDate);
    comingUpItems.sort(byDate);

    const result: FeedBucket[] = [];
    if (justShipped.length > 0) result.push({ label: 'Just Shipped', items: justShipped });
    if (todayItems.length > 0) result.push({ label: 'Today', items: todayItems });
    if (tomorrowItems.length > 0) result.push({ label: 'Tomorrow', items: tomorrowItems });
    if (thisWeekItems.length > 0) result.push({ label: 'This Week', items: thisWeekItems });
    if (nextWeekItems.length > 0) result.push({ label: 'Next Week', items: nextWeekItems });
    if (comingUpItems.length > 0) result.push({ label: 'Coming Up', items: comingUpItems });

    return result;
  }, [events, recentActivity]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-4 border-b border-gray-100 animate-pulse">
            <div className="w-6 h-6 bg-gray-200 rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (buckets.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500 text-sm">
        Nothing on the radar right now
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {buckets.map((bucket) => (
        <div key={bucket.label}>
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {bucket.label}
            </span>
          </div>
          {bucket.items.map((item) => (
            <UpcomingFeedCard
              key={item.event.id}
              event={item.event}
              isCompleted={item.isCompleted}
              friendlyDate={item.friendlyDate}
              onClick={onEventClick}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
