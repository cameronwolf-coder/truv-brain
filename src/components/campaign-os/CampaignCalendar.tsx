import { useState } from 'react';
import type { CampaignListItem } from '../../types/campaign';

interface CampaignCalendarProps {
  campaigns: CampaignListItem[];
  onSelect: (id: string) => void;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function CampaignCalendar({ campaigns, onSelect }: CampaignCalendarProps) {
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const dateMap = new Map<string, CampaignListItem[]>();
  for (const c of campaigns) {
    const dateStr = c.sentAt || c.nextSendAt;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate().toString();
      const existing = dateMap.get(key) || [];
      existing.push(c);
      dateMap.set(key, existing);
    }
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="px-2 py-1 text-gray-500 hover:text-gray-700 text-sm">&larr;</button>
        <h3 className="font-medium text-gray-900">{monthName}</h3>
        <button onClick={nextMonth} className="px-2 py-1 text-gray-500 hover:text-gray-700 text-sm">&rarr;</button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
        {days.map((d) => (
          <div key={d} className="bg-gray-50 px-2 py-1.5 text-center text-xs font-medium text-gray-500">{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-white p-2 min-h-[60px]" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayCampaigns = dateMap.get(day.toString()) || [];
          return (
            <div key={day} className="bg-white p-2 min-h-[60px]">
              <span className="text-xs text-gray-500">{day}</span>
              <div className="mt-1 space-y-0.5">
                {dayCampaigns.slice(0, 2).map((c) => (
                  <button key={c.id} onClick={() => onSelect(c.id)} className={`block w-full text-left px-1 py-0.5 rounded text-xs truncate ${c.channel === 'marketing' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}>{c.name}</button>
                ))}
                {dayCampaigns.length > 2 && <span className="text-xs text-gray-400">+{dayCampaigns.length - 2} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
