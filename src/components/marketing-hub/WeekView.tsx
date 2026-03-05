import { memo, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import type { CalendarEvent } from '../../types/marketingHub';

interface WeekViewProps {
  events: CalendarEvent[];
  currentDate: Date;
}

export const WeekView = memo(function WeekView({ events, currentDate }: WeekViewProps) {
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (api) {
      const calDate = api.getDate();
      // Only navigate if the week actually changed
      const calWeekStart = new Date(calDate);
      calWeekStart.setDate(calDate.getDate() - calDate.getDay());
      const targetWeekStart = new Date(currentDate);
      targetWeekStart.setDate(currentDate.getDate() - currentDate.getDay());
      if (calWeekStart.toDateString() !== targetWeekStart.toDateString()) {
        api.gotoDate(currentDate);
      }
    }
  }, [currentDate]);

  const fcEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    extendedProps: { ...e },
    backgroundColor: e.type === 'project' ? '#2c64e3' : e.statusColor || '#6b7280',
    borderColor: 'transparent',
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin]}
        initialView="dayGridWeek"
        initialDate={currentDate}
        events={fcEvents}
        headerToolbar={false}
        height="auto"
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          const url = info.event.extendedProps.url;
          if (url) window.open(url, '_blank');
        }}
        eventContent={(arg) => {
          const props = arg.event.extendedProps;
          return (
            <div className="flex items-center gap-1.5 overflow-hidden cursor-pointer py-0.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: props.type === 'project' ? '#2c64e3' : (props.statusColor || '#6b7280') }}
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-gray-800">{arg.event.title}</p>
                {props.assignee && (
                  <p className="truncate text-[10px] text-gray-500">{props.assignee}</p>
                )}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
});
