import { memo, useMemo } from 'react';
import type { CalendarEvent } from '../../types/marketingHub';

interface TimelineViewProps {
  events: CalendarEvent[];
  currentDate: Date;
}

function getDaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const TimelineView = memo(function TimelineView({ events, currentDate }: TimelineViewProps) {
  const rangeStart = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return d;
  }, [currentDate]);

  const rangeEnd = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return d;
  }, [currentDate]);

  const days = useMemo(() => getDaysInRange(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  const totalDays = days.length;

  const projects = useMemo(
    () => events.filter((e) => e.type === 'project' && e.end),
    [events],
  );

  const issues = useMemo(
    () => events.filter((e) => e.type === 'issue'),
    [events],
  );

  // Group issues by project
  const issuesByProject = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    issues.forEach((i) => {
      const key = i.project || 'Ungrouped';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    });
    return map;
  }, [issues]);

  const today = new Date();

  function getBarStyle(start: string, end: string) {
    const s = new Date(start);
    const e = new Date(end);
    const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
    const leftPct = Math.max(0, ((s.getTime() - rangeStart.getTime()) / rangeMs) * 100);
    const widthPct = Math.min(100 - leftPct, ((e.getTime() - s.getTime()) / rangeMs) * 100);
    return { left: `${leftPct}%`, width: `${Math.max(widthPct, 1)}%` };
  }

  function getDotPosition(dateStr: string) {
    const d = new Date(dateStr);
    const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
    const leftPct = ((d.getTime() - rangeStart.getTime()) / rangeMs) * 100;
    return { left: `${Math.max(0, Math.min(100, leftPct))}%` };
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Date Header */}
      <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="w-48 shrink-0 p-3 border-r border-gray-200">
          <span className="text-xs font-medium text-gray-500 uppercase">Item</span>
        </div>
        <div className="flex-1 flex">
          {days.map((day, i) => (
            <div
              key={i}
              className={`flex-1 text-center py-2 text-[10px] border-r border-gray-100 ${
                isSameDay(day, today)
                  ? 'bg-blue-50 text-truv-blue font-semibold'
                  : day.getDay() === 0 || day.getDay() === 6
                    ? 'text-gray-400'
                    : 'text-gray-600'
              }`}
            >
              <div>{day.toLocaleDateString('default', { weekday: 'narrow' })}</div>
              <div className="font-medium">{day.getDate()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Project Bars */}
      {projects.map((project) => (
        <div
          key={project.id}
          className="flex border-b border-gray-100 hover:bg-gray-50 transition-colors"
          style={{ contentVisibility: 'auto' }}
        >
          <div className="w-48 shrink-0 p-3 border-r border-gray-200">
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-900 hover:text-truv-blue truncate block"
            >
              {project.title}
            </a>
            {project.assignee && (
              <p className="text-xs text-gray-500 mt-0.5">{project.assignee}</p>
            )}
          </div>
          <div className="flex-1 relative py-3 px-1">
            <div
              className="absolute h-6 rounded-full top-1/2 -translate-y-1/2"
              style={{
                ...getBarStyle(project.start, project.end!),
                backgroundColor: '#2c64e3',
                opacity: 0.85,
              }}
            >
              <span className="text-[10px] text-white font-medium px-2 leading-6 truncate block">
                {project.title}
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Issues grouped by project */}
      {Array.from(issuesByProject.entries()).map(([projectName, projectIssues]) => (
        <div key={projectName}>
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500 uppercase">{projectName}</span>
          </div>
          {projectIssues.map((issue) => (
            <div
              key={issue.id}
              className="flex border-b border-gray-100 hover:bg-gray-50 transition-colors"
              style={{ contentVisibility: 'auto' }}
            >
              <div className="w-48 shrink-0 p-3 border-r border-gray-200">
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-700 hover:text-truv-blue truncate block"
                >
                  {issue.title}
                </a>
                {issue.assignee && (
                  <p className="text-xs text-gray-500 mt-0.5">{issue.assignee}</p>
                )}
              </div>
              <div className="flex-1 relative py-3">
                <div
                  className="absolute w-3 h-3 rounded-full top-1/2 -translate-y-1/2 -translate-x-1/2 border-2 border-white shadow-sm"
                  style={{
                    ...getDotPosition(issue.start),
                    backgroundColor: issue.statusColor || '#6b7280',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Today line */}
      {today >= rangeStart && today <= rangeEnd && (
        <div
          className="absolute top-0 bottom-0 w-px bg-red-400 z-20 pointer-events-none"
          style={{ left: `calc(192px + ${((today.getTime() - rangeStart.getTime()) / (rangeEnd.getTime() - rangeStart.getTime())) * 100}% * (100% - 192px) / 100%)` }}
        />
      )}

      {projects.length === 0 && issues.length === 0 && (
        <div className="p-12 text-center text-gray-500 text-sm">
          No items with dates in this range
        </div>
      )}
    </div>
  );
});
