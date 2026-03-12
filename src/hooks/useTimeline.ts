import { create } from 'zustand';

interface TimelineState {
  pixelsPerSecond: number;
  scrollLeft: number;
  containerWidth: number;

  setPixelsPerSecond: (pps: number) => void;
  setScrollLeft: (left: number) => void;
  setContainerWidth: (width: number) => void;
  zoom: (delta: number) => void;

  secondsToPixels: (seconds: number) => number;
  pixelsToSeconds: (pixels: number) => number;
}

const MIN_PPS = 2;
const MAX_PPS = 200;

export const useTimeline = create<TimelineState>((set, get) => ({
  pixelsPerSecond: 20,
  scrollLeft: 0,
  containerWidth: 0,

  setPixelsPerSecond: (pps) => set({ pixelsPerSecond: Math.max(MIN_PPS, Math.min(MAX_PPS, pps)) }),
  setScrollLeft: (left) => set({ scrollLeft: Math.max(0, left) }),
  setContainerWidth: (width) => set({ containerWidth: width }),

  zoom: (delta) => {
    const { pixelsPerSecond } = get();
    const factor = delta > 0 ? 1.15 : 0.87;
    set({ pixelsPerSecond: Math.max(MIN_PPS, Math.min(MAX_PPS, pixelsPerSecond * factor)) });
  },

  secondsToPixels: (seconds) => seconds * get().pixelsPerSecond,
  pixelsToSeconds: (pixels) => pixels / get().pixelsPerSecond,
}));
