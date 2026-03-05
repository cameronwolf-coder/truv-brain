import { type CalendarViewType, type MarketingHubFilters } from '../../types/marketingHub';

interface CalendarToolbarProps {
  view: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  filters: MarketingHubFilters;
  onFiltersChange: (filters: MarketingHubFilters) => void;
  filterOptions: {
    categories: string[];
    projects: string[];
    labels: string[];
    assignees: string[];
    statuses: string[];
  };
}

const views: { key: CalendarViewType; label: string }[] = [
  { key: 'month', label: 'Month' },
  { key: 'week', label: 'Week' },
  { key: 'timeline', label: 'Timeline' },
];

function formatDateRange(date: Date, view: CalendarViewType): string {
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();
  if (view === 'month' || view === 'timeline') return `${month} ${year}`;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const startStr = weekStart.toLocaleDateString('default', { month: 'short', day: 'numeric' });
  const endStr = weekEnd.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

function navigate(date: Date, view: CalendarViewType, direction: -1 | 1): Date {
  const next = new Date(date);
  if (view === 'week') {
    next.setDate(next.getDate() + direction * 7);
  } else {
    next.setMonth(next.getMonth() + direction);
  }
  return next;
}

export function CalendarToolbar({
  view,
  onViewChange,
  currentDate,
  onDateChange,
  filters,
  onFiltersChange,
  filterOptions,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex items-center justify-between">
        {/* View Toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => onViewChange(v.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                view === v.key
                  ? 'bg-truv-blue text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Date Navigation */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDateChange(navigate(currentDate, view, -1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => onDateChange(new Date())}
              className="px-3 py-1 text-xs font-medium text-truv-blue hover:bg-blue-50 rounded-lg transition-colors"
            >
              {view === 'week' ? 'This week' : 'This month'}
            </button>
            <button
              onClick={() => onDateChange(navigate(currentDate, view, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <span className="text-lg font-semibold text-gray-900 text-center">
            {formatDateRange(currentDate, view)}
          </span>
        </div>

        <div className="w-[200px]" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-gray-500 uppercase">Filters:</span>
        <select
          value={filters.category || ''}
          onChange={(e) => onFiltersChange({ ...filters, category: e.target.value || null })}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white"
        >
          <option value="">All Categories</option>
          {filterOptions.categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filters.project || ''}
          onChange={(e) => onFiltersChange({ ...filters, project: e.target.value || null })}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white"
        >
          <option value="">All Projects</option>
          {filterOptions.projects.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={filters.label || ''}
          onChange={(e) => onFiltersChange({ ...filters, label: e.target.value || null })}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white"
        >
          <option value="">All Labels</option>
          {filterOptions.labels.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select
          value={filters.assignee || ''}
          onChange={(e) => onFiltersChange({ ...filters, assignee: e.target.value || null })}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white"
        >
          <option value="">All Assignees</option>
          {filterOptions.assignees.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={filters.status || ''}
          onChange={(e) => onFiltersChange({ ...filters, status: e.target.value || null })}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white"
        >
          <option value="">All Statuses</option>
          {filterOptions.statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(filters.category || filters.project || filters.label || filters.assignee || filters.status) && (
          <button
            onClick={() => onFiltersChange({ category: null, project: null, label: null, assignee: null, status: null })}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
