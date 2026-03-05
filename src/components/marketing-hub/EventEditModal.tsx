import { useState } from 'react';
import type { CalendarEvent } from '../../types/marketingHub';

const HIGHLIGHT_OPTIONS = [
  { value: 'default', label: 'Default', color: '#6b7280', description: 'Status color' },
  { value: 'gold', label: 'Gold / Live', color: '#d97706', description: 'Adds [LIVE] prefix' },
] as const;

type HighlightValue = (typeof HIGHLIGHT_OPTIONS)[number]['value'];

interface EventEditModalProps {
  event: CalendarEvent;
  onClose: () => void;
  onSave: (updates: Record<string, string | undefined>) => Promise<void>;
  saving: boolean;
}

function hasLivePrefix(title: string): boolean {
  return /^\[LIVE\]\s*/i.test(title);
}

function stripLivePrefix(title: string): string {
  return title.replace(/^\[LIVE\]\s*/i, '');
}

export function EventEditModal({ event, onClose, onSave, saving }: EventEditModalProps) {
  const [title, setTitle] = useState(event.title);
  const [dueDate, setDueDate] = useState(event.start);
  const [endDate, setEndDate] = useState(event.end || '');
  const [highlight, setHighlight] = useState<HighlightValue>(
    hasLivePrefix(event.title) || event.category === 'Event' ? 'gold' : 'default',
  );

  const isProject = event.type === 'project';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const updates: Record<string, string | undefined> = {};

    // Apply highlight: add or remove [LIVE] prefix
    let finalTitle = title;
    const hadLive = hasLivePrefix(event.title);
    const wantsGold = highlight === 'gold';

    if (wantsGold && !hasLivePrefix(finalTitle) && event.category !== 'Event') {
      finalTitle = `[LIVE] ${finalTitle}`;
    } else if (!wantsGold && hasLivePrefix(finalTitle)) {
      finalTitle = stripLivePrefix(finalTitle);
    }

    if (finalTitle !== event.title) updates.title = finalTitle;

    if (isProject) {
      if (dueDate !== event.start) updates.startDate = dueDate;
      if (endDate !== (event.end || '')) updates.targetDate = endDate || undefined;
    } else {
      if (dueDate !== event.start) updates.dueDate = dueDate;
    }

    if (Object.keys(updates).length > 0) {
      await onSave(updates);
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Edit {isProject ? 'Project' : 'Task'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-truv-blue focus:border-transparent outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isProject ? 'Start Date' : 'Due Date'}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-truv-blue focus:border-transparent outline-none"
              />
            </div>
            {isProject && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-truv-blue focus:border-transparent outline-none"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Highlight Color</label>
            <div className="flex gap-2">
              {HIGHLIGHT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setHighlight(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    highlight === opt.value
                      ? 'border-truv-blue bg-blue-50 text-gray-900'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: opt.color }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: event.statusColor }}
            />
            <span>{event.status}</span>
            {event.assignee && (
              <>
                <span className="text-gray-300">|</span>
                <span>{event.assignee}</span>
              </>
            )}
            {event.category !== 'Other' && (
              <>
                <span className="text-gray-300">|</span>
                <span>{event.category}</span>
              </>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-truv-blue hover:underline"
            >
              Open in Linear
            </a>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-truv-blue rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
