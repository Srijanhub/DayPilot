"use client";

import React, { useState, useEffect } from "react";
import { Compass, ExternalLink, Globe, Monitor, Radio, Clock, ShieldCheck } from "lucide-react";

interface LiveTab {
  is_active: boolean;
  app_name: string;
  window_title: string;
  domain: string;
  url: string;
  category: "WORK" | "STUDY" | "RELAX" | "MANHWA" | "SHOWS";
  dwell_seconds: number;
  last_heartbeat: string;
}

interface TabHistoryItem {
  title: string;
  domain: string;
  url: string;
  category: string;
  total_seconds: number;
  formatted_time: string;
  last_active: string;
}

export default function ActiveTabMonitorPanel() {
  const [liveTab, setLiveTab] = useState<LiveTab | null>(null);
  const [history, setHistory] = useState<TabHistoryItem[]>([]);
  const [filter, setFilter] = useState<string>("ALL");

  const fetchData = async () => {
    try {
      const [liveRes, histRes] = await Promise.all([
        fetch("http://127.0.0.1:4000/api/tabs/live"),
        fetch("http://127.0.0.1:4000/api/tabs/history")
      ]);
      if (liveRes.ok) {
        const liveData = await liveRes.json();
        setLiveTab(liveData);
      }
      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData);
      }
    } catch (e) {
      // Backend temporarily offline
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const filteredHistory = history.filter((item) => {
    if (filter === "ALL") return true;
    if (filter === "WORK") return item.category === "WORK";
    if (filter === "STUDY") return item.category === "STUDY";
    if (filter === "MEDIA") return item.category === "RELAX" || item.category === "MANHWA" || item.category === "SHOWS";
    return true;
  });

  const formatDwell = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}m ${remainingSecs < 10 ? "0" : ""}${remainingSecs}s`;
  };

  return (
    <div className="etched-panel rounded-xl p-5 space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
        <div className="flex items-center space-x-2">
          <Compass className="w-4 h-4 text-[var(--accent-primary)] animate-spin-slow" />
          <span className="instrument-label text-[var(--accent-primary)] font-bold">
            ACTIVE TAB & APPLICATION RADAR
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">
            LIVE OPERA GX FEED
          </span>
        </div>
      </div>

      {/* 1. CURRENT LIVE FOCUS HERO BOX */}
      {liveTab && liveTab.is_active ? (
        <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] relative overflow-hidden">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-[9px] font-mono tracking-widest text-[var(--text-muted)] uppercase flex items-center space-x-1.5">
              <Radio className="w-3 h-3 text-[var(--accent-primary)] animate-pulse" />
              <span>CURRENT FOCUSED TAB // {liveTab.app_name}</span>
            </span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[var(--accent-glow)] text-[var(--accent-primary)] border border-[var(--accent-ring)] font-bold">
              {liveTab.category}
            </span>
          </div>

          <div className="text-sm font-bold text-white mb-1 truncate">
            {liveTab.window_title}
          </div>

          <div className="flex items-center justify-between mt-3 text-xs">
            <div className="flex items-center space-x-2 text-[var(--text-muted)] font-mono text-[11px]">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>{liveTab.domain}</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Active for {formatDwell(liveTab.dwell_seconds)}</span>
              </span>
            </div>

            {liveTab.url && (
              <a
                href={liveTab.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded bg-[var(--bg-surface)] hover:bg-[var(--accent-primary)] hover:text-black border border-[var(--border-hairline)] text-[10px] font-mono font-bold tracking-wider transition flex items-center space-x-1"
              >
                <span>VISIT TAB</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-center text-xs text-[var(--text-muted)] font-mono">
          Awaiting active tab focus from Opera GX...
        </div>
      )}

      {/* 2. TODAY'S TABS BREAKDOWN FEED */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="instrument-label text-[9px] text-[var(--text-muted)]">
            TODAY'S TABS BREAKDOWN ({filteredHistory.length})
          </span>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-1 text-[10px] font-mono">
            {["ALL", "WORK", "STUDY", "MEDIA"].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-2 py-0.5 rounded transition ${
                  filter === cat
                    ? "bg-[var(--accent-primary)] text-black font-bold"
                    : "text-[var(--text-muted)] hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable list of tabs */}
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {filteredHistory.map((item, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--border-active)] transition flex items-center justify-between text-xs group"
            >
              <div className="truncate mr-3">
                <div className="font-medium text-white truncate group-hover:text-[var(--accent-primary)] transition">
                  {item.title}
                </div>
                <div className="text-[10px] font-mono text-[var(--text-muted)] flex items-center space-x-2 mt-0.5">
                  <span className="text-slate-400">{item.domain}</span>
                  <span className="text-slate-600">•</span>
                  <span>last seen: {item.last_active ? item.last_active.split(" ")[1] : "Today"}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3 whitespace-nowrap">
                <span className="font-mono text-xs font-bold text-white">
                  {item.formatted_time}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {item.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
