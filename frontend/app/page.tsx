"use client";

import React, { useEffect, useState, useRef } from "react";
import CockpitHeader from "@/components/CockpitHeader";
import FlightDeckOrb from "@/components/FlightDeckOrb";
import DialRing from "@/components/DialRing";
import CommandPalette from "@/components/CommandPalette";
import BootSequence from "@/components/BootSequence";
import MorningBriefingPanel from "@/components/MorningBriefingPanel";
import GmailDigestPanel from "@/components/GmailDigestPanel";
import BossCoderGitHubPanel from "@/components/BossCoderGitHubPanel";
import MediaResumePanel from "@/components/MediaResumePanel";
import MusicPlayerPanel from "@/components/MusicPlayerPanel";
import NewspaperPanel from "@/components/NewspaperPanel";
import VoiceMemoPanel from "@/components/VoiceMemoPanel";
import SpectrogramRibbon from "@/components/SpectrogramRibbon";
import ActiveTabMonitorPanel from "@/components/ActiveTabMonitorPanel";
import FlightDeckCopilot from "@/components/FlightDeckCopilot";
import OrbTacticalHub from "@/components/OrbTacticalHub";
import { useFlightDeckStore } from "@/store/useFlightDeckStore";
import { WS_BASE } from "@/lib/api";

export default function FlightDeckPage() {
  const {
    mode,
    audioEnergy,
    isPhaseShifting,
    timelineSegments,
    loadInitialData,
    handleWebSocketMessage
  } = useFlightDeckStore();

  const [isBreathing, setIsBreathing] = useState(false);
  const [orbTelemetry, setOrbTelemetry] = useState({ fps: 60, dpr: 1.5 });
  const wsRef = useRef<WebSocket | null>(null);

  // 1. Initial boot data fetch across all cached modules (single coordinated fetch)
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 2. Central WebSocket connection - invalidates Zustand cache on live events
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let isMounted = true;

    const connectWs = () => {
      try {
        const ws = new WebSocket(`${WS_BASE}/ws/state`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            handleWebSocketMessage(payload);
          } catch (err) {}
        };

        ws.onclose = () => {
          if (isMounted) {
            reconnectTimeout = setTimeout(connectWs, 3000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (e) {
        if (isMounted) {
          reconnectTimeout = setTimeout(connectWs, 3000);
        }
      }
    };

    connectWs();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [handleWebSocketMessage]);

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)] relative select-none">
      {/* Boot Telemetry Screen */}
      <BootSequence />

      {/* Global ⌘K Command Palette */}
      <CommandPalette />

      {/* Top Cockpit Header & Mode Switcher */}
      <CockpitHeader />

      {/* Cockpit HUD Workspace - Expands smoothly across fullscreen and ultrawide displays */}
      <div className="flex-1 px-4 sm:px-6 lg:px-10 xl:px-12 py-6 w-full max-w-[2400px] mx-auto space-y-6">
        
        {/* Top Hero Section: The Central 3D Instrument */}
        <div className="relative w-full h-[480px] lg:h-[520px] xl:h-[560px] rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden flex items-center justify-center">
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
            isBreathing={isBreathing}
            onTelemetryUpdate={setOrbTelemetry}
          />

          {/* 24-Hour Activity Dial Ring */}
          <DialRing segments={timelineSegments} />

          {/* Holographic Orb Tactical Hub: Pomodoro Flow Pacer & Orbital Action Satellites */}
          <OrbTacticalHub onBreathingChange={setIsBreathing} />

          {/* Micro HUD Labels inside Orb Section */}
          <div className="absolute top-4 left-5 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
            <span className="instrument-label text-[10px] text-[var(--accent-primary)]">
              ACTIVE MENTAL STATE: [{mode}]
            </span>
          </div>

          <div className="absolute top-4 right-5 text-[10px] font-mono text-[var(--text-muted)]">
            FPS: {orbTelemetry.fps} • GPU DPR: {orbTelemetry.dpr.toFixed(1)} • SHADER: PERLIN_FRESNEL
          </div>

          <div className="absolute bottom-4 text-center font-mono text-xs text-[var(--text-muted)] pointer-events-none">
            Move cursor to tilt instrument • 24h dial ring tracks today's active flow
          </div>
        </div>

        {/* Bento Grid: Modules & Streams */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <ActiveTabMonitorPanel />
            <VoiceMemoPanel />
            <MorningBriefingPanel />
            <NewspaperPanel />
          </div>

          {/* Right Column (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <GmailDigestPanel />
            <BossCoderGitHubPanel />
            <MediaResumePanel />
            <MusicPlayerPanel />
          </div>
        </div>

        {/* Bottom Full-Width Ribbon: 24h Spectrogram & Retrospective */}
        <SpectrogramRibbon />

      </div>

      {/* Global AI Copilot Communicator (⌘J) */}
      <FlightDeckCopilot />

      {/* Footer */}
      <footer className="w-full border-t border-[var(--border-hairline)] py-3 px-6 text-center text-[10px] font-mono text-[var(--text-muted)]">
        DAYPILOT v1.0.0 • 100% PRIVATE LOCAL-FIRST WORKSTATION • MAC OS DARWIN
      </footer>
    </main>
  );
}
