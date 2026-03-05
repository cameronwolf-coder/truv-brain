import { memo, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import type { CalendarEvent } from '../../types/marketingHub';

interface MonthViewProps {
  events: CalendarEvent[];
  currentDate: Date;
}

export const MonthView = memo(function MonthView({ events, currentDate }: MonthViewProps) {
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (api) {
      const calDate = api.getDate();
      if (calDate.getMonth() !== currentDate.getMonth() || calDate.getFullYear() !== currentDate.getFullYear()) {
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
    classNames: ['rounded-md', 'text-xs', 'px-1'],
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
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
            <div className="flex items-center gap-1 overflow-hidden cursor-pointer">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: props.type === 'project' ? '#2c64e3' : (props.statusColor || '#6b7280') }}
              />
              <span className="truncate text-xs font-medium text-gray-800">
                {arg.event.title}
              </span>
            </div>
          );
        }}
      />
    </div>
  );
});
