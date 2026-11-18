"use client";

import React, { useState, useEffect } from "react";
import { useFlightDeckStore, FlightMode } from "@/store/useFlightDeckStore";
import { Terminal, Shield, Zap, Sparkles, Command } from "lucide-react";

export default function CockpitHeader() {
  const { mode, override, triggerPhaseShift, setOverride, setCommandPaletteOpen } = useFlightDeckStore();
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("en-US", { hour12: false }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleModeChange = (targetMode: FlightMode) => {
    setOverride(`FORCE_${targetMode}` as any);
    triggerPhaseShift(targetMode);
  };

  const handleAutoToggle = () => {
    setOverride("AUTO");
  };

  return (
    <header className="w-full flex items-center justify-between px-6 py-4 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] backdrop-blur-md z-40">
      {/* Left: Branding & Status */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
          <span className="font-mono text-xs font-bold tracking-widest text-[var(--text-primary)]">
            DAYPILOT // FLIGHT DECK
          </span>
        </div>
        <span className="text-[10px] font-mono text-[var(--text-muted)] border-l border-[var(--border-hairline)] pl-4">
          SYS.STATUS: NOMINAL
        </span>
      </div>

      {/* Center: Tactile Segmented Mode Switcher */}
      <div className="flex items-center bg-[var(--bg-elevated)] border border-[var(--border-hairline)] rounded-full p-1 space-x-1 shadow-inner">
        <button
          onClick={handleAutoToggle}
          className={`px-3 py-1 text-[11px] font-mono rounded-full transition-all duration-300 flex items-center space-x-1.5 ${
            override === "AUTO"
              ? "bg-[var(--accent-primary)] text-black font-bold shadow-md"
              : "text-[var(--text-muted)] hover:text-white"
          }`}
        >
          <Zap className="w-3 h-3" />
          <span>AUTO</span>
        </button>

        {(["WORK", "STUDY", "RELAX"] as FlightMode[]).map((m) => {
          const isActive = mode === m && override !== "AUTO";
          return (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`px-3 py-1 text-[11px] font-mono rounded-full transition-all duration-300 ${
                isActive
                  ? "bg-[var(--accent-primary)] text-black font-bold shadow-md"
                  : "text-[var(--text-muted)] hover:text-white"
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>

      {/* Right: Clock & Command Palette Trigger */}
      <div className="flex items-center space-x-4">
        <div className="font-mono text-xs text-[var(--text-primary)] tracking-wider">
          <span className="text-[var(--text-muted)] mr-1.5">UTC+5:30</span>
          <span className="font-bold text-[var(--accent-primary)]">{timeStr || "09:00:00"}</span>
        </div>

        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-[var(--border-active)] transition text-[11px] font-mono text-[var(--text-muted)] hover:text-white"
        >
          <Command className="w-3 h-3 text-[var(--accent-primary)]" />
          <span>K</span>
        </button>
      </div>
    </header>
  );
}
