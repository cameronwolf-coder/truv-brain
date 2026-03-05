import { memo, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { CalendarEvent } from '../../types/marketingHub';

const CATEGORY_COLORS: Record<string, string> = {
  Event: '#ca8a04',
  Growth: '#2c64e3',
  PMM: '#10b981',
  Ops: '#6b7280',
  Other: '#6b7280',
};

function getEventColor(e: CalendarEvent): string {
  if (e.category === 'Event' || /\[LIVE\]/i.test(e.title)) return '#ca8a04';
  if (e.type === 'project') return CATEGORY_COLORS[e.category] || '#2c64e3';
  return CATEGORY_COLORS[e.category] || e.statusColor || '#6b7280';
}

interface MonthViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop: (eventId: string, type: 'project' | 'issue', newStart: string, newEnd?: string) => void;
}

export const MonthView = memo(function MonthView({ events, currentDate, onEventClick, onEventDrop }: MonthViewProps) {
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

  const fcEvents = events.map((e) => {
    return {
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      extendedProps: { ...e },
      backgroundColor: getEventColor(e),
      borderColor: 'transparent',
      classNames: ['rounded-md', 'text-xs', 'px-1'],
    };
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        initialDate={currentDate}
        events={fcEvents}
        headerToolbar={false}
        height="auto"
        editable={true}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          const props = info.event.extendedProps as CalendarEvent;
          onEventClick(props);
        }}
        eventDrop={(info) => {
          const props = info.event.extendedProps as CalendarEvent;
          const newStart = info.event.startStr;
          const newEnd = info.event.endStr || undefined;
          onEventDrop(props.id, props.type, newStart, newEnd);
        }}
        eventResize={(info) => {
          const props = info.event.extendedProps as CalendarEvent;
          const newStart = info.event.startStr;
          const newEnd = info.event.endStr || undefined;
          onEventDrop(props.id, props.type, newStart, newEnd);
        }}
        eventContent={(arg) => {
          const props = arg.event.extendedProps as CalendarEvent;
          const isGold = props.category === 'Event' || /\[LIVE\]/i.test(props.title);
          const dotColor = getEventColor(props);
          return (
            <div className={`flex items-center gap-1 overflow-hidden cursor-pointer ${isGold ? 'font-semibold' : ''}`}>
              {isGold && <span className="text-[10px] text-white">&#9733;</span>}
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: dotColor }}
              />
              <span className="truncate text-xs font-medium text-white">
                {arg.event.title}
              </span>
            </div>
          );
        }}
      />
    </div>
  );
});
