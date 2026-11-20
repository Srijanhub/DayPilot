"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  RefreshCw,
  Sparkles,
  BarChart2,
  Calendar,
  Layers,
  Info,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  X
} from "lucide-react";
import { useFlightDeckStore } from "@/store/useFlightDeckStore";
import { SpectrogramSlot, FlightLogItem } from "@/lib/api";

const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string; glow: string }> = {
  WORK: { bg: "bg-[#00f5ff]/15", text: "text-[#00f5ff]", dot: "bg-[#00f5ff]", glow: "shadow-[0_0_8px_#00f5ff44]" },
  STUDY: { bg: "bg-[#10b981]/15", text: "text-[#10b981]", dot: "bg-[#10b981]", glow: "shadow-[0_0_8px_#10b98144]" },
  MANHWA: { bg: "bg-[#f43f5e]/15", text: "text-[#f43f5e]", dot: "bg-[#f43f5e]", glow: "shadow-[0_0_8px_#f43f5e44]" },
  SHOWS: { bg: "bg-[#f59e0b]/15", text: "text-[#f59e0b]", dot: "bg-[#f59e0b]", glow: "shadow-[0_0_8px_#f59e0b44]" },
  RELAX: { bg: "bg-[#a855f7]/15", text: "text-[#a855f7]", dot: "bg-[#a855f7]", glow: "shadow-[0_0_8px_#a855f744]" },
  LEISURE: { bg: "bg-[#ec4899]/15", text: "text-[#ec4899]", dot: "bg-[#ec4899]", glow: "shadow-[0_0_8px_#ec489944]" },
  IDLE: { bg: "bg-white/5", text: "text-slate-400", dot: "bg-slate-600", glow: "none" }
};

export default function SpectrogramRibbon() {
  const { nightlyBriefing, refreshNightlyBriefing, timelineSegments } = useFlightDeckStore();

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentSlotIdx, setCurrentSlotIdx] = useState<number>(-1);

  // Load nightly retrospective on mount and update current time cursor
  useEffect(() => {
    refreshNightlyBriefing();

    const updateTimeCursor = () => {
      const now = new Date();
      const slot = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);
      setCurrentSlotIdx(slot);
    };

    updateTimeCursor();
    const interval = setInterval(updateTimeCursor, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshNightlyBriefing();
    } finally {
      setIsRefreshing(false);
    }
  };

  // 48 Spectrogram Slots: Prefer empirical backend slots, fallback to synthesized
  const slots: SpectrogramSlot[] = useMemo(() => {
    if (nightlyBriefing?.spectrogram && nightlyBriefing.spectrogram.length === 48) {
      return nightlyBriefing.spectrogram;
    }

    // Synthesized fallback using timeline segments
    return Array.from({ length: 48 }).map((_, i) => {
      const slotHour = i / 2;
      const hStr = Math.floor(slotHour).toString().padStart(2, "0");
      const mStr = i % 2 ? "30" : "00";
      const time = `${hStr}:${mStr}`;
      const endH = Math.floor((i + 1) / 2).toString().padStart(2, "0");
      const endM = (i + 1) % 2 ? "30" : "00";

      let category: SpectrogramSlot["category"] = "IDLE";
      let height = 10;
      let activeMins = 0;
      let topApp = "No activity logged";

      for (const seg of timelineSegments) {
        if (slotHour >= seg.startHour && slotHour <= seg.endHour) {
          category = seg.category;
          height = category === "WORK" ? 90 : category === "STUDY" ? 75 : 55;
          activeMins = 25;
          topApp = seg.label;
          break;
        }
      }

      return {
        slot: i,
        time,
        time_range: `${time} - ${endH}:${endM}`,
        category,
        intensity: activeMins > 0 ? 80 : 0,
        height,
        color: category === "WORK" ? "#00f5ff" : category === "STUDY" ? "#10b981" : category === "MANHWA" ? "#f43f5e" : category === "SHOWS" ? "#f59e0b" : "rgba(255, 255, 255, 0.08)",
        active_seconds: activeMins * 60,
        active_minutes: activeMins,
        idle_minutes: 30 - activeMins,
        top_app: topApp
      };
    });
  }, [nightlyBriefing?.spectrogram, timelineSegments]);

  // Active inspected slot (hover takes priority, then pinned, then current slot)
  const inspectedIdx = hoveredIdx !== null ? hoveredIdx : pinnedIdx !== null ? pinnedIdx : currentSlotIdx;
  const activeSlot = inspectedIdx >= 0 && inspectedIdx < slots.length ? slots[inspectedIdx] : null;

  // Real Retrospective Metrics
  const focusScore = nightlyBriefing?.focus_score ?? 0;
  const workHours = nightlyBriefing?.total_work_hours ?? (nightlyBriefing ? roundHours(nightlyBriefing.total_work_seconds) : 0);
  const relaxHours = nightlyBriefing?.total_relax_hours ?? (nightlyBriefing ? roundHours(nightlyBriefing.total_relax_seconds) : 0);
  const totalTrackedHours = Number((workHours + relaxHours).toFixed(1));
  const flightLog: FlightLogItem[] = nightlyBriefing?.flight_log ?? [];
  const aiSummary = nightlyBriefing?.ai_summary;

  // Unique categories in spectrogram for filter pills
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    slots.forEach((s) => {
      if (s.category !== "IDLE") set.add(s.category);
    });
    return ["ALL", ...Array.from(set)];
  }, [slots]);

  return (
    <div className="etched-panel rounded-xl p-5 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
        <div className="flex items-center space-x-2.5">
          <Activity className="w-4 h-4 text-[var(--accent-primary)] animate-pulse" />
          <span className="instrument-label text-[var(--accent-primary)] font-bold tracking-wider">
            24-HOUR CONTINUOUS SPECTROGRAM & RETROSPECTIVE AUDIT
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          {/* Real Telemetry Tag */}
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-[10px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>SQLITE WAL STREAM</span>
          </div>

          {/* Refresh Action */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-[var(--border-active)] text-xs font-mono text-[var(--text-secondary)] transition disabled:opacity-50"
            title="Recalculate retrospective audit from telemetry"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-[var(--accent-primary)]" : ""}`} />
            <span>{isRefreshing ? "CALCULATING..." : "REFRESH AUDIT"}</span>
          </button>
        </div>
      </div>

      {/* Top Retrospective KPI Deck */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Focus Score */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">FOCUS SCORE</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
              {focusScore} <span className="text-xs text-[var(--text-muted)]">/ 100</span>
            </div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
              Empirical flow vs. leisure ratio
            </div>
          </div>
          <TrendingUp className="w-6 h-6 text-emerald-400/60" />
        </div>

        {/* Productive Flow Hours */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">PRODUCTIVE FLOW</div>
            <div className="text-xl font-bold font-mono text-[#00f5ff] mt-0.5">
              {workHours} <span className="text-xs text-[var(--text-muted)]">hrs</span>
            </div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
              Deep Work & Technical Study
            </div>
          </div>
          <BarChart2 className="w-6 h-6 text-[#00f5ff]/60" />
        </div>

        {/* Rest & Leisure Hours */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">REST & LEISURE</div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">
              {relaxHours} <span className="text-xs text-[var(--text-muted)]">hrs</span>
            </div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
              Shows, Manhwa, Wind-down
            </div>
          </div>
          <Clock className="w-6 h-6 text-amber-400/60" />
        </div>

        {/* Total Monitored Telemetry */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">TRACKED TIME</div>
            <div className="text-xl font-bold font-mono text-slate-200 mt-0.5">
              {totalTrackedHours} <span className="text-xs text-[var(--text-muted)]">hrs</span>
            </div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
              Active desktop & browser heartbeats
            </div>
          </div>
          <Layers className="w-6 h-6 text-slate-400/60" />
        </div>
      </div>

      {/* AI Daily Flight Debrief Banner */}
      {aiSummary && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-[var(--bg-elevated)] to-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-start space-x-3">
          <Sparkles className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
          <div className="text-xs font-mono text-slate-300 leading-relaxed">
            <span className="font-bold text-[var(--accent-primary)] mr-2">FLIGHT DEBRIEF:</span>
            {aiSummary}
          </div>
        </div>
      )}

      {/* Spectrogram Section Header with Interactive Filters */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-xs font-mono text-[var(--text-secondary)]">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="font-bold">SPECTRUM FILTERS:</span>
          </div>

          <div className="flex items-center flex-wrap gap-1 text-[11px] font-mono">
            {availableCategories.map((cat) => {
              const isSelected = activeFilter === cat;
              const colorInfo = CATEGORY_COLORS[cat] || CATEGORY_COLORS.IDLE;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className={`px-2.5 py-0.5 rounded transition ${
                    isSelected
                      ? "bg-[var(--accent-primary)] text-black font-bold shadow-sm"
                      : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-white border border-[var(--border-hairline)]"
                  }`}
                >
                  <span className="flex items-center space-x-1.5">
                    {cat !== "ALL" && <span className={`w-1.5 h-1.5 rounded-full ${colorInfo.dot}`} />}
                    <span>{cat}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 24h Axis Labels */}
        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] px-1">
          <span>00:00 (MIDNIGHT)</span>
          <span>06:00 (MORNING)</span>
          <span>12:00 (NOON)</span>
          <span>18:00 (EVENING)</span>
          <span>24:00 (NIGHT)</span>
        </div>

        {/* Continuous 48-Slot Interactive Spectrogram Canvas */}
        <div className="relative h-24 w-full flex items-end gap-1 px-1.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] overflow-hidden select-none">
          {slots.map((bar, i) => {
            const isMatch = activeFilter === "ALL" || bar.category === activeFilter;
            const isHovered = hoveredIdx === i;
            const isPinned = pinnedIdx === i;
            const isCurrent = currentSlotIdx === i;
            const barOpacity = isHovered || isPinned ? 1.0 : isMatch ? 0.85 : 0.2;

            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setPinnedIdx(pinnedIdx === i ? null : i)}
                className={`relative flex-1 rounded-t-sm cursor-pointer transition-all duration-200 ${
                  isHovered || isPinned ? "scale-y-105 z-10" : ""
                }`}
                style={{
                  height: `${bar.height}%`,
                  backgroundColor: bar.color,
                  opacity: barOpacity,
                  boxShadow:
                    isHovered || isPinned
                      ? `0 0 12px ${bar.color}`
                      : isMatch && bar.category !== "IDLE"
                      ? `0 0 4px ${bar.color}44`
                      : "none"
                }}
              >
                {/* Glow ring when pinned or hovered */}
                {(isHovered || isPinned) && (
                  <div className="absolute inset-0 rounded-t-sm ring-1 ring-white" />
                )}

                {/* Real-time Indicator Line if slot is NOW */}
                {isCurrent && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"
                    title="Current Time"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Dynamic Ambient Slot Inspector HUD */}
        {activeSlot ? (
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-active)] shadow-lg space-y-2 transition">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-white">
                  SLOT {activeSlot.time_range}
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    CATEGORY_COLORS[activeSlot.category]?.bg || "bg-white/5"
                  } ${CATEGORY_COLORS[activeSlot.category]?.text || "text-white"}`}
                >
                  {activeSlot.category}
                </span>
                {pinnedIdx === activeSlot.slot && (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40">
                    PINNED
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-3 text-xs font-mono">
                <span className="text-[var(--text-muted)]">
                  ACTIVE:{" "}
                  <strong className="text-slate-200 font-bold">
                    {activeSlot.active_minutes}m
                  </strong>
                </span>
                <span className="text-[var(--text-muted)]">•</span>
                <span className="text-[var(--text-muted)]">
                  INTENSITY:{" "}
                  <strong className="text-emerald-400 font-bold">
                    {activeSlot.intensity}%
                  </strong>
                </span>
                {pinnedIdx !== null && (
                  <button
                    onClick={() => setPinnedIdx(null)}
                    className="text-[var(--text-muted)] hover:text-white"
                    title="Clear pinned slot"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs font-mono gap-2 pt-0.5">
              <div className="text-[var(--text-muted)] flex items-center space-x-1.5 truncate max-w-xl">
                <span className="text-[var(--text-secondary)]">PRIMARY CONTEXT:</span>
                <span className="text-white font-medium truncate">{activeSlot.top_app}</span>
              </div>

              {activeSlot.category_breakdown && Object.keys(activeSlot.category_breakdown).length > 0 && (
                <div className="flex items-center space-x-2 text-[10px]">
                  {Object.entries(activeSlot.category_breakdown).map(([cat, secs]) => (
                    <span key={cat} className="text-[var(--text-muted)]">
                      {cat}: <span className="text-slate-200">{Math.round(secs / 60)}m</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 text-center text-xs font-mono text-[var(--text-muted)] border border-dashed border-[var(--border-hairline)] rounded-xl">
            Hover over or click any bar to inspect 30-minute telemetry & primary applications
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[10px] font-mono text-[var(--text-muted)] pt-1">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00f5ff]" />
            <span>WORK (CYAN)</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10b981]" />
            <span>STUDY (EMERALD)</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f43f5e]" />
            <span>MANHWA (ROSE)</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            <span>SHOWS (AMBER)</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#a855f7]" />
            <span>RELAX (VIOLET)</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-white/20" />
            <span>IDLE / UNMONITORED</span>
          </span>
        </div>
      </div>

      {/* Planned vs Completed Flight Audit */}
      <div className="border-t border-[var(--border-hairline)] pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="instrument-label text-[10px] text-[var(--text-muted)] font-bold">
              PLANNED COMMITMENTS VS. COMPLETED TELEMETRY AUDIT
            </span>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            {flightLog.filter((f) => f.status === "COMPLETED").length} OF {flightLog.length} OBJECTIVES RESOLVED
          </span>
        </div>

        <div className="space-y-2">
          {flightLog.map((item, idx) => {
            const isCompleted = item.status === "COMPLETED";
            const isPartial = item.status === "PARTIAL";
            const isLeisure = item.status === "LEISURE" || item.type === "LEISURE";
            const isCarriedOver = item.status === "CARRIED OVER";

            return (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--border-active)] transition text-xs"
              >
                <div className="flex items-center space-x-3 min-w-0 pr-3">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : isPartial ? (
                    <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                  ) : isLeisure ? (
                    <Activity className="w-4 h-4 text-purple-400 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      {item.type && (
                        <span
                          className={`text-[9px] font-mono px-1.5 rounded uppercase font-bold ${
                            item.type === "PLANNED"
                              ? "bg-cyan-950/60 text-[#00f5ff] border border-cyan-800/40"
                              : item.type === "CALENDAR"
                              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                              : item.type === "LEISURE"
                              ? "bg-purple-950/60 text-purple-400 border border-purple-800/40"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {item.type}
                        </span>
                      )}
                      <span
                        className={`font-medium truncate ${
                          isCompleted
                            ? "text-slate-200"
                            : isLeisure
                            ? "text-purple-200"
                            : isPartial
                            ? "text-amber-200"
                            : "text-slate-400 line-through"
                        }`}
                      >
                        {item.title}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0 text-right">
                  {item.logged_duration && (
                    <span className="text-[10px] font-mono text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded border border-[var(--border-hairline)]">
                      {item.logged_duration}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-[var(--text-muted)] hidden sm:inline">
                    {item.time}
                  </span>
                  <span
                    className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold ${
                      isCompleted
                        ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                        : isPartial
                        ? "bg-amber-950/60 text-amber-400 border border-amber-800/40"
                        : isLeisure
                        ? "bg-purple-950/60 text-purple-400 border border-purple-800/40"
                        : "bg-rose-950/60 text-rose-400 border border-rose-800/40"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function roundHours(seconds: number): number {
  return Number((seconds / 3600).toFixed(1));
}
