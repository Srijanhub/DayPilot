import { create } from "zustand";
import { TimelineSegment } from "@/components/DialRing";

export type FlightMode = "WORK" | "STUDY" | "RELAX";
export type OverrideMode = "AUTO" | "FORCE_WORK" | "FORCE_STUDY" | "FORCE_RELAX";

interface FlightDeckState {
  mode: FlightMode;
  override: OverrideMode;
  isPhaseShifting: boolean;
  audioEnergy: number;
  isCommandPaletteOpen: boolean;
  isBootComplete: boolean;
  timelineSegments: TimelineSegment[];
  
  // Actions
  setMode: (mode: FlightMode) => void;
  setOverride: (override: OverrideMode) => void;
  setAudioEnergy: (energy: number) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  completeBoot: () => void;
  setTimelineSegments: (segments: TimelineSegment[]) => void;
  triggerPhaseShift: (newMode: FlightMode) => void;
}

export const useFlightDeckStore = create<FlightDeckState>((set, get) => ({
  mode: "WORK",
  override: "AUTO",
  isPhaseShifting: false,
  audioEnergy: 0.0,
  isCommandPaletteOpen: false,
  isBootComplete: false,
  timelineSegments: [
    { startHour: 9.0, endHour: 11.5, category: "WORK", label: "VS Code • daypilot implementation", duration: "2h 30m" },
    { startHour: 11.5, endHour: 13.0, category: "STUDY", label: "BossCoder • Dynamic Programming Lab 4", duration: "1h 30m" },
    { startHour: 13.0, endHour: 13.75, category: "MANHWA", label: "Omniscient Reader's Viewpoint • Ch 214", duration: "45m" },
    { startHour: 14.0, endHour: 16.5, category: "WORK", label: "GitHub PR Review & Frontend Architecture", duration: "2h 30m" },
    { startHour: 16.5, endHour: 17.5, category: "SHOWS", label: "Arcane Season 2 • Episode 4", duration: "1h 00m" }
  ],

  setMode: (mode) => {
    document.body.setAttribute("data-mode", mode);
    set({ mode });
  },

  setOverride: (override) => set({ override }),
  setAudioEnergy: (audioEnergy) => set({ audioEnergy }),
  setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
  completeBoot: () => set({ isBootComplete: true }),
  setTimelineSegments: (timelineSegments) => set({ timelineSegments }),

  triggerPhaseShift: (newMode) => {
    set({ isPhaseShifting: true });
    // Update data attribute for smooth CSS token transitions
    document.body.setAttribute("data-mode", newMode);

    setTimeout(() => {
      set({ mode: newMode, isPhaseShifting: false });
    }, 400);
  }
}));
