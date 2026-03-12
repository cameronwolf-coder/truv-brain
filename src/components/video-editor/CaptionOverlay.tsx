import { useRef, useEffect } from 'react';
import type { TranscriptEntry } from '../../utils/srtFormatter';
import { useVideoEditor } from '../../hooks/useVideoEditor';

interface CaptionOverlayProps {
  captions: TranscriptEntry[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function CaptionOverlay({ captions, videoRef }: CaptionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const { isPlaying } = useVideoEditor();

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || captions.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const { videoWidth, videoHeight, currentTime } = video;
      if (videoWidth === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      canvas.width = canvas.clientWidth * window.devicePixelRatio;
      canvas.height = canvas.clientHeight * window.devicePixelRatio;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const activeCaption = captions.find(
        (c) => currentTime >= c.start && currentTime <= c.end
      );

      if (activeCaption) {
        const fontSize = Math.round(canvas.height * 0.05);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        const x = canvas.width / 2;
        const y = canvas.height - fontSize * 1.5;

        // Black stroke
        ctx.strokeStyle = 'black';
        ctx.lineWidth = fontSize * 0.15;
        ctx.lineJoin = 'round';
        ctx.strokeText(activeCaption.text, x, y);

        // White fill
        ctx.fillStyle = 'white';
        ctx.fillText(activeCaption.text, x, y);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [captions, videoRef, isPlaying]);

  if (captions.length === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
