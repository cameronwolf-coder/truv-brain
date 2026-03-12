import { memo, useCallback } from 'react';
import type { Segment } from '../../types/videoEditor';
import { useTimeline } from '../../hooks/useTimeline';

const PERSONA_BG: Record<string, string> = {
  payroll: 'bg-purple-400/70',
  lending: 'bg-green-400/70',
  background: 'bg-amber-400/70',
  fintech: 'bg-blue-400/70',
};

interface TimelineSegmentProps {
  segment: Segment;
  index: number;
  isSelected: boolean;
  displayStart: number;
  displayEnd: number;
  onSelect: () => void;
  onDragStart: (handle: 'left' | 'right' | 'body', startX: number) => void;
  onSeek: (time: number) => void;
}

export const TimelineSegment = memo(function TimelineSegment({
  segment,
  index,
  isSelected,
  displayStart,
  displayEnd,
  onSelect,
  onDragStart,
  onSeek,
}: TimelineSegmentProps) {
  const { secondsToPixels } = useTimeline();

  const left = secondsToPixels(displayStart);
  const width = secondsToPixels(displayEnd - displayStart);

  const primaryPersona = segment.personas[0] || 'payroll';
  const bgColor = PERSONA_BG[primaryPersona] || 'bg-gray-400/70';

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, handle: 'left' | 'right' | 'body') => {
      e.stopPropagation();
      e.preventDefault();
      onSelect();
      onDragStart(handle, e.clientX);
    },
    [onSelect, onDragStart]
  );

  return (
    <div
      data-timeline-seg={index}
      className={`absolute top-1 bottom-1 rounded cursor-grab active:cursor-grabbing group ${bgColor} ${
        isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
      }`}
      style={{ left, width: Math.max(width, 4) }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
        onSeek(displayStart);
      }}
      onMouseDown={(e) => handleMouseDown(e, 'body')}
    >
      {/* Left trim handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 rounded-l"
        onMouseDown={(e) => handleMouseDown(e, 'left')}
      />

      {/* Label */}
      <div className="px-2 py-0.5 overflow-hidden h-full flex items-center">
        <span className="text-[10px] text-white font-medium truncate drop-shadow-sm select-none">
          {segment.suggestedTitle}
        </span>
      </div>

      {/* Right trim handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 rounded-r"
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      />
    </div>
  );
});
