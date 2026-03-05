import { useState, useMemo, lazy, Suspense, startTransition } from 'react';
import { useCalendarEvents, useTruvEvents, updateEvent } from '../services/marketingHubClient';
import type { TruvEvent } from '../services/marketingHubClient';
import { CalendarToolbar } from '../components/marketing-hub/CalendarToolbar';
import { EventEditModal } from '../components/marketing-hub/EventEditModal';
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

// --- Upcoming Webinars ---

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

// --- Category colors ---

const CATEGORY_COLORS: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  Event: { dot: '#ca8a04', bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-l-yellow-500' },
  Growth: { dot: '#2c64e3', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-l-truv-blue' },
  PMM: { dot: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-l-emerald-500' },
  Ops: { dot: '#6b7280', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-l-gray-400' },
  Other: { dot: '#6b7280', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-l-gray-400' },
};

// --- Key Dates ---

function isKeyDate(e: CalendarEvent): boolean {
  // Email send tasks — the actual "Send" step in each project
  if (e.type === 'issue' && /\bSend\b/i.test(e.title)) return true;
  // Webinar/conference project-level dates (not individual tasks inside them)
  if (e.type === 'project' && e.category === 'Event') return true;
  return false;
}

function friendlyDateStr(dateStr: string): string {
  const d = parseDate(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';

  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getKeyDateLabel(e: CalendarEvent): string {
  if (e.type === 'issue') return 'Email Send';
  if (/webinar/i.test(e.title)) return 'Webinar';
  return 'Conference';
}

function getKeyDateTitle(e: CalendarEvent): string {
  if (e.type === 'issue') {
    // Show the actual task title — it's more specific than the project name
    return e.title.replace(/\[MKTG-\w+\]\s*/i, '');
  }
  // For projects, strip the [MKTG-EVENT] prefix
  return e.title.replace(/\[MKTG-\w+\]\s*/i, '');
}

function getKeyDateDate(e: CalendarEvent): string {
  // For projects, use the target date (when the event actually happens) if available
  if (e.type === 'project' && e.end) return e.end;
  return e.start;
}

function KeyDates({
  events,
  isLoading,
  onEventClick,
}: {
  events: CalendarEvent[];
  isLoading: boolean;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const keyDates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + 60);

    return events
      .filter((e) => {
        if (!isKeyDate(e)) return false;
        if (COMPLETED.has(e.status.toLowerCase())) return false;
        const d = parseDate(getKeyDateDate(e));
        return d >= today && d <= cutoff;
      })
      .sort((a, b) => getKeyDateDate(a).localeCompare(getKeyDateDate(b)));
  }, [events]);

  if (isLoading) {
    return (
      <div className="mb-6 bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-40 mb-4" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100">
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="h-4 bg-gray-100 rounded flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (keyDates.length === 0) {
    return (
      <div className="mb-6 bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">No upcoming key dates</p>
      </div>
    );
  }

  return (
    <div className="mb-6 bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Key Marketing Dates</h2>
        <p className="text-xs text-gray-500 mt-0.5">Webinar dates and email sends</p>
      </div>
      <div className="divide-y divide-gray-100">
        {keyDates.map((e) => {
          const colors = CATEGORY_COLORS[e.category] || CATEGORY_COLORS.Other;
          const label = getKeyDateLabel(e);
          const displayTitle = getKeyDateTitle(e);
          const dateStr = getKeyDateDate(e);
          const isPast = parseDate(dateStr) <= new Date();

          return (
            <button
              key={e.id}
              onClick={() => onEventClick(e)}
              className={`w-full text-left px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors border-l-4 ${colors.border}`}
            >
              {/* Date */}
              <div className="w-24 shrink-0">
                <span className={`text-sm font-semibold ${isPast ? 'text-gray-400' : 'text-gray-900'}`}>
                  {friendlyDateStr(dateStr)}
                </span>
              </div>

              {/* Label badge */}
              <span className={`shrink-0 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                {label}
              </span>

              {/* Title */}
              <span className="text-sm text-gray-800 truncate flex-1">
                {displayTitle}
              </span>

              {/* Assignee */}
              {e.assignee && (
                <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{e.assignee}</span>
              )}

              {/* Arrow */}
              <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Legend ---

const legendItems = [
  { label: 'Event / Live', color: '#ca8a04' },
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

// --- Compact Project Progress Rings ---

const RING_COLORS: Record<string, string> = {
  Event: '#ca8a04',
  Growth: '#2c64e3',
  PMM: '#10b981',
  Ops: '#6b7280',
  Other: '#6b7280',
};

function ProgressRing({ pct, color, size = 40 }: { pct: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function cleanProjectName(title: string): string {
  return title.replace(/\[MKTG-\w+\]\s*/i, '');
}

const COLLAPSED_COUNT = 6;

function ProjectRings({
  projects,
  isLoading,
  onProjectClick,
}: {
  projects: CalendarEvent[];
  isLoading: boolean;
  onProjectClick: (p: CalendarEvent) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="mb-6 bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-40 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (projects.length === 0) return null;

  const visible = expanded ? projects : projects.slice(0, COLLAPSED_COUNT);
  const hasMore = projects.length > COLLAPSED_COUNT;

  return (
    <div className="mb-6 bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Project Progress</h2>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {visible.map((p) => {
          const total = p.totalIssues || 0;
          const completed = p.completedIssues || 0;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
          const color = RING_COLORS[p.category] || RING_COLORS.Other;

          return (
            <button
              key={p.id}
              onClick={() => onProjectClick(p)}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <div className="relative">
                <ProgressRing pct={pct} color={color} />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-gray-700">
                  {pct}%
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{cleanProjectName(p.title)}</p>
                <p className="text-xs text-gray-400">{completed}/{total} tasks</p>
              </div>
            </button>
          );
        })}
      </div>
      {hasMore && (
        <div className="px-5 pb-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-truv-blue hover:text-blue-700 font-medium transition-colors"
          >
            {expanded ? 'Show less' : `Show all ${projects.length} projects`}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Main Hub Page ---

export function Hub() {
  const [viewType, setViewType] = useState<CalendarViewType>('month');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [filters, setFilters] = useState<MarketingHubFilters>(emptyFilters);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);

  const { events, projects: projectEvents, isLoading: calLoading, error: calError, mutate } = useCalendarEvents();
  const { events: truvEvents, isLoading: truvEventsLoading } = useTruvEvents();

  const filterOptions = useMemo(() => {
    const categories = new Set<string>();
    const projects = new Set<string>();
    const labels = new Set<string>();
    const assignees = new Set<string>();
    const statuses = new Set<string>();

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
    setSelectedEvent(event);
  }

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
            Campaigns, webinars, and key dates across marketing.
          </p>
        </div>

        {calError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Failed to load calendar data.
          </div>
        )}

        {/* Quick Stats */}
        {!calLoading && <QuickStats events={events} projects={projectEvents} />}

        {/* Upcoming Webinars */}
        <TruvEventsBar events={truvEvents} isLoading={truvEventsLoading} />

        {/* Key Marketing Dates */}
        <KeyDates events={events} isLoading={calLoading} onEventClick={handleEventClick} />

        {/* Project Progress — Compact Rings */}
        <ProjectRings projects={projectEvents} isLoading={calLoading} onProjectClick={handleEventClick} />

        {/* Full Calendar — Collapsible */}
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
          <button
            onClick={() => setCalendarOpen(!calendarOpen)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div>
              <h2 className="text-base font-semibold text-gray-900 text-left">Full Calendar</h2>
              <p className="text-xs text-gray-500 mt-0.5 text-left">All tasks, issues, and project timelines</p>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${calendarOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {calendarOpen && (
            <div className="px-5 pb-5 border-t border-gray-100">
              <div className="pt-4">
                <CalendarToolbar
                  view={viewType}
                  onViewChange={handleViewChange}
                  currentDate={currentDate}
                  onDateChange={setCurrentDate}
                  filters={filters}
                  onFiltersChange={setFilters}
                  filterOptions={filterOptions}
                />

                <Legend />

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
              </div>
            </div>
          )}
        </div>
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
