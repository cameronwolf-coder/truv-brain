import { useState, useMemo, lazy, Suspense, startTransition } from 'react';
import { useCalendarEvents, useActivityFeed, updateEvent } from '../services/marketingHubClient';
import { CalendarToolbar } from '../components/marketing-hub/CalendarToolbar';
import { ActivityFeed } from '../components/marketing-hub/ActivityFeed';
import { EventEditModal } from '../components/marketing-hub/EventEditModal';
import type { CalendarEvent, CalendarViewType, MarketingHubFilters } from '../types/marketingHub';

function lazyRetry<T extends Record<string, unknown>>(
  loader: () => Promise<T>,
  pick: keyof T,
) {
  return lazy(() =>
    loader()
      .then((m) => ({ default: m[pick] as React.ComponentType<never> }))
      .catch(() => {
        // Stale chunk after deployment — reload once to get fresh HTML
        const key = 'chunk-reload';
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          window.location.reload();
        }
        return { default: (() => null) as unknown as React.ComponentType<never> };
      }),
  );
}

const MonthView = lazyRetry(() => import('../components/marketing-hub/MonthView'), 'MonthView');
const WeekView = lazyRetry(() => import('../components/marketing-hub/WeekView'), 'WeekView');
const TimelineView = lazyRetry(() => import('../components/marketing-hub/TimelineView'), 'TimelineView');

const emptyFilters: MarketingHubFilters = { category: null, project: null, label: null, assignee: null, status: null };

function CalendarSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
      <div className="grid grid-cols-7 gap-1">
        {[...Array(35)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}

export function MarketingHub() {
  const [viewType, setViewType] = useState<CalendarViewType>('month');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [filters, setFilters] = useState<MarketingHubFilters>(emptyFilters);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);

  const { events, isLoading: calLoading, error: calError, mutate } = useCalendarEvents();
  const { items: feedItems, isLoading: feedLoading, error: feedError } = useActivityFeed();

  async function handleEventSave(updates: Record<string, string | undefined>) {
    if (!selectedEvent) return;
    setSaving(true);
    try {
      await updateEvent(selectedEvent.id, selectedEvent.type, updates);
      await mutate();
      setSelectedEvent(null);
    } catch (err) {
      console.error('Failed to save event:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleEventDrop(eventId: string, type: 'project' | 'issue', newStart: string, newEnd?: string) {
    const updates: Record<string, string | undefined> = {};
    if (type === 'project') {
      updates.startDate = newStart;
      if (newEnd) updates.targetDate = newEnd;
    } else {
      updates.dueDate = newStart;
    }
    try {
      await updateEvent(eventId, type, updates);
      await mutate();
    } catch (err) {
      console.error('Failed to update event date:', err);
      await mutate(); // revert optimistic
    }
  }

  // Derive filter options from events
  const filterOptions = useMemo(() => {
    const categories = new Set<string>();
    const projects = new Set<string>();
    const labels = new Set<string>();
    const assignees = new Set<string>();
    const statuses = new Set<string>();

    events.forEach((e) => {
      categories.add(e.category);
      if (e.project) projects.add(e.project);
      if (e.assignee) assignees.add(e.assignee);
      statuses.add(e.status);
      e.labels.forEach((l) => labels.add(l.name));
    });

    return {
      categories: Array.from(categories).sort(),
      projects: Array.from(projects).sort(),
      labels: Array.from(labels).sort(),
      assignees: Array.from(assignees).sort(),
      statuses: Array.from(statuses).sort(),
    };
  }, [events]);

  // Derive filtered events during render
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filters.category && e.category !== filters.category) return false;
      if (filters.project && e.project !== filters.project && e.title !== filters.project) return false;
      if (filters.label && !e.labels.some((l) => l.name === filters.label)) return false;
      if (filters.assignee && e.assignee !== filters.assignee) return false;
      if (filters.status && e.status !== filters.status) return false;
      return true;
    });
  }, [events, filters]);

  function handleViewChange(view: CalendarViewType) {
    startTransition(() => setViewType(view));
  }

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Marketing Hub</h1>
        <p className="text-sm text-gray-500 mt-1">
          What's happening across marketing — upcoming projects, tasks, and recent activity.
        </p>
      </div>

      {calError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Failed to load calendar data. Check that LINEAR_API_KEY is configured.
        </div>
      )}

      <CalendarToolbar
        view={viewType}
        onViewChange={handleViewChange}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        filters={filters}
        onFiltersChange={setFilters}
        filterOptions={filterOptions}
      />

      {calLoading ? (
        <CalendarSkeleton />
      ) : (
        <Suspense fallback={<CalendarSkeleton />}>
          {viewType === 'month' && (
            <MonthView events={filteredEvents} currentDate={currentDate} onEventClick={setSelectedEvent} onEventDrop={handleEventDrop} />
          )}
          {viewType === 'week' && (
            <WeekView events={filteredEvents} currentDate={currentDate} onEventClick={setSelectedEvent} onEventDrop={handleEventDrop} />
          )}
          {viewType === 'timeline' && (
            <TimelineView events={filteredEvents} currentDate={currentDate} onEventClick={setSelectedEvent} />
          )}
        </Suspense>
      )}

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <span className="text-xs text-gray-400">Last 30 days</span>
        </div>
        {feedError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Failed to load activity feed.
          </div>
        )}
        <ActivityFeed items={feedItems} isLoading={feedLoading} />
      </div>

      {selectedEvent && (
        <EventEditModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSave={handleEventSave}
          saving={saving}
        />
      )}
    </div>
  );
}
