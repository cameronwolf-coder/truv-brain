import { useMemo } from 'react';
import { useTimeline } from '../../hooks/useTimeline';
import { formatTimestamp } from '../../utils/videoEditorUtils';

interface TimelineRulerProps {
  duration: number;
  onSeek: (time: number) => void;
}

function getTickInterval(pps: number): number {
  if (pps >= 80) return 1;
  if (pps >= 40) return 5;
  if (pps >= 15) return 10;
  if (pps >= 6) return 30;
  return 60;
}

export function TimelineRuler({ duration, onSeek }: TimelineRulerProps) {
  const { pixelsPerSecond, secondsToPixels } = useTimeline();

  const ticks = useMemo(() => {
    const interval = getTickInterval(pixelsPerSecond);
    const result: { time: number; x: number; major: boolean }[] = [];
    for (let t = 0; t <= duration; t += interval) {
      result.push({
        time: t,
        x: secondsToPixels(t),
        major: t % (interval * 5) === 0 || interval >= 30,
      });
    }
    return result;
  }, [duration, pixelsPerSecond, secondsToPixels]);

  const totalWidth = secondsToPixels(duration);

  return (
    <div
      className="relative h-6 bg-gray-100 border-b border-gray-200 cursor-pointer select-none"
      style={{ width: totalWidth }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = useTimeline.getState().pixelsToSeconds(x);
        onSeek(Math.max(0, Math.min(duration, time)));
      }}
    >
      {ticks.map(({ time, x, major }) => (
        <div key={time} className="absolute top-0" style={{ left: x }}>
          <div
            className={`w-px ${major ? 'h-4 bg-gray-400' : 'h-2.5 bg-gray-300'}`}
          />
          {major && (
            <span className="absolute top-3 -translate-x-1/2 text-[9px] text-gray-500 whitespace-nowrap font-mono">
              {formatTimestamp(time)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
