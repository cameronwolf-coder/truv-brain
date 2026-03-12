import { useState } from 'react';
import type { Segment, PersonaKey } from '../../types/videoEditor';
import { parseTimestamp, formatTimestamp, segmentDuration } from '../../utils/videoEditorUtils';
import { PERSONA_COLORS } from './PersonaFilter';

interface SegmentCardProps {
  segment: Segment;
  index: number;
  isApproved: boolean;
  isSelected: boolean;
  onApprove: () => void;
  onReject: () => void;
  onEdit: (updates: Partial<Segment>) => void;
  onSelect: () => void;
  onSeek: (seconds: number) => void;
}

export function SegmentCard({
  segment,
  index,
  isApproved,
  isSelected,
  onApprove,
  onReject,
  onEdit,
  onSelect,
  onSeek,
}: SegmentCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(segment.suggestedTitle);
  const [editStart, setEditStart] = useState(segment.start);
  const [editEnd, setEditEnd] = useState(segment.end);

  const duration = segmentDuration(segment.start, segment.end);

  const handleSave = () => {
    onEdit({ suggestedTitle: editTitle, start: editStart, end: editEnd });
    setIsEditing(false);
  };

  return (
    <div
      onClick={() => {
        onSelect();
        onSeek(parseTimestamp(segment.start));
      }}
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-400 bg-blue-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-400">#{index + 1}</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                segment.type === 'highlight'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              {segment.type}
            </span>
            <span className="text-xs text-gray-400">
              {segment.relevance}/10
            </span>
          </div>

          {isEditing ? (
            <div className="space-y-2 mt-2">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                placeholder="Title"
              />
              <div className="flex gap-2">
                <input
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className="w-20 text-xs px-2 py-1 border border-gray-300 rounded font-mono"
                  placeholder="0:00"
                />
                <span className="text-gray-400 text-xs self-center">to</span>
                <input
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className="w-20 text-xs px-2 py-1 border border-gray-300 rounded font-mono"
                  placeholder="0:00"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-900 truncate">
                {segment.suggestedTitle}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{segment.topic}</p>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSeek(parseTimestamp(segment.start));
          }}
          className="text-xs font-mono text-blue-600 hover:text-blue-800"
        >
          {segment.start} - {segment.end}
        </button>
        <span className="text-xs text-gray-400">{formatTimestamp(duration)}</span>
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {segment.personas.map((p) => (
          <span
            key={p}
            className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
              PERSONA_COLORS[p as PersonaKey] || 'bg-gray-100 text-gray-600 border-gray-300'
            }`}
          >
            {p}
          </span>
        ))}
      </div>

      {!isEditing && (
        <div className="flex gap-1 mt-2 pt-2 border-t border-gray-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApprove();
            }}
            className={`flex-1 text-xs py-1 rounded transition-colors ${
              isApproved
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-600'
            }`}
          >
            {isApproved ? 'Approved' : 'Approve'}
          </button>
          {isApproved && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReject();
              }}
              className="flex-1 text-xs py-1 rounded bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              Remove
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="px-2 text-xs py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
