import { create } from 'zustand';
import type { AnalysisResult, Segment, PersonaKey } from '../types/videoEditor';

interface VideoEditorState {
  // Source
  sourceFile: File | null;
  sourceUrl: string | null;
  videoDuration: number;

  // Analysis
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  analysisError: string | null;

  // Segments
  approvedSegments: Segment[];
  selectedIndex: number | null;
  activePersonas: PersonaKey[];

  // Playback
  currentTime: number;
  isPlaying: boolean;

  // Actions
  setSource: (file: File) => void;
  clearSource: () => void;
  setVideoDuration: (duration: number) => void;
  setAnalysis: (result: AnalysisResult) => void;
  setAnalyzing: (loading: boolean) => void;
  setAnalysisError: (error: string | null) => void;
  approveSegment: (segment: Segment) => void;
  rejectSegment: (index: number) => void;
  editSegment: (index: number, updates: Partial<Segment>) => void;
  approveAll: () => void;
  selectSegment: (index: number | null) => void;
  togglePersona: (persona: PersonaKey) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  reset: () => void;
}

const initialState = {
  sourceFile: null,
  sourceUrl: null,
  videoDuration: 0,
  analysis: null,
  isAnalyzing: false,
  analysisError: null,
  approvedSegments: [],
  selectedIndex: null,
  activePersonas: [] as PersonaKey[],
  currentTime: 0,
  isPlaying: false,
};

export const useVideoEditor = create<VideoEditorState>((set, get) => ({
  ...initialState,

  setSource: (file) => {
    const prev = get().sourceUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({
      sourceFile: file,
      sourceUrl: URL.createObjectURL(file),
      analysis: null,
      approvedSegments: [],
      selectedIndex: null,
      analysisError: null,
    });
  },

  clearSource: () => {
    const prev = get().sourceUrl;
    if (prev) URL.revokeObjectURL(prev);
    set(initialState);
  },

  setVideoDuration: (duration) => set({ videoDuration: duration }),

  setAnalysis: (result) => set({ analysis: result, isAnalyzing: false, analysisError: null }),

  setAnalyzing: (loading) => set({ isAnalyzing: loading, analysisError: null }),

  setAnalysisError: (error) => set({ analysisError: error, isAnalyzing: false }),

  approveSegment: (segment) =>
    set((s) => ({
      approvedSegments: s.approvedSegments.some(
        (a) => a.start === segment.start && a.end === segment.end
      )
        ? s.approvedSegments
        : [...s.approvedSegments, segment],
    })),

  rejectSegment: (index) =>
    set((s) => ({
      approvedSegments: s.approvedSegments.filter((_, i) => i !== index),
    })),

  editSegment: (index, updates) =>
    set((s) => ({
      approvedSegments: s.approvedSegments.map((seg, i) =>
        i === index ? { ...seg, ...updates } : seg
      ),
    })),

  approveAll: () => {
    const { analysis } = get();
    if (analysis) set({ approvedSegments: [...analysis.segments] });
  },

  selectSegment: (index) => set({ selectedIndex: index }),

  togglePersona: (persona) =>
    set((s) => ({
      activePersonas: s.activePersonas.includes(persona)
        ? s.activePersonas.filter((p) => p !== persona)
        : [...s.activePersonas, persona],
    })),

  setCurrentTime: (time) => set({ currentTime: time }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  reset: () => {
    const prev = get().sourceUrl;
    if (prev) URL.revokeObjectURL(prev);
    set(initialState);
  },
}));
