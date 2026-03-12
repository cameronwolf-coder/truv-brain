import { useRef, useEffect, useCallback, useState } from 'react';
import { useVideoEditor } from '../../hooks/useVideoEditor';
import { useTimeline } from '../../hooks/useTimeline';
import { TimelineRuler } from './TimelineRuler';
import { TimelineSegment } from './TimelineSegment';
import { parseTimestamp, formatTimestamp } from '../../utils/videoEditorUtils';
import type { Segment } from '../../types/videoEditor';

interface DragData {
  segmentIndex: number;
  handle: 'left' | 'right' | 'body';
  startX: number;
  originalStart: number;
  originalEnd: number;
}

interface DragPreview {
  index: number;
  start: number;
  end: number;
}

export function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    approvedSegments,
    selectedIndex,
    videoDuration,
    currentTime,
    selectSegment,
    setCurrentTime,
    editSegment,
  } = useVideoEditor();
  const { pixelsPerSecond, secondsToPixels, zoom, setContainerWidth } = useTimeline();

  const dragRef = useRef<DragData | null>(null);
  const previewRef = useRef<DragPreview | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const rafRef = useRef<number>(0);

  // Track container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [setContainerWidth]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoom(-e.deltaY);
      }
    },
    [zoom]
  );

  const snapToGrid = useCallback((seconds: number) => {
    return Math.round(seconds / 0.5) * 0.5;
  }, []);

  const onSegmentDragStart = useCallback(
    (index: number, handle: 'left' | 'right' | 'body', startX: number) => {
      const seg = approvedSegments[index];
      if (!seg) return;
      dragRef.current = {
        segmentIndex: index,
        handle,
        startX,
        originalStart: parseTimestamp(seg.start),
        originalEnd: parseTimestamp(seg.end),
      };
      previewRef.current = null;
      setIsDragging(true);
    },
    [approvedSegments]
  );

  // Only attach global listeners while dragging
  useEffect(() => {
    if (!isDragging) return;

    const pps = pixelsPerSecond;

    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const deltaX = e.clientX - drag.startX;
      const deltaSec = deltaX / pps;

      let newStart = drag.originalStart;
      let newEnd = drag.originalEnd;
      const duration = drag.originalEnd - drag.originalStart;

      if (drag.handle === 'left') {
        newStart = snapToGrid(Math.max(0, drag.originalStart + deltaSec));
        if (newStart >= newEnd - 0.5) newStart = newEnd - 0.5;
      } else if (drag.handle === 'right') {
        newEnd = snapToGrid(Math.max(0, drag.originalEnd + deltaSec));
        if (newEnd <= newStart + 0.5) newEnd = newStart + 0.5;
      } else {
        newStart = snapToGrid(Math.max(0, drag.originalStart + deltaSec));
        newEnd = newStart + duration;
      }

      previewRef.current = { index: drag.segmentIndex, start: newStart, end: newEnd };

      // Use rAF to batch DOM updates
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const el = document.querySelector(`[data-timeline-seg="${drag.segmentIndex}"]`) as HTMLElement;
        if (el) {
          el.style.left = `${newStart * pps}px`;
          el.style.width = `${Math.max((newEnd - newStart) * pps, 4)}px`;
        }
      });
    };

    const handleMouseUp = () => {
      const preview = previewRef.current;
      cancelAnimationFrame(rafRef.current);

      if (preview) {
        editSegment(preview.index, {
          start: formatTimestamp(preview.start),
          end: formatTimestamp(preview.end),
        });
      }

      dragRef.current = null;
      previewRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isDragging, pixelsPerSecond, snapToGrid, editSegment]);

  const totalWidth = secondsToPixels(videoDuration || 60);
  const playheadX = secondsToPixels(currentTime);

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* Zoom controls */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
        <span className="text-[10px] text-gray-400">
          {approvedSegments.length} clip{approvedSegments.length !== 1 ? 's' : ''} on timeline
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => zoom(-100)}
            className="text-xs text-gray-500 hover:text-gray-700 px-1"
          >
            -
          </button>
          <span className="text-[10px] text-gray-400 w-12 text-center">
            {pixelsPerSecond.toFixed(0)}px/s
          </span>
          <button
            onClick={() => zoom(100)}
            className="text-xs text-gray-500 hover:text-gray-700 px-1"
          >
            +
          </button>
        </div>
      </div>

      {/* Timeline scroll area */}
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-hidden"
        onWheel={onWheel}
      >
        <div className="relative" style={{ width: totalWidth, minWidth: '100%' }}>
          <TimelineRuler duration={videoDuration || 60} onSeek={setCurrentTime} />

          <div
            className="relative h-12 bg-gray-50"
            onClick={(e) => {
              if (isDragging) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const time = useTimeline.getState().pixelsToSeconds(x);
              setCurrentTime(Math.max(0, Math.min(videoDuration, time)));
            }}
          >
            {approvedSegments.map((seg, i) => {
              const startSec = parseTimestamp(seg.start);
              const endSec = parseTimestamp(seg.end);
              return (
                <TimelineSegment
                  key={i}
                  segment={seg}
                  index={i}
                  isSelected={selectedIndex === i}
                  displayStart={startSec}
                  displayEnd={endSec}
                  onSelect={() => selectSegment(i)}
                  onDragStart={(handle, startX) => onSegmentDragStart(i, handle, startX)}
                  onSeek={setCurrentTime}
                />
              );
            })}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
              style={{ left: playheadX }}
            >
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full -translate-x-[4px] -translate-y-0.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
