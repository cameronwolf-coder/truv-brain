import { useCallback, useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AnalysisResult, PersonaKey } from '../types/videoEditor';
import { buildAnalysisPrompt } from '../utils/analysisPrompt';
import { useVideoEditor } from './useVideoEditor';

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*(\{.*?\})\s*```/s);
  if (fenced) return fenced[1];
  const raw = text.match(/\{.*\}/s);
  if (raw) return raw[0];
  return text;
}

type AnalysisStage = 'idle' | 'uploading' | 'processing' | 'analyzing' | 'done' | 'error';

export function useGeminiAnalysis() {
  const { sourceFile, setAnalysis, setAnalyzing, setAnalysisError } = useVideoEditor();
  const [stage, setStage] = useState<AnalysisStage>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);

  const analyze = useCallback(
    async (personas?: PersonaKey[]) => {
      if (!sourceFile) {
        setAnalysisError('No video file selected');
        return;
      }

      setAnalyzing(true);
      setStage('uploading');
      setUploadProgress(0);

      try {
        // Get API key
        let apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
          const keyRes = await fetch('/api/video-editor/gemini-key');
          if (!keyRes.ok) throw new Error('Failed to get Gemini API key');
          ({ apiKey } = await keyRes.json());
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // Step 1: Upload file via File API using resumable upload
        const mimeType = sourceFile.type || 'video/mp4';

        // Initiate resumable upload
        const startRes = await fetch(
          `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'X-Goog-Upload-Protocol': 'resumable',
              'X-Goog-Upload-Command': 'start',
              'X-Goog-Upload-Header-Content-Length': String(sourceFile.size),
              'X-Goog-Upload-Header-Content-Type': mimeType,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              file: { displayName: sourceFile.name },
            }),
          }
        );

        const uploadUrl = startRes.headers.get('X-Goog-Upload-URL');
        if (!uploadUrl) throw new Error('Failed to initiate upload');

        // Upload in chunks for progress tracking
        const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks
        let offset = 0;

        while (offset < sourceFile.size) {
          const end = Math.min(offset + CHUNK_SIZE, sourceFile.size);
          const chunk = sourceFile.slice(offset, end);
          const isLast = end === sourceFile.size;

          await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Length': String(end - offset),
              'X-Goog-Upload-Offset': String(offset),
              'X-Goog-Upload-Command': isLast ? 'upload, finalize' : 'upload',
            },
            body: chunk,
          });

          offset = end;
          setUploadProgress(Math.round((offset / sourceFile.size) * 100));
        }

        // Step 2: Poll until file is ACTIVE
        setStage('processing');
        // genAI instance used for file upload above
        let fileName = '';

        // Get the file name from the list (most recent upload)
        const listRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/files?key=${apiKey}&pageSize=1`
        );
        const listData = await listRes.json();
        if (listData.files && listData.files.length > 0) {
          fileName = listData.files[0].name;
        } else {
          throw new Error('Upload completed but file not found');
        }

        // Poll for processing completion
        let fileState = 'PROCESSING';
        let fileUri = '';
        while (fileState === 'PROCESSING') {
          await new Promise((r) => setTimeout(r, 3000));
          const statusRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
          );
          const statusData = await statusRes.json();
          fileState = statusData.state;
          fileUri = statusData.uri;

          if (fileState === 'FAILED') {
            throw new Error('Gemini failed to process the video');
          }
        }

        // Step 3: Generate analysis
        setStage('analyzing');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = buildAnalysisPrompt(personas);

        const result = await model.generateContent([
          {
            fileData: {
              mimeType,
              fileUri,
            },
          },
          prompt,
        ]);

        const responseText = result.response.text();
        const jsonStr = extractJson(responseText);
        const data = JSON.parse(jsonStr) as AnalysisResult;

        if (!data.source) {
          data.source = sourceFile.name;
        }

        setStage('done');
        setAnalysis(data);

        // Cleanup: delete the uploaded file
        try {
          await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`,
            { method: 'DELETE' }
          );
        } catch {}

      } catch (err) {
        setStage('error');
        setAnalysisError(err instanceof Error ? err.message : 'Analysis failed');
      }
    },
    [sourceFile, setAnalysis, setAnalyzing, setAnalysisError]
  );

  return { analyze, stage, uploadProgress };
}
