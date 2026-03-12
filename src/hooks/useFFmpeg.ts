import { useState, useCallback, useRef } from 'react';
import { parseTimestamp } from '../utils/videoEditorUtils';

interface ExportResult {
  filename: string;
  blob: Blob;
  url: string;
}

interface ExportOptions {
  sourceFile: File;
  startTime: string;
  endTime: string;
  outputName: string;
  resolution?: 1080 | 720 | 480;
  format?: 'mp4' | 'mov';
  srtContent?: string;
}

/**
 * Estimate byte range for a time range within a video file.
 * Uses average bitrate to approximate where the bytes for a given
 * time window live. Adds generous padding (30s before, 30s after)
 * to ensure we capture the nearest keyframes.
 */
function estimateByteRange(
  file: File,
  startTime: string,
  endTime: string,
  totalDuration: number
): { sliceStart: number; sliceEnd: number; offsetSeconds: number } | null {
  if (totalDuration <= 0) return null;

  const startSec = parseTimestamp(startTime);
  const endSec = parseTimestamp(endTime);

  const bytesPerSecond = file.size / totalDuration;

  // Pad 30s before start for keyframe alignment, 30s after end for safety
  const padBefore = 30;
  const padAfter = 30;
  const sliceStartSec = Math.max(0, startSec - padBefore);
  const sliceEndSec = Math.min(totalDuration, endSec + padAfter);

  const sliceStart = Math.floor(sliceStartSec * bytesPerSecond);
  const sliceEnd = Math.min(file.size, Math.ceil(sliceEndSec * bytesPerSecond));

  // For small files or short videos, don't bother slicing
  if (sliceEnd - sliceStart > file.size * 0.8) return null;

  return {
    sliceStart,
    sliceEnd,
    offsetSeconds: sliceStartSec,
  };
}

// Threshold: only slice files larger than 200MB
const SLICE_THRESHOLD = 200 * 1024 * 1024;

export function useFFmpeg() {
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ExportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ffmpegRef = useRef<any>(null);
  const videoDurationRef = useRef<number>(0);

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current;

    setIsLoading(true);
    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');

      const ffmpeg = new FFmpeg();

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      ffmpegRef.current = ffmpeg;
      return ffmpeg;
    } catch (err) {
      setError('Failed to load FFmpeg. Your browser may not support it.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Probe the video duration using a temporary <video> element.
   * Cached after first call for the same file.
   */
  const probeDuration = useCallback(async (file: File): Promise<number> => {
    if (videoDurationRef.current > 0) return videoDurationRef.current;

    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const url = URL.createObjectURL(file);
      video.src = url;
      video.onloadedmetadata = () => {
        videoDurationRef.current = video.duration;
        URL.revokeObjectURL(url);
        resolve(video.duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
    });
  }, []);

  const exportClip = useCallback(
    async (options: ExportOptions): Promise<ExportResult> => {
      const { sourceFile, startTime, endTime, outputName, resolution, format = 'mp4', srtContent } = options;

      const ffmpeg = await loadFFmpeg();
      const { fetchFile } = await import('@ffmpeg/util');

      const ext = sourceFile.name.split('.').pop() || 'mp4';
      const inputName = `input.${ext}`;
      const outputFile = `${outputName}.${format}`;

      // Determine if we should slice the file to save memory
      const totalDuration = await probeDuration(sourceFile);
      const range = sourceFile.size > SLICE_THRESHOLD
        ? estimateByteRange(sourceFile, startTime, endTime, totalDuration)
        : null;

      let ffmpegStart = startTime;
      let ffmpegEnd = endTime;

      if (range) {
        // Slice the file blob -- only load the relevant portion into WASM memory
        const slicedBlob = sourceFile.slice(range.sliceStart, range.sliceEnd);
        const slicedFile = new File([slicedBlob], sourceFile.name, { type: sourceFile.type });
        await ffmpeg.writeFile(inputName, await fetchFile(slicedFile));

        // Adjust timestamps relative to the slice offset
        const startSec = parseTimestamp(startTime) - range.offsetSeconds;
        const endSec = parseTimestamp(endTime) - range.offsetSeconds;

        const fmtTime = (s: number) => {
          const h = Math.floor(s / 3600);
          const m = Math.floor((s % 3600) / 60);
          const sec = s % 60;
          return h > 0
            ? `${h}:${String(m).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0')}`
            : `${m}:${sec.toFixed(3).padStart(6, '0')}`;
        };

        ffmpegStart = fmtTime(Math.max(0, startSec));
        ffmpegEnd = fmtTime(endSec);
      } else {
        // Small file or short video -- load the whole thing
        await ffmpeg.writeFile(inputName, await fetchFile(sourceFile));
      }

      // Write SRT file if captions provided
      if (srtContent) {
        const encoder = new TextEncoder();
        await ffmpeg.writeFile('captions.srt', encoder.encode(srtContent));
      }

      // Build FFmpeg command -- put -ss before -i for fast seek
      const args = ['-ss', ffmpegStart, '-i', inputName, '-to', ffmpegEnd];

      // Build video filter chain
      const vfParts: string[] = [];
      if (srtContent) {
        vfParts.push("subtitles=captions.srt:force_style='FontSize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Alignment=2,MarginV=30'");
      }
      if (resolution) {
        vfParts.push(`scale=-2:${resolution}`);
      }

      if (vfParts.length > 0) {
        args.push('-vf', vfParts.join(','));
        args.push('-c:a', 'copy');
      } else {
        // Stream copy when no filters needed (fast)
        args.push('-c', 'copy');
      }

      // Avoid negative timestamps from fast seek
      args.push('-avoid_negative_ts', 'make_zero');
      args.push('-y', outputFile);

      // Track progress
      ffmpeg.on('progress', ({ progress: p }: { progress: number }) => {
        setProgress(Math.round(p * 100));
      });

      await ffmpeg.exec(args);

      // Read output
      const data = await ffmpeg.readFile(outputFile);
      const blob = new Blob([data], {
        type: format === 'mp4' ? 'video/mp4' : 'video/quicktime',
      });
      const url = URL.createObjectURL(blob);

      // Cleanup WASM filesystem
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputFile);
      if (srtContent) {
        try { await ffmpeg.deleteFile('captions.srt'); } catch {}
      }

      return { filename: outputFile, blob, url };
    },
    [loadFFmpeg, probeDuration]
  );

  const exportAll = useCallback(
    async (clips: ExportOptions[]) => {
      setIsExporting(true);
      setError(null);
      setResults([]);
      setProgress(0);

      try {
        const allResults: ExportResult[] = [];
        for (let i = 0; i < clips.length; i++) {
          setProgress(0);
          const result = await exportClip(clips[i]);
          allResults.push(result);
          setResults([...allResults]);
        }
        return allResults;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Export failed');
        return [];
      } finally {
        setIsExporting(false);
      }
    },
    [exportClip]
  );

  const downloadResult = useCallback((result: ExportResult) => {
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.filename;
    a.click();
  }, []);

  const cleanup = useCallback(() => {
    results.forEach((r) => URL.revokeObjectURL(r.url));
    setResults([]);
    setProgress(0);
    setError(null);
  }, [results]);

  return {
    isLoading,
    isExporting,
    progress,
    results,
    error,
    exportClip,
    exportAll,
    downloadResult,
    cleanup,
  };
}
