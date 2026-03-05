import { useState, useMemo, lazy, Suspense, startTransition } from 'react';
import { useCalendarEvents, updateEvent, createIssue } from '../services/marketingHubClient';
import { CalendarToolbar } from '../components/marketing-hub/CalendarToolbar';
import { ProjectProgress } from '../components/marketing-hub/ProjectProgress';
import { EventEditModal } from '../components/marketing-hub/EventEditModal';
import { CreateIssueModal } from '../components/marketing-hub/CreateIssueModal';
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const { events, projects: projectEvents, isLoading: calLoading, error: calError, mutate } = useCalendarEvents();

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

  async function handleCreateIssue(title: string, dueDate?: string, projectId?: string) {
    setSaving(true);
    try {
      await createIssue(title, dueDate, projectId);
      await mutate();
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create issue:', err);
    } finally {
      setSaving(false);
    }
  }

  const projectList = useMemo(() => {
    return projectEvents.map((p) => ({ id: p.id, name: p.title }));
  }, [projectEvents]);

  // Derive filter options from events + all active projects
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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Marketing Hub</h1>
          <p className="text-sm text-gray-500 mt-1">
            What's happening across marketing — upcoming projects, tasks, and recent activity.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-truv-blue rounded-lg hover:bg-blue-700 transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </button>
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Progress</h2>
        <ProjectProgress
          projects={projectEvents}
          isLoading={calLoading}
          onProjectClick={setSelectedEvent}
        />
      </div>

      {selectedEvent && (
        <EventEditModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSave={handleEventSave}
          saving={saving}
        />
      )}

      {showCreateModal && (
        <CreateIssueModal
          projects={projectList}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateIssue}
          saving={saving}
        />
      )}
    </div>
  );
}
