export interface TranscriptEntry {
  start: number;
  end: number;
  text: string;
}

export function formatSrtTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function formatSrt(transcript: TranscriptEntry[]): string {
  return transcript
    .map((entry, i) => {
      const start = formatSrtTimestamp(entry.start);
      const end = formatSrtTimestamp(entry.end);
      return `${i + 1}\n${start} --> ${end}\n${entry.text}\n`;
    })
    .join('\n');
}

export function parseSrt(srt: string): TranscriptEntry[] {
  const blocks = srt.trim().split(/\n\n+/);
  return blocks
    .map((block) => {
      const lines = block.split('\n');
      if (lines.length < 3) return null;
      const timeMatch = lines[1].match(
        /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
      );
      if (!timeMatch) return null;
      const start =
        parseInt(timeMatch[1]) * 3600 +
        parseInt(timeMatch[2]) * 60 +
        parseInt(timeMatch[3]) +
        parseInt(timeMatch[4]) / 1000;
      const end =
        parseInt(timeMatch[5]) * 3600 +
        parseInt(timeMatch[6]) * 60 +
        parseInt(timeMatch[7]) +
        parseInt(timeMatch[8]) / 1000;
      const text = lines.slice(2).join('\n');
      return { start, end, text };
    })
    .filter((e): e is TranscriptEntry => e !== null);
}

function extractJsonArray(text: string): string {
  const fenced = text.match(/```(?:json)?\s*(\[.*?\])\s*```/s);
  if (fenced) return fenced[1];
  const raw = text.match(/\[.*\]/s);
  if (raw) return raw[0];
  return text;
}

export function parseTranscriptResponse(responseText: string): TranscriptEntry[] {
  const jsonStr = extractJsonArray(responseText);
  const cleaned = jsonStr.replace(/,\s*([}\]])/g, '$1');
  const entries = JSON.parse(cleaned) as Record<string, unknown>[];

  return entries.map((entry) => {
    let text = (entry.text as string) || '';
    if (!text) {
      for (const key of ['content', 'transcript', 'phrase', 'words', 'caption', 'speech']) {
        if (entry[key]) {
          text = entry[key] as string;
          break;
        }
      }
    }
    return {
      start: Number(entry.start),
      end: Number(entry.end),
      text,
    };
  });
}
