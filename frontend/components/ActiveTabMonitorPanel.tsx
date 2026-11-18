"use client";

import React, { useState } from "react";
import { Compass, Globe, Radio, Search } from "lucide-react";
import { useFlightDeckStore } from "@/store/useFlightDeckStore";

export default function ActiveTabMonitorPanel() {
  const { openTabs, browserConnected } = useFlightDeckStore();
  const [filter, setFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // The tab you are looking at right now (active tab of the focused browser window)
  const focusedTab = openTabs.find((t) => t.focused) ?? null;

  const filteredTabs = openTabs.filter((item) => {
    const matchesFilter =
      filter === "ALL" ? true :
      filter === "WORK" ? item.category === "WORK" :
      filter === "STUDY" ? item.category === "STUDY" :
      filter === "MEDIA" ? (item.category === "RELAX" || item.category === "MANHWA" || item.category === "SHOWS") : true;

    if (!matchesFilter) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.domain.toLowerCase().includes(q) ||
      item.url.toLowerCase().includes(q)
    );
  });

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
          <span className={`w-2 h-2 rounded-full ${browserConnected ? "bg-emerald-400 animate-ping" : "bg-slate-500"}`} />
          <span className={`text-xs font-mono uppercase font-semibold ${browserConnected ? "text-emerald-400" : "text-slate-400"}`}>
            {browserConnected ? "BROWSER CONNECTED" : "BROWSER OFFLINE"}
          </span>
        </div>
      </div>

      {/* 1. CURRENT FOCUSED TAB */}
      {focusedTab ? (
        <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] relative overflow-hidden">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-xs font-mono tracking-widest text-[var(--text-muted)] uppercase flex items-center space-x-1.5">
              <Radio className="w-3.5 h-3.5 text-[var(--accent-primary)] animate-pulse" />
              <span>CURRENT FOCUSED TAB</span>
            </span>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-[var(--accent-glow)] text-[var(--accent-primary)] border border-[var(--accent-ring)] font-bold">
              {focusedTab.category}
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white truncate">{focusedTab.title}</h3>
            <div className="flex items-center space-x-1 text-xs text-[var(--text-muted)] font-mono">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>{focusedTab.domain}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-center text-xs text-[var(--text-muted)] font-mono">
          {browserConnected ? "Browser is open but not in focus." : "Browser not connected. Open it with the DayPilot extension enabled."}
        </div>
      )}

      {/* 2. OPEN TABS (live snapshot only, no history) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="instrument-label text-xs text-[var(--text-muted)]">
            OPEN TABS ({filteredTabs.length} / {openTabs.length})
          </span>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-1 text-xs font-mono">
            {["ALL", "WORK", "STUDY", "MEDIA"].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-2.5 py-1 rounded transition text-xs ${
                  filter === cat
                    ? "bg-[var(--accent-primary)] text-black font-bold"
                    : "text-[var(--text-muted)] hover:text-white bg-[var(--bg-elevated)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Search bar inside tabs feed */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by tab title, domain, or URL..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition"
          />
        </div>

        {/* Scrollable list of tabs */}
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
          {filteredTabs.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--text-muted)] font-mono border border-dashed border-[var(--border-hairline)] rounded-lg">
              {openTabs.length === 0 ? "No open tabs reported." : "No tabs match current filter."}
            </div>
          ) : (
            filteredTabs.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border transition flex items-center justify-between text-xs ${
                  item.focused
                    ? "bg-[var(--bg-elevated)] border-[var(--accent-ring)]"
                    : "bg-[var(--bg-surface)] border-[var(--border-hairline)]"
                }`}
              >
                <div className="truncate mr-3">
                  <div className="font-semibold text-white truncate text-xs">{item.title}</div>
                  <div className="text-xs font-mono text-[var(--text-muted)] mt-0.5 truncate">{item.domain}</div>
                </div>
                <div className="flex items-center space-x-2 whitespace-nowrap shrink-0">
                  {item.focused && <span className="text-xs font-mono text-[var(--accent-primary)] font-bold">FOCUSED</span>}
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {item.category}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
