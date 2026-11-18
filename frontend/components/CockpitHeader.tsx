"use client";

import React, { useState, useEffect } from "react";
import { useFlightDeckStore, FlightMode } from "@/store/useFlightDeckStore";
import { Terminal, Shield, Zap, Sparkles, Command, RefreshCw } from "lucide-react";
import { daypilotApi } from "@/lib/api";

export default function CockpitHeader() {
  const { mode, override, triggerPhaseShift, setOverride, setCommandPaletteOpen } = useFlightDeckStore();
  const [timeStr, setTimeStr] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("ALL CONNECTED");

  const handleSyncAll = async () => {
    setIsSyncing(true);
    setSyncStatus("SYNCING...");
    try {
      await daypilotApi.syncAll();
      setSyncStatus("ALL SYNCED");
    } catch (e) {
      setSyncStatus("OFFLINE");
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setSyncStatus("ALL SYNCED");
      }, 800);
    }
  };

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
    daypilotApi.setOverride(`FORCE_${targetMode}`).catch(() => {});
  };

  const handleAutoToggle = () => {
    setOverride("AUTO");
    daypilotApi.setOverride("AUTO").catch(() => {});
  };

  return (
    <header className="w-full border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] backdrop-blur-md z-40">
      <div className="w-full max-w-[2400px] mx-auto flex items-center justify-between px-6 lg:px-10 py-4">
        {/* Left: Branding & Status */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
            <span className="font-mono text-sm font-bold tracking-widest text-[var(--text-primary)]">
              DAYPILOT // FLIGHT DECK
            </span>
          </div>
          <div className="hidden sm:flex items-center space-x-2 border-l border-[var(--border-hairline)] pl-4">
            <span className="text-xs font-mono text-[var(--accent-primary)] font-bold">
              {syncStatus}
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)] hidden md:inline">
              (OPERA GX • GITHUB • BOSSCODER • GMAIL)
            </span>
            <button
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-white transition"
              title="Force Sync All Connected Feeds"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin text-[var(--accent-primary)]" : ""}`} />
            </button>
          </div>
        </div>

        {/* Center: Tactile Segmented Mode Switcher */}
        <div className="flex items-center bg-[var(--bg-elevated)] border border-[var(--border-hairline)] rounded-full p-1 space-x-1.5 shadow-inner">
          <button
            onClick={handleAutoToggle}
            className={`px-3.5 py-1.5 text-xs font-mono rounded-full transition-all duration-300 flex items-center space-x-1.5 ${
              override === "AUTO"
                ? "bg-[var(--accent-primary)] text-black font-bold shadow-md"
                : "text-[var(--text-muted)] hover:text-white"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>AUTO</span>
          </button>

          {(["WORK", "STUDY", "RELAX"] as FlightMode[]).map((m) => {
            const isActive = mode === m && override !== "AUTO";
            return (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`px-3.5 py-1.5 text-xs font-mono rounded-full transition-all duration-300 ${
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
          <div className="font-mono text-sm text-[var(--text-primary)] tracking-wider">
            <span className="text-[var(--text-muted)] mr-1.5">UTC+5:30</span>
            <span className="font-bold text-[var(--accent-primary)]">{timeStr || "09:00:00"}</span>
          </div>

          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-[var(--border-active)] transition text-xs font-mono text-[var(--text-muted)] hover:text-white"
          >
            <Command className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>⌘K</span>
          </button>
        </div>
      </div>
    </header>
  );
}
