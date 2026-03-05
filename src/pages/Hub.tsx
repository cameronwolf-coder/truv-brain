import { useState, useMemo, lazy, Suspense, startTransition } from 'react';
import { useCalendarEvents, useActivityFeed, useTruvEvents } from '../services/marketingHubClient';
import type { TruvEvent } from '../services/marketingHubClient';
import { CalendarToolbar } from '../components/marketing-hub/CalendarToolbar';
import { ProjectProgress } from '../components/marketing-hub/ProjectProgress';
import { UpcomingFeed } from '../components/marketing-hub/UpcomingFeed';
import type { CalendarEvent, CalendarViewType, MarketingHubFilters } from '../types/marketingHub';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyRetry(loader: () => Promise<any>, pick: string) {
  return lazy(() =>
    loader()
      .then((m: Record<string, unknown>) => ({ default: m[pick] as React.ComponentType<any> }))
      .catch(() => {
        const key = 'chunk-reload';
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          window.location.reload();
        }
        return { default: (() => null) as React.ComponentType<any> };
      }),
  );
}

const MonthView = lazyRetry(() => import('../components/marketing-hub/MonthView'), 'MonthView');
const WeekView = lazyRetry(() => import('../components/marketing-hub/WeekView'), 'WeekView');
const TimelineView = lazyRetry(() => import('../components/marketing-hub/TimelineView'), 'TimelineView');

const emptyFilters: MarketingHubFilters = { category: null, project: null, label: null, assignee: null, status: null };

const COMPLETED = new Set(['done', 'completed', 'canceled', 'cancelled']);

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

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

// --- Quick Stats ---

function QuickStats({ events, projects }: { events: CalendarEvent[]; projects: CalendarEvent[] }) {
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    let doneThisWeek = 0;
    let upcomingEvents = 0;
    let overdue = 0;

    events.forEach((e) => {
      const d = parseDate(e.start);
      const isDone = COMPLETED.has(e.status.toLowerCase());

      if (e.type === 'issue' && isDone && d >= weekStart && d <= weekEnd) {
        doneThisWeek++;
      }
      if (e.category === 'Event' && d >= today && !isDone) {
        upcomingEvents++;
      }
      if (e.type === 'issue' && !isDone && d < today) {
        overdue++;
      }
    });

    return {
      activeProjects: projects.length,
      doneThisWeek,
      upcomingEvents,
      overdue,
    };
  }, [events, projects]);

  const cards = [
    { label: 'Active Projects', value: stats.activeProjects, color: 'text-truv-blue', bg: 'bg-blue-50' },
    { label: 'Done This Week', value: stats.doneThisWeek, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Upcoming Events', value: stats.upcomingEvents, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Overdue', value: stats.overdue, color: stats.overdue > 0 ? 'text-red-600' : 'text-gray-400', bg: stats.overdue > 0 ? 'bg-red-50' : 'bg-gray-50' },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className={`${c.bg} rounded-xl p-4 border border-gray-100`}>
          <p className={`text-2xl font-semibold ${c.color}`}>{c.value}</p>
          <p className="text-xs text-gray-500 mt-1">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

// --- Upcoming Events at Truv ---

function TruvEventsBar({ events, isLoading }: { events: TruvEvent[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-48 mb-3" />
        <div className="flex gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg flex-1" />
          ))}
        </div>
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div className="mb-6 bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Upcoming Webinars</h2>
        <a
          href="https://truv.com/events"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-truv-blue hover:text-blue-700 transition-colors flex items-center gap-1"
        >
          View all events
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {events.map((evt) => (
          <a
            key={evt.url}
            href={evt.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col gap-1.5 p-3.5 rounded-lg border border-gray-100 hover:border-truv-blue/30 hover:bg-blue-50/40 transition-colors"
          >
            <span className="text-sm font-medium text-gray-900 group-hover:text-truv-blue transition-colors leading-snug line-clamp-2">
              {evt.title}
            </span>
            {evt.date && (
              <span className="text-xs text-gray-500">{evt.date}</span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

// --- Legend ---

const legendItems = [
  { label: 'Event', color: '#d97706' },
  { label: 'Growth', color: '#2c64e3' },
  { label: 'PMM', color: '#10b981' },
  { label: 'Ops', color: '#6b7280' },
];

function Legend() {
  return (
    <div className="flex items-center gap-5 mb-4 px-1">
      {legendItems.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-xs text-gray-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// --- Main Hub Page ---

export function Hub() {
  const [viewType, setViewType] = useState<CalendarViewType>('month');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [filters, setFilters] = useState<MarketingHubFilters>(emptyFilters);

  const { events, projects: projectEvents, isLoading: calLoading, error: calError } = useCalendarEvents();
  const { items: feedItems, isLoading: feedLoading } = useActivityFeed();
  const { events: truvEvents, isLoading: truvEventsLoading } = useTruvEvents();

  const filterOptions = useMemo(() => {
    const categories = new Set<string>();
    const projects = new Set<string>();
    const labels = new Set<string>();
    const assignees = new Set<string>();
    const statuses = new Set<string>();

    // Include all active project names so the dropdown is complete
    projectEvents.forEach((p) => projects.add(p.title));

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
  }, [events, projectEvents]);

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

  function handleEventClick(event: CalendarEvent) {
    window.open(event.url, '_blank', 'noopener,noreferrer');
  }

  // No-op for drag-drop (read-only page)
  const noop = () => {};

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <img src="/logos/logomark.svg" alt="" className="w-7 h-7" />
            <h1 className="text-2xl font-semibold text-gray-900">Marketing Hub</h1>
          </div>
          <p className="text-sm text-gray-500">
            What's happening across marketing — upcoming projects, tasks, and milestones.
          </p>
        </div>

        {calError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Failed to load calendar data.
          </div>
        )}

        {/* Quick Stats */}
        {!calLoading && <QuickStats events={events} projects={projectEvents} />}

        {/* Upcoming Events at Truv */}
        <TruvEventsBar events={truvEvents} isLoading={truvEventsLoading} />

        {/* Toolbar */}
        <CalendarToolbar
          view={viewType}
          onViewChange={handleViewChange}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          filters={filters}
          onFiltersChange={setFilters}
          filterOptions={filterOptions}
        />

        {/* Legend */}
        <Legend />

        {/* Calendar */}
        {calLoading ? (
          <CalendarSkeleton />
        ) : (
          <Suspense fallback={<CalendarSkeleton />}>
            {viewType === 'month' && (
              <MonthView events={filteredEvents} currentDate={currentDate} onEventClick={handleEventClick} onEventDrop={noop} />
            )}
            {viewType === 'week' && (
              <WeekView events={filteredEvents} currentDate={currentDate} onEventClick={handleEventClick} onEventDrop={noop} />
            )}
            {viewType === 'timeline' && (
              <TimelineView events={filteredEvents} currentDate={currentDate} onEventClick={handleEventClick} />
            )}
          </Suspense>
        )}

        {/* Upcoming Events */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">What's Happening</h2>
          <UpcomingFeed
            events={events}
            recentActivity={feedItems}
            isLoading={calLoading && feedLoading}
            onEventClick={handleEventClick}
          />
        </div>

        {/* Project Progress */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Progress</h2>
          <ProjectProgress
            projects={projectEvents}
            isLoading={calLoading}
            onProjectClick={handleEventClick}
          />
        </div>
      </div>
    </div>
  );
}
