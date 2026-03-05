import type { CalendarEvent } from '../../types/marketingHub';

const categoryConfig: Record<string, { icon: string; borderColor: string; pillColor: string }> = {
  Event: { icon: '★', borderColor: 'border-l-amber-500', pillColor: 'bg-amber-100 text-amber-700' },
  Growth: { icon: '📧', borderColor: 'border-l-blue-500', pillColor: 'bg-blue-100 text-blue-700' },
  PMM: { icon: '📝', borderColor: 'border-l-emerald-500', pillColor: 'bg-emerald-100 text-emerald-700' },
  Ops: { icon: '⚙️', borderColor: 'border-l-gray-400', pillColor: 'bg-gray-100 text-gray-600' },
  Other: { icon: '○', borderColor: 'border-l-gray-300', pillColor: 'bg-gray-100 text-gray-600' },
};

function deriveItemLabel(title: string, labels: { name: string }[]): string | null {
  const t = title.toLowerCase();
  const l = labels.map((lb) => lb.name.toLowerCase());

  if (l.includes('webinar') || t.includes('webinar')) return 'Webinar';
  if (l.includes('case study') || t.includes('case study')) return 'Case Study';
  if (t.includes('product update')) return 'Product Update';
  if (t.includes('insider')) return 'Newsletter';
  if (t.includes('email') || t.includes('newsletter')) return 'Email';
  if (t.includes('landing page')) return 'Landing Page';
  if (t.includes('linkedin') || t.includes('ad ')) return 'Ad Campaign';
  return null;
}

interface UpcomingFeedCardProps {
  event: CalendarEvent;
  isCompleted: boolean;
  friendlyDate: string;
  onClick: (event: CalendarEvent) => void;
}

export function UpcomingFeedCard({ event, isCompleted, friendlyDate, onClick }: UpcomingFeedCardProps) {
  const cat = categoryConfig[event.category] || categoryConfig.Other;
  const itemLabel = deriveItemLabel(event.title, event.labels);
  const borderClass = isCompleted ? 'border-l-emerald-500' : cat.borderColor;

  return (
    <button
      onClick={() => onClick(event)}
      className={`w-full text-left flex items-start gap-3 p-4 border-b border-gray-100 border-l-[3px] ${borderClass} hover:bg-gray-50 transition-colors`}
      style={{ contentVisibility: 'auto' }}
    >
      <span className="text-base mt-0.5 shrink-0">
        {isCompleted ? '✓' : cat.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate">
            {event.title}
          </span>
          {itemLabel && (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {itemLabel}
            </span>
          )}
          <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cat.pillColor}`}>
            {event.category}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {event.assignee && <>{event.assignee} · </>}
          {friendlyDate}
        </p>
      </div>
      <svg className="w-4 h-4 text-gray-300 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
