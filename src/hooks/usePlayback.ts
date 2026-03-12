import { useEffect, useRef } from 'react';
import { useVideoEditor } from './useVideoEditor';

export function usePlayback(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const rafRef = useRef<number>(0);
  const { isPlaying, setCurrentTime } = useVideoEditor();

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, setCurrentTime, videoRef]);
}
