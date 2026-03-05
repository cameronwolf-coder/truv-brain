import { memo, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { CalendarEvent } from '../../types/marketingHub';

interface WeekViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop: (eventId: string, type: 'project' | 'issue', newStart: string, newEnd?: string) => void;
}

export const WeekView = memo(function WeekView({ events, currentDate, onEventClick, onEventDrop }: WeekViewProps) {
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (api) {
      const calDate = api.getDate();
      const calWeekStart = new Date(calDate);
      calWeekStart.setDate(calDate.getDate() - calDate.getDay());
      const targetWeekStart = new Date(currentDate);
      targetWeekStart.setDate(currentDate.getDate() - currentDate.getDay());
      if (calWeekStart.toDateString() !== targetWeekStart.toDateString()) {
        api.gotoDate(currentDate);
      }
    }
  }, [currentDate]);

  const fcEvents = events.map((e) => {
    const isGold = e.category === 'Event' || /\[LIVE\]/i.test(e.title);
    const bgColor = isGold ? '#d97706' : e.type === 'project' ? '#2c64e3' : e.statusColor || '#6b7280';
    return {
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      extendedProps: { ...e },
      backgroundColor: bgColor,
      borderColor: 'transparent',
    };
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridWeek"
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
          const props = arg.event.extendedProps;
          const isGold = props.category === 'Event' || /\[LIVE\]/i.test(props.title);
          const dotColor = isGold ? '#d97706' : props.type === 'project' ? '#2c64e3' : (props.statusColor || '#6b7280');
          return (
            <div className={`flex items-center gap-1.5 overflow-hidden cursor-pointer py-0.5 ${isGold ? 'font-semibold' : ''}`}>
              {isGold && <span className="text-[10px]">&#9733;</span>}
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: dotColor }}
              />
              <div className="min-w-0">
                <p className={`truncate text-xs font-medium ${isGold ? 'text-amber-800' : 'text-gray-800'}`}>{arg.event.title}</p>
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
