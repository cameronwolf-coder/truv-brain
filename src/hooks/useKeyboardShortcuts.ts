import { useEffect } from 'react';
import { useVideoEditor } from './useVideoEditor';

export function useKeyboardShortcuts(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const { isPlaying, setIsPlaying, setCurrentTime } = useVideoEditor();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const video = videoRef.current;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;

        case 'KeyJ':
          // Rewind 5s
          if (video) {
            const t = Math.max(0, video.currentTime - 5);
            video.currentTime = t;
            setCurrentTime(t);
          }
          break;

        case 'KeyK':
          // Toggle play/pause
          setIsPlaying(!isPlaying);
          break;

        case 'KeyL':
          // Forward 5s
          if (video) {
            const t = Math.min(video.duration, video.currentTime + 5);
            video.currentTime = t;
            setCurrentTime(t);
          }
          break;

        case 'ArrowLeft':
          // Frame back (~1/30s)
          e.preventDefault();
          if (video) {
            const t = Math.max(0, video.currentTime - (1 / 30));
            video.currentTime = t;
            setCurrentTime(t);
          }
          break;

        case 'ArrowRight':
          // Frame forward
          e.preventDefault();
          if (video) {
            const t = Math.min(video.duration, video.currentTime + (1 / 30));
            video.currentTime = t;
            setCurrentTime(t);
          }
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPlaying, setIsPlaying, setCurrentTime, videoRef]);
}
