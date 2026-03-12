import { useRef, useEffect, useCallback } from 'react';
import { useVideoEditor } from '../../hooks/useVideoEditor';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { PlayerControls } from './PlayerControls';
import { CaptionOverlay } from './CaptionOverlay';
import type { TranscriptEntry } from '../../utils/srtFormatter';

interface PreviewPlayerProps {
  captions?: TranscriptEntry[];
}

export function PreviewPlayer({ captions = [] }: PreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    sourceUrl,
    currentTime,
    isPlaying,
    setCurrentTime,
    setIsPlaying,
    setVideoDuration,
  } = useVideoEditor();

  useKeyboardShortcuts(videoRef);

  // Sync seek from store to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Math.abs(video.currentTime - currentTime) > 0.5) {
      video.currentTime = currentTime;
    }
  }, [currentTime]);

  // Sync play/pause from store
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !sourceUrl) return;
    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [isPlaying, sourceUrl, setIsPlaying]);

  const onTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) setCurrentTime(video.currentTime);
  }, [setCurrentTime]);

  const onLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) setVideoDuration(video.duration);
  }, [setVideoDuration]);

  const onEnded = useCallback(() => setIsPlaying(false), [setIsPlaying]);

  if (!sourceUrl) {
    return (
      <div className="flex items-center justify-center bg-gray-900 rounded-lg aspect-video">
        <p className="text-gray-500 text-sm">No video loaded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={sourceUrl}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={onEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="w-full aspect-video"
          playsInline
        />
        <CaptionOverlay captions={captions} videoRef={videoRef} />
      </div>
      <PlayerControls videoRef={videoRef} />
    </div>
  );
}
