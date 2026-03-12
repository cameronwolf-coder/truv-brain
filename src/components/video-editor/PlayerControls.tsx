import { useCallback } from 'react';
import { useVideoEditor } from '../../hooks/useVideoEditor';
import { formatTimestamp } from '../../utils/videoEditorUtils';

interface PlayerControlsProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

const SPEEDS = [0.5, 1, 1.5, 2];

export function PlayerControls({ videoRef }: PlayerControlsProps) {
  const { currentTime, isPlaying, videoDuration, setIsPlaying, setCurrentTime } = useVideoEditor();

  const togglePlay = useCallback(() => setIsPlaying(!isPlaying), [isPlaying, setIsPlaying]);

  const onScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      setCurrentTime(time);
      if (videoRef.current) videoRef.current.currentTime = time;
    },
    [setCurrentTime, videoRef]
  );

  const setSpeed = useCallback(
    (rate: number) => {
      if (videoRef.current) videoRef.current.playbackRate = rate;
    },
    [videoRef]
  );

  return (
    <div className="flex items-center gap-3 px-2">
      <button
        onClick={togglePlay}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-sm"
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <span className="text-xs font-mono text-gray-600 w-20 text-right">
        {formatTimestamp(currentTime)}
      </span>

      <input
        type="range"
        min={0}
        max={videoDuration || 100}
        step={0.1}
        value={currentTime}
        onChange={onScrub}
        className="flex-1 h-1.5 accent-blue-600"
      />

      <span className="text-xs font-mono text-gray-400 w-20">
        {videoDuration > 0 ? formatTimestamp(videoDuration) : '--:--'}
      </span>

      <div className="flex gap-1">
        {SPEEDS.map((rate) => (
          <button
            key={rate}
            onClick={() => setSpeed(rate)}
            className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
              videoRef.current?.playbackRate === rate
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {rate}x
          </button>
        ))}
      </div>
    </div>
  );
}
