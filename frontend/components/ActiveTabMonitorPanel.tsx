"use client";

import React, { useState, useEffect } from "react";
import { Compass, ExternalLink, Globe, Monitor, Radio, Clock, ShieldCheck, Search } from "lucide-react";

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
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchData = async () => {
    try {
      const [liveRes, histRes] = await Promise.all([
        fetch("http://127.0.0.1:4000/api/tabs/live").catch(() => null),
        fetch("http://127.0.0.1:4000/api/tabs/history").catch(() => null)
      ]);
      if (liveRes && liveRes.ok) {
        const liveData = await liveRes.json();
        setLiveTab(liveData);
      }
      if (histRes && histRes.ok) {
        const histData = await histRes.json();
        if (Array.isArray(histData)) {
          setHistory(histData);
        }
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

  // Determine current active item (either from live heartbeat or latest from history)
  const currentActiveTab = (liveTab && liveTab.is_active) ? liveTab : (history.length > 0 ? {
    is_active: true,
    app_name: history[0].domain.includes("local") ? "DayPilot" : "Opera GX",
    window_title: history[0].title,
    domain: history[0].domain,
    url: history[0].url,
    category: (history[0].category as any) || "WORK",
    dwell_seconds: history[0].total_seconds,
    last_heartbeat: history[0].last_active
  } : null);

  const filteredHistory = history.filter((item) => {
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
          <span className="text-xs font-mono text-emerald-400 uppercase font-semibold">
            LIVE OPERA GX FEED
          </span>
        </div>
      </div>

      {/* 1. CURRENT LIVE FOCUS HERO BOX */}
      {currentActiveTab ? (
        <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] relative overflow-hidden">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-xs font-mono tracking-widest text-[var(--text-muted)] uppercase flex items-center space-x-1.5">
              <Radio className="w-3.5 h-3.5 text-[var(--accent-primary)] animate-pulse" />
              <span>CURRENT FOCUSED TAB // {currentActiveTab.app_name}</span>
            </span>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-[var(--accent-glow)] text-[var(--accent-primary)] border border-[var(--accent-ring)] font-bold">
              {currentActiveTab.category}
            </span>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white truncate hover:text-[var(--accent-primary)] transition">
              {currentActiveTab.window_title}
            </h3>
            <div className="flex items-center space-x-3 text-xs text-[var(--text-muted)] font-mono">
              <span className="flex items-center space-x-1">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span>{currentActiveTab.domain}</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Dwell: {formatDwell(currentActiveTab.dwell_seconds)}</span>
              </span>
            </div>
          </div>

          {currentActiveTab.url && (
            <div className="mt-3 pt-2.5 border-t border-[var(--border-hairline)] flex justify-end">
              <a
                href={currentActiveTab.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 rounded bg-[var(--bg-surface)] hover:bg-[var(--accent-primary)] hover:text-black border border-[var(--border-hairline)] text-xs font-mono font-bold tracking-wider transition flex items-center space-x-1.5"
              >
                <span>OPEN LIVE TAB</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-center text-xs text-[var(--text-muted)] font-mono">
          Awaiting active tab focus from Opera GX...
        </div>
      )}

      {/* 2. TODAY'S TABS BREAKDOWN FEED */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="instrument-label text-xs text-[var(--text-muted)]">
            RECORDED WORKSPACE TABS ({filteredHistory.length} / {history.length})
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
          {filteredHistory.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--text-muted)] font-mono border border-dashed border-[var(--border-hairline)] rounded-lg">
              No tabs match current filter.
            </div>
          ) : (
            filteredHistory.map((item, idx) => {
              const hasUrl = Boolean(item.url);
              const Component = hasUrl ? "a" : "div";
              const linkProps = hasUrl ? { href: item.url, target: "_blank", rel: "noopener noreferrer" } : {};

              return (
                <Component
                  key={idx}
                  {...linkProps}
                  className="p-3 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-[var(--border-active)] transition flex items-center justify-between text-xs group cursor-pointer block"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="truncate mr-3">
                      <div className="font-semibold text-white truncate group-hover:text-[var(--accent-primary)] transition flex items-center space-x-1.5 text-xs">
                        <span className="truncate">{item.title}</span>
                        {hasUrl && <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition text-[var(--accent-primary)] shrink-0" />}
                      </div>
                      <div className="text-xs font-mono text-[var(--text-muted)] flex items-center space-x-2 mt-0.5">
                        <span className="text-slate-400">{item.domain}</span>
                        <span className="text-slate-600">•</span>
                        <span>last active: {item.last_active ? item.last_active.split(" ")[1] : "Today"}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 whitespace-nowrap shrink-0">
                      <span className="font-mono text-xs font-bold text-white">
                        {item.formatted_time}
                      </span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {item.category}
                      </span>
                    </div>
                  </div>
                </Component>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
