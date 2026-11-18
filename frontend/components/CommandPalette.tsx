"use client";

import React, { useState, useEffect } from "react";
import { useFlightDeckStore, FlightMode } from "@/store/useFlightDeckStore";
import { Command, Search, Zap, BookOpen, Music, Mic, CheckCircle, X } from "lucide-react";

export default function CommandPalette() {
  const { isCommandPaletteOpen, setCommandPaletteOpen, triggerPhaseShift, setOverride } = useFlightDeckStore();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
      if (e.key === "Escape" && isCommandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const actions = [
    { id: "mode_work", title: "Switch to WORK Mode", category: "Mode", icon: Zap, action: () => { setOverride("FORCE_WORK"); triggerPhaseShift("WORK"); } },
    { id: "mode_study", title: "Switch to STUDY Mode", category: "Mode", icon: Zap, action: () => { setOverride("FORCE_STUDY"); triggerPhaseShift("STUDY"); } },
    { id: "mode_relax", title: "Switch to RELAX Mode", category: "Mode", icon: Zap, action: () => { setOverride("FORCE_RELAX"); triggerPhaseShift("RELAX"); } },
    { id: "mode_auto", title: "Enable AUTO-DETECT Context", category: "Mode", icon: Zap, action: () => setOverride("AUTO") },
    { id: "resume_manhwa", title: "Resume: The Greatest Estate Developer (Ch 148)", category: "Media", icon: BookOpen, action: () => window.open("https://asuracomic.net", "_blank") },
    { id: "resume_show", title: "Resume: Arcane Season 2 (Episode 4)", category: "Media", icon: BookOpen, action: () => window.open("https://netflix.com", "_blank") },
    { id: "music_toggle", title: "Toggle YouTube Music (Play/Pause)", category: "Music", icon: Music, action: () => {} },
    { id: "record_memo", title: "Record Voice Memo Quick-Dump", category: "Audio", icon: Mic, action: () => {} },
  ];

  const filtered = actions.filter(a => a.title.toLowerCase().includes(query.toLowerCase()) || a.category.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] rounded-xl shadow-2xl overflow-hidden">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-[var(--border-hairline)]">
          <Search className="w-4 h-4 text-[var(--text-muted)] mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or jump to task..."
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none font-mono"
            autoFocus
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="text-[var(--text-muted)] hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action List */}
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  item.action();
                  setCommandPaletteOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left hover:bg-[var(--bg-surface)] hover:border border-transparent hover:border-[var(--border-hairline)] transition group"
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-4 h-4 text-[var(--accent-primary)] group-hover:scale-110 transition" />
                  <span className="text-xs text-[var(--text-primary)] font-medium">{item.title}</span>
                </div>
                <span className="instrument-label text-[9px] text-[var(--text-muted)]">{item.category}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
