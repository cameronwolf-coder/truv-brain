import type { CalendarEvent } from '../../types/marketingHub';

const categoryColors: Record<string, { bar: string; bg: string; text: string }> = {
  Event: { bar: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  Growth: { bar: 'bg-truv-blue', bg: 'bg-blue-50', text: 'text-blue-700' },
  PMM: { bar: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  Ops: { bar: 'bg-gray-500', bg: 'bg-gray-50', text: 'text-gray-600' },
  Other: { bar: 'bg-gray-400', bg: 'bg-gray-50', text: 'text-gray-600' },
};

interface ProjectProgressProps {
  projects: CalendarEvent[];
  isLoading: boolean;
  onProjectClick: (project: CalendarEvent) => void;
}

export function ProjectProgress({ projects, isLoading, onProjectClick }: ProjectProgressProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 border-b border-gray-100 animate-pulse">
            <div className="flex items-center justify-between mb-2">
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-100 rounded w-16" />
            </div>
            <div className="h-2 bg-gray-100 rounded-full w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500 text-sm">
        No active projects
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {projects.map((project) => {
        const total = project.totalIssues || 0;
        const completed = project.completedIssues || 0;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        const colors = categoryColors[project.category] || categoryColors.Other;

        return (
          <button
            key={project.id}
            onClick={() => onProjectClick(project)}
            className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {project.title}
                </span>
                <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                  {project.category}
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-700 shrink-0 ml-3">
                {pct}%
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${colors.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 shrink-0">
                {completed}/{total} tasks
              </span>
            </div>

            {(project.assignee || project.end) && (
              <p className="text-xs text-gray-500 mt-1.5">
                {project.assignee && <>{project.assignee}</>}
                {project.assignee && project.end && <> · </>}
                {project.end && <>Target: {new Date(project.end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
