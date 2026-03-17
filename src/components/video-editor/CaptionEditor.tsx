import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { TranscriptEntry } from '../../utils/srtFormatter';
import { formatSrtTimestamp, parseTranscriptResponse } from '../../utils/srtFormatter';
import { useVideoEditor } from '../../hooks/useVideoEditor';

interface CaptionEditorProps {
  captions: TranscriptEntry[];
  onChange: (captions: TranscriptEntry[]) => void;
}

function CaptionEntryRow({
  entry,
  index: _index,
  onUpdate,
  onDelete,
  onAdd,
}: {
  entry: TranscriptEntry;
  index: number;
  onUpdate: (updates: Partial<TranscriptEntry>) => void;
  onDelete: () => void;
  onAdd: () => void;
}) {
  const [editingWordIndex, setEditingWordIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isFullEdit, setIsFullEdit] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingWordIndex !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingWordIndex]);

  const words = entry.text.split(/\s+/).filter(Boolean);

  const handleWordClick = (wordIdx: number) => {
    setEditingWordIndex(wordIdx);
    setEditValue(words[wordIdx]);
    setIsFullEdit(false);
  };

  const commitWord = () => {
    if (editingWordIndex === null) return;
    const newWords = [...words];
    // Allow deleting a word by clearing it, or replacing/splitting
    const replacement = editValue.trim();
    if (replacement) {
      newWords[editingWordIndex] = replacement;
    } else {
      newWords.splice(editingWordIndex, 1);
    }
    onUpdate({ text: newWords.join(' ') });
    setEditingWordIndex(null);
  };

  const handleWordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitWord();
    } else if (e.key === 'Escape') {
      setEditingWordIndex(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitWord();
      // Move to next/prev word
      const next = e.shiftKey
        ? Math.max(0, (editingWordIndex ?? 0) - 1)
        : Math.min(words.length - 1, (editingWordIndex ?? 0) + 1);
      if (next !== editingWordIndex) {
        setTimeout(() => handleWordClick(next), 0);
      }
    }
  };

  return (
    <div className="p-2 rounded border border-gray-200 bg-white text-xs space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-gray-400 font-mono w-20">
          {formatSrtTimestamp(entry.start).slice(3, -4)}
        </span>
        <span className="text-gray-300">-</span>
        <span className="text-gray-400 font-mono w-20">
          {formatSrtTimestamp(entry.end).slice(3, -4)}
        </span>
        <div className="flex-1" />
        <button
          onClick={onAdd}
          className="text-gray-400 hover:text-blue-600 px-1"
          title="Add after"
        >
          +
        </button>
        <button
          onClick={onDelete}
          className="text-gray-400 hover:text-red-600 px-1"
          title="Delete"
        >
          x
        </button>
      </div>

      {isFullEdit ? (
        <input
          value={entry.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          onBlur={() => setIsFullEdit(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') setIsFullEdit(false);
          }}
          autoFocus
          className="w-full px-1.5 py-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      ) : (
        <div
          className="flex flex-wrap gap-0.5 min-h-[24px] px-1 py-0.5 rounded cursor-text"
          onDoubleClick={() => setIsFullEdit(true)}
        >
          {words.length === 0 ? (
            <span
              className="text-gray-300 italic cursor-text"
              onClick={() => setIsFullEdit(true)}
            >
              Click to add text...
            </span>
          ) : (
            words.map((word, wi) =>
              editingWordIndex === wi ? (
                <input
                  key={wi}
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitWord}
                  onKeyDown={handleWordKeyDown}
                  className="px-1 py-0.5 border border-blue-400 rounded text-xs bg-blue-50 focus:outline-none w-auto"
                  style={{ width: Math.max(editValue.length * 7, 30) }}
                />
              ) : (
                <span
                  key={wi}
                  onClick={() => handleWordClick(wi)}
                  className="px-1 py-0.5 rounded cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  {word}
                </span>
              )
            )
          )}
        </div>
      )}
    </div>
  );
}

export function CaptionEditor({ captions, onChange }: CaptionEditorProps) {
  const { sourceFile } = useVideoEditor();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateCaptions = useCallback(async () => {
    if (!sourceFile) return;
    setIsGenerating(true);
    setError(null);

    try {
      let apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        const keyRes = await fetch('/api/video-editor/gemini-key');
        if (!keyRes.ok) throw new Error('Failed to get API key');
        ({ apiKey } = await keyRes.json());
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const arrayBuffer = await sourceFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: sourceFile.type || 'video/mp4',
            data: base64,
          },
        },
        `Transcribe the spoken audio in this video with timestamps.

Return ONLY a JSON array (no markdown fences) in this format:
[
  {"start": 0.0, "end": 2.5, "text": "spoken words here"},
  {"start": 2.5, "end": 5.1, "text": "next phrase here"}
]

Rules:
- Break into natural phrases of 5-10 words each
- Timestamps in seconds (float)
- Include all spoken content
- Do not include non-speech sounds`,
      ]);

      const entries = parseTranscriptResponse(result.response.text());
      onChange(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsGenerating(false);
    }
  }, [sourceFile, onChange]);

  const updateEntry = (index: number, updates: Partial<TranscriptEntry>) => {
    const updated = captions.map((c, i) => (i === index ? { ...c, ...updates } : c));
    onChange(updated);
  };

  const deleteEntry = (index: number) => {
    onChange(captions.filter((_, i) => i !== index));
  };

  const addEntry = (afterIndex: number) => {
    const prev = captions[afterIndex];
    const next = captions[afterIndex + 1];
    const start = prev ? prev.end : 0;
    const end = next ? next.start : start + 2;
    const newEntry: TranscriptEntry = { start, end, text: '' };
    const updated = [...captions];
    updated.splice(afterIndex + 1, 0, newEntry);
    onChange(updated);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Captions</h3>
          <span className="text-xs text-gray-400">{captions.length} entries</span>
        </div>
        <button
          onClick={generateCaptions}
          disabled={isGenerating || !sourceFile}
          className="w-full py-1.5 px-3 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? 'Transcribing...' : 'Auto-Generate with Gemini'}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {captions.map((entry, i) => (
          <CaptionEntryRow
            key={i}
            entry={entry}
            index={i}
            onUpdate={(updates) => updateEntry(i, updates)}
            onDelete={() => deleteEntry(i)}
            onAdd={() => addEntry(i)}
          />
        ))}

        {captions.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">
            Click "Auto-Generate" to transcribe, or add entries manually
          </p>
        )}

        {captions.length === 0 && (
          <button
            onClick={() => addEntry(-1)}
            className="w-full py-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors"
          >
            + Add caption entry
          </button>
        )}
      </div>
    </div>
  );
}
