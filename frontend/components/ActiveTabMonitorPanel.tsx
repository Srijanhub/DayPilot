"use client";

import React, { useState, useEffect } from "react";
import {
  Compass,
  Globe,
  Radio,
  Search,
  ExternalLink,
  RefreshCw,
  Clock,
  Layers,
  Monitor,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useFlightDeckStore } from "@/store/useFlightDeckStore";
import { daypilotApi } from "@/lib/api";

export default function ActiveTabMonitorPanel() {
  const { openTabs, liveTab, tabHistory, browserConnected, refreshLiveTab } = useFlightDeckStore();

  const [viewMode, setViewMode] = useState<"LIVE" | "RECENT">("LIVE");
  const [filter, setFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Load live tab and history state on mount
  useEffect(() => {
    refreshLiveTab();
  }, [refreshLiveTab]);

  // If browser is not reporting open tabs, default to recent active Opera GX tabs
  useEffect(() => {
    if (!browserConnected && openTabs.length === 0 && tabHistory.length > 0) {
      setViewMode("RECENT");
    }
  }, [browserConnected, openTabs.length, tabHistory.length]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshLiveTab();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenUrl = async (url: string) => {
    if (!url || !url.startsWith("http")) return;
    try {
      await daypilotApi.openUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  };

  // Currently focused tab in the browser (if extension is reporting)
  const focusedTab = openTabs.find((t) => t.focused) ?? null;

  // Active items based on selected view mode
  const rawItems = viewMode === "LIVE" ? openTabs : tabHistory;

  const filteredItems = rawItems.filter((item) => {
    const cat = item.category || "WORK";
    const matchesFilter =
      filter === "ALL" ? true :
      filter === "WORK" ? cat === "WORK" :
      filter === "STUDY" ? cat === "STUDY" :
      filter === "MEDIA" ? (cat === "RELAX" || cat === "MANHWA" || cat === "SHOWS" || cat === "LEISURE") : true;

    if (!matchesFilter) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = (item.title || "").toLowerCase();
    const domain = (item.domain || "").toLowerCase();
    const url = (item.url || "").toLowerCase();
    return title.includes(q) || domain.includes(q) || url.includes(q);
  });

  return (
    <div className="etched-panel rounded-xl p-5 space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3">
        <div className="flex items-center space-x-2">
          <Compass className="w-4 h-4 text-[var(--accent-primary)] animate-spin-slow" />
          <span className="instrument-label text-[var(--accent-primary)] font-bold tracking-wider">
            ACTIVE TAB & APPLICATION RADAR
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Connection Badge */}
          <div className="flex items-center space-x-1.5 text-xs font-mono">
            <span className={`w-2 h-2 rounded-full ${browserConnected ? "bg-emerald-400 animate-ping" : "bg-slate-500"}`} />
            <span className={`text-[11px] uppercase font-semibold ${browserConnected ? "text-emerald-400" : "text-slate-400"}`}>
              {browserConnected ? "OPERA GX CONNECTED" : "OFFLINE TRACKING"}
            </span>
          </div>

          {/* Refresh Action */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-[var(--border-active)] text-xs font-mono text-[var(--text-secondary)] transition disabled:opacity-50"
            title="Refresh active tabs and telemetry"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-[var(--accent-primary)]" : ""}`} />
            <span>{isRefreshing ? "SYNCING..." : "REFRESH"}</span>
          </button>
        </div>
      </div>

      {/* 1. CURRENT FOCUSED TAB OR ACTIVE DESKTOP CONTEXT */}
      {focusedTab ? (
        <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-active)] relative overflow-hidden space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-mono tracking-widest text-[var(--text-muted)] uppercase flex items-center space-x-1.5">
              <Radio className="w-3.5 h-3.5 text-[var(--accent-primary)] animate-pulse" />
              <span>CURRENT FOCUSED BROWSER TAB</span>
            </span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[var(--accent-glow)] text-[var(--accent-primary)] border border-[var(--accent-ring)] font-bold">
              {focusedTab.category}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{focusedTab.title}</h3>
              <div className="flex items-center space-x-1.5 text-xs text-[var(--text-muted)] font-mono">
                <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{focusedTab.domain}</span>
              </div>
            </div>
            {focusedTab.url && (
              <button
                onClick={() => handleOpenUrl(focusedTab.url)}
                className="shrink-0 p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--border-active)] text-[var(--accent-primary)] hover:text-white transition"
                title="Switch to or open tab in Opera GX"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : liveTab && liveTab.is_active ? (
        <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-mono tracking-widest text-[var(--text-muted)] uppercase flex items-center space-x-1.5">
              <Monitor className="w-3.5 h-3.5 text-emerald-400" />
              <span>ACTIVE FOREGROUND WINDOW ({liveTab.app_name || "DESKTOP"})</span>
            </span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-bold">
              {liveTab.category || "WORK"}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{liveTab.window_title}</h3>
              <div className="flex items-center space-x-2 text-xs text-[var(--text-muted)] font-mono">
                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                <span>Active Dwell: {Math.round((liveTab.dwell_seconds || 5) / 60)}m</span>
                {liveTab.domain && liveTab.domain !== "desktop" && (
                  <>
                    <span>•</span>
                    <span className="truncate">{liveTab.domain}</span>
                  </>
                )}
              </div>
            </div>
            {liveTab.url && (
              <button
                onClick={() => handleOpenUrl(liveTab.url!)}
                className="shrink-0 p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--border-active)] text-[var(--accent-primary)] hover:text-white transition"
                title="Open URL in Opera GX"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-xs text-[var(--text-muted)] font-mono flex items-center justify-between">
          <span>Active Window: Idle / Listening for desktop heartbeats</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">STANDBY</span>
        </div>
      )}

      {/* 2. TABS RADAR (VIEW TOGGLE & CONTROLS) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 p-0.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-xs font-mono">
            <button
              onClick={() => setViewMode("LIVE")}
              className={`px-2.5 py-1 rounded transition text-xs font-semibold ${
                viewMode === "LIVE"
                  ? "bg-[var(--accent-primary)] text-black"
                  : "text-[var(--text-muted)] hover:text-white"
              }`}
            >
              LIVE TABS ({openTabs.length})
            </button>
            <button
              onClick={() => setViewMode("RECENT")}
              className={`px-2.5 py-1 rounded transition text-xs font-semibold ${
                viewMode === "RECENT"
                  ? "bg-[var(--accent-primary)] text-black"
                  : "text-[var(--text-muted)] hover:text-white"
              }`}
            >
              OPERA GX ACTIVITY ({tabHistory.length})
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-1 text-xs font-mono">
            {["ALL", "WORK", "STUDY", "MEDIA"].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-2.5 py-1 rounded transition text-xs ${
                  filter === cat
                    ? "bg-slate-700 text-white font-bold border border-slate-600"
                    : "text-[var(--text-muted)] hover:text-white bg-[var(--bg-elevated)] border border-[var(--border-hairline)]"
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
            placeholder={`Search ${viewMode === "LIVE" ? "open tabs" : "Opera GX activity"} by title, domain, or URL...`}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition"
          />
        </div>

        {/* Scrollable list of tabs */}
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
          {filteredItems.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--text-muted)] font-mono border border-dashed border-[var(--border-hairline)] rounded-xl space-y-2">
              <div>
                {rawItems.length === 0
                  ? viewMode === "LIVE"
                    ? "No live browser tabs currently reported."
                    : "No recent Opera GX activity recorded yet."
                  : "No tabs match current search or filter."}
              </div>
              {viewMode === "LIVE" && !browserConnected && (
                <div className="text-[11px] text-amber-400">
                  Tip: Switch to &ldquo;OPERA GX ACTIVITY&rdquo; above to inspect your recent tracked tabs.
                </div>
              )}
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isFocused = "focused" in item && Boolean(item.focused);
              const durationStr = "formatted_time" in item ? item.formatted_time : null;

              return (
                <div
                  key={"id" in item && item.id ? item.id : `${item.url}-${idx}`}
                  className={`p-3 rounded-lg border transition flex items-center justify-between text-xs group ${
                    isFocused
                      ? "bg-[var(--bg-elevated)] border-[var(--accent-ring)]"
                      : "bg-[var(--bg-surface)] border-[var(--border-hairline)] hover:border-[var(--border-active)]"
                  }`}
                >
                  <div className="truncate mr-3 min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <a
                        href={item.url}
                        onClick={(e) => {
                          e.preventDefault();
                          handleOpenUrl(item.url);
                        }}
                        className="font-semibold text-white hover:text-[var(--accent-primary)] truncate text-xs transition"
                        title={item.title}
                      >
                        {item.title}
                      </a>
                    </div>
                    <div className="flex items-center space-x-2 text-[10px] font-mono text-[var(--text-muted)] mt-0.5 truncate">
                      <span className="truncate">{item.domain}</span>
                      {durationStr && (
                        <>
                          <span>•</span>
                          <span className="text-slate-300 font-medium">Logged: {durationStr}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 whitespace-nowrap shrink-0">
                    {isFocused && (
                      <span className="text-[10px] font-mono text-[var(--accent-primary)] font-bold px-1.5 py-0.5 rounded bg-[var(--accent-glow)] border border-[var(--accent-ring)]">
                        FOCUSED
                      </span>
                    )}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {item.category || "WORK"}
                    </span>
                    <button
                      onClick={() => handleOpenUrl(item.url)}
                      className="p-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-[var(--border-active)] text-slate-400 hover:text-white transition opacity-70 group-hover:opacity-100"
                      title="Open in Opera GX"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
