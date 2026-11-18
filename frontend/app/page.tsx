"use client";

import React, { useEffect } from "react";
import CockpitHeader from "@/components/CockpitHeader";
import FlightDeckOrb from "@/components/FlightDeckOrb";
import DialRing from "@/components/DialRing";
import CommandPalette from "@/components/CommandPalette";
import BootSequence from "@/components/BootSequence";
import MorningBriefingPanel from "@/components/MorningBriefingPanel";
import BossCoderGitHubPanel from "@/components/BossCoderGitHubPanel";
import MediaResumePanel from "@/components/MediaResumePanel";
import MusicPlayerPanel from "@/components/MusicPlayerPanel";
import NewspaperPanel from "@/components/NewspaperPanel";
import VoiceMemoPanel from "@/components/VoiceMemoPanel";
import SpectrogramRibbon from "@/components/SpectrogramRibbon";
import { useFlightDeckStore, FlightMode } from "@/store/useFlightDeckStore";

export default function FlightDeckPage() {
  const { mode, audioEnergy, isPhaseShifting, timelineSegments, setMode } = useFlightDeckStore();

  // Connect to local backend WebSocket for real-time telemetry updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket("ws://127.0.0.1:4000/ws/state");
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "MODE_CHANGE" || payload.type === "INITIAL_STATE") {
            if (payload.data && payload.data.mode) {
              setMode(payload.data.mode as FlightMode);
            }
          }
        } catch (err) {}
      };
    } catch (e) {
      // Backend offline, fallback to local state
    }
    return () => {
      if (ws) ws.close();
    };
  }, [setMode]);

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)] relative select-none">
      {/* Boot Telemetry Screen */}
      <BootSequence />

      {/* Global ⌘K Command Palette */}
      <CommandPalette />

      {/* Top Cockpit Header & Mode Switcher */}
      <CockpitHeader />

      {/* Cockpit HUD Workspace */}
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Top Hero Section: The Central 3D Instrument */}
        <div className="relative w-full h-[480px] rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden flex items-center justify-center">
          {/* Subtle Radar Background Grid */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, oklch(1 0 0 / 0.15) 1px, transparent 1px)",
              backgroundSize: "24px 24px"
            }}
          />

          {/* 3D Glowing WebGL Orb */}
          <FlightDeckOrb
            mode={mode}
            audioEnergy={audioEnergy}
            isPhaseShifting={isPhaseShifting}
          />

          {/* 24-Hour Activity Dial Ring */}
          <DialRing segments={timelineSegments} />

          {/* Micro HUD Labels inside Orb Section */}
          <div className="absolute top-4 left-5 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
            <span className="instrument-label text-[10px] text-[var(--accent-primary)]">
              ACTIVE MENTAL STATE: [{mode}]
            </span>
          </div>

          <div className="absolute top-4 right-5 text-[10px] font-mono text-[var(--text-muted)]">
            FPS: 60 • GPU DPR: 2.0 • SHADER: PERLIN_FRESNEL
          </div>

          <div className="absolute bottom-4 text-center font-mono text-xs text-[var(--text-muted)] pointer-events-none">
            Move cursor to tilt instrument • 24h dial ring tracks today's active flow
          </div>
        </div>

        {/* Bento Grid: Modules & Streams */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <MorningBriefingPanel />
            <NewspaperPanel />
          </div>

          {/* Right Column (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <BossCoderGitHubPanel />
            <MediaResumePanel />
            <MusicPlayerPanel />
            <VoiceMemoPanel />
          </div>
        </div>

        {/* Bottom Full-Width Ribbon: 24h Spectrogram & Retrospective */}
        <SpectrogramRibbon />

      </div>

      {/* Footer */}
      <footer className="w-full border-t border-[var(--border-hairline)] py-3 px-6 text-center text-[10px] font-mono text-[var(--text-muted)]">
        DAYPILOT v1.0.0 • 100% PRIVATE LOCAL-FIRST WORKSTATION • MAC OS DARWIN
      </footer>
    </main>
  );
}
